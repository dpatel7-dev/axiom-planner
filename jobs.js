// Background jobs that run on a timer
const { pool } = require('./db');
const { parseICS } = require('./lib/ics-parser');
const { extractSubjects, transformAssignments } = require('./lib/gemini');

// ----------------------------------------------------------
// Auto-sync ICS feeds: runs every 10 min, checks any feed
// that hasn't synced in the last 10 min and re-syncs it.
// ----------------------------------------------------------

async function autoSyncFeeds() {
  try {
    // Find all feeds where last_synced is older than 10 minutes (or null)
    const r = await pool.query(`
      SELECT f.*, us.gemini_api_key
      FROM ical_feeds f
      LEFT JOIN user_settings us ON us.user_id = f.user_id
      WHERE f.last_synced IS NULL OR f.last_synced < NOW() - INTERVAL '10 minutes'
    `);
    if (r.rows.length === 0) return;
    console.log(`[auto-sync] checking ${r.rows.length} feed(s)`);

    for (const feed of r.rows) {
      try {
        await syncOneFeed(feed);
      } catch (err) {
        console.error(`[auto-sync] feed ${feed.id} failed:`, err.message);
        await pool.query(
          'UPDATE ical_feeds SET last_synced = CURRENT_TIMESTAMP, last_status = $1, last_error = $2 WHERE id = $3',
          ['error', String(err.message).slice(0, 500), feed.id]
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[auto-sync] outer error:', err);
  }
}

async function syncOneFeed(feed) {
  // Fetch ICS
  const r = await fetch(feed.url, {
    headers: { 'User-Agent': 'Axiom-Planner/1.0', 'Accept': 'text/calendar, text/plain' }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  const allEvents = parseICS(text);
  if (allEvents.length === 0) {
    await markStatus(feed.id, 'empty');
    return;
  }

  if (feed.feed_type === 'classes') {
    await syncClasses(feed, allEvents);
  } else {
    await syncAssignments(feed, allEvents);
  }
  await markStatus(feed.id, 'ok');
}

async function syncClasses(feed, allEvents) {
  if (!feed.gemini_api_key) {
    // Simple dedup-by-summary fallback
    const seen = new Set();
    for (const e of allEvents) {
      const name = (e.summary || '').trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      if (/^(lunch|free|study hall|advisory|chapel|assembly|break|holiday|recess)/i.test(name)) continue;
      const existing = await pool.query(
        'SELECT id FROM subjects WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
        [feed.user_id, name]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO subjects (user_id, name, color) VALUES ($1, $2, $3)',
          [feed.user_id, name, '#d4a857']
        );
      }
    }
    return;
  }
  const extracted = await extractSubjects(feed.gemini_api_key, allEvents);
  const palette = ['#d4a857', '#e08667', '#b8c9e0', '#8fb67c', '#c9a3d4', '#f0c274', '#7ab0c4', '#d68aa3'];
  const existingR = await pool.query('SELECT id, name FROM subjects WHERE user_id = $1', [feed.user_id]);
  const existingByName = new Map(existingR.rows.map(s => [s.name.toLowerCase(), s]));
  let colorIdx = existingR.rows.length;
  for (const c of extracted) {
    const lookup = existingByName.get(c.name.toLowerCase());
    if (lookup) {
      await pool.query(`UPDATE subjects SET teacher = COALESCE(teacher, $1), room = COALESCE(room, $2) WHERE id = $3`,
        [c.teacher, c.room, lookup.id]);
    } else {
      await pool.query(
        'INSERT INTO subjects (user_id, name, color, teacher, room) VALUES ($1, $2, $3, $4, $5)',
        [feed.user_id, c.name, palette[colorIdx % palette.length], c.teacher, c.room]
      );
      colorIdx++;
    }
  }
}

async function syncAssignments(feed, allEvents) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const windowEnd = new Date(today); windowEnd.setDate(windowEnd.getDate() + 28);

  const windowEvents = allEvents.filter(e => {
    if (!e.start || !e.start.date) return false;
    const eventDate = new Date(e.start.date + 'T00:00:00');
    return eventDate >= yesterday && eventDate <= windowEnd;
  });
  const existing = await pool.query('SELECT ical_uid FROM ical_imported WHERE user_id = $1', [feed.user_id]);
  const existingUids = new Set(existing.rows.map(r => r.ical_uid));
  const newEvents = windowEvents.filter(e => !existingUids.has(e.uid));
  if (newEvents.length === 0) return;

  const subjR = await pool.query('SELECT id, name, teacher FROM subjects WHERE user_id = $1', [feed.user_id]);
  const subjects = subjR.rows;

  let tasks = [];
  if (feed.gemini_api_key) {
    try {
      for (let i = 0; i < newEvents.length; i += 25) {
        const batch = newEvents.slice(i, i + 25);
        const batchTasks = await transformAssignments(feed.gemini_api_key, batch, subjects);
        for (let j = 0; j < batchTasks.length && j < batch.length; j++) {
          tasks.push({ ...batchTasks[j], _uid: batch[j].uid });
        }
      }
    } catch {
      tasks = simpleConvert(newEvents, subjects);
    }
  } else {
    tasks = simpleConvert(newEvents, subjects);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of tasks) {
      if (!t._uid) continue;
      const ins = await client.query(`
        INSERT INTO tasks (user_id, subject_id, title, description, type, due_date, due_time, priority)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [feed.user_id, t.subject_id || null, t.title, t.description || null,
         t.type || 'assignment', t.due_date || null, t.due_time || null, t.priority || 'medium']);
      await client.query(`
        INSERT INTO ical_imported (user_id, feed_id, ical_uid, task_id) VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, ical_uid) DO NOTHING`,
        [feed.user_id, feed.id, t._uid, ins.rows[0].id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function simpleConvert(events, subjects) {
  return events.map(e => {
    let title = e.summary || 'Calendar event';
    let subjectId = null;
    for (const s of subjects) {
      if (title.toLowerCase().includes(s.name.toLowerCase())) {
        subjectId = s.id;
        const re = new RegExp('^' + s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:?\\s*', 'i');
        title = title.replace(re, '').trim() || title;
        break;
      }
    }
    let type = 'assignment', priority = 'medium';
    const lower = (e.summary + ' ' + (e.description || '')).toLowerCase();
    if (/\b(test|exam|midterm|final)\b/.test(lower)) { type = 'exam'; priority = 'high'; }
    else if (/\bquiz\b/.test(lower)) { type = 'quiz'; priority = 'high'; }
    else if (/\b(essay|paper|write|writing)\b/.test(lower)) { type = 'essay'; priority = 'high'; }
    else if (/\b(read|reading)\b/.test(lower)) { type = 'reading'; }
    else if (/\bproject\b/.test(lower)) { type = 'project'; priority = 'high'; }
    return {
      _uid: e.uid, title: title.slice(0, 250),
      description: e.description ? e.description.slice(0, 1000) : null,
      type, due_date: e.start?.date || null, due_time: e.start?.time || null,
      priority, subject_id: subjectId,
    };
  });
}

async function markStatus(feedId, status) {
  await pool.query(
    'UPDATE ical_feeds SET last_synced = CURRENT_TIMESTAMP, last_status = $1, last_error = NULL WHERE id = $2',
    [status, feedId]
  );
}

// ----------------------------------------------------------
// Recurring task generator — runs daily at startup + every 6h
// For each active rule whose next_due <= today, create a task and bump next_due.
// ----------------------------------------------------------

async function generateRecurringTasks() {
  try {
    const r = await pool.query(`
      SELECT * FROM recurring_rules
      WHERE active = TRUE AND (next_due IS NULL OR next_due <= CURRENT_DATE)
    `);
    if (r.rows.length === 0) return;
    console.log(`[recurring] generating for ${r.rows.length} rule(s)`);
    for (const rule of r.rows) {
      try {
        await materializeRecurring(rule);
      } catch (err) {
        console.error(`[recurring] rule ${rule.id} failed:`, err.message);
      }
    }
  } catch (err) {
    console.error('[recurring] outer error:', err);
  }
}

async function materializeRecurring(rule) {
  const tpl = rule.task_template || {};
  const dueDate = rule.next_due ? new Date(rule.next_due) : new Date();

  // Don't double-up: skip if a task with this rule's title + due date already exists
  const exists = await pool.query(
    'SELECT id FROM tasks WHERE user_id = $1 AND title = $2 AND due_date = $3',
    [rule.user_id, tpl.title, dueDate.toISOString().slice(0, 10)]
  );
  if (exists.rows.length === 0) {
    await pool.query(`
      INSERT INTO tasks (user_id, subject_id, title, description, type, due_date, due_time, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [rule.user_id, tpl.subject_id || null, tpl.title || 'Recurring task',
       tpl.description || null, tpl.type || 'assignment', dueDate.toISOString().slice(0, 10),
       tpl.due_time || null, tpl.priority || 'medium']);
  }

  // Compute the next occurrence
  const nextDate = computeNextDue(dueDate, rule.pattern, rule.pattern_value, rule.weekdays);
  await pool.query('UPDATE recurring_rules SET next_due = $1 WHERE id = $2',
    [nextDate.toISOString().slice(0, 10), rule.id]);
}

function computeNextDue(from, pattern, n, weekdays) {
  const d = new Date(from);
  if (pattern === 'daily') {
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (pattern === 'weekdays') {
    do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
    return d;
  }
  if (pattern === 'every_n_days') {
    d.setDate(d.getDate() + (n || 2));
    return d;
  }
  if (pattern === 'weekly' && weekdays) {
    const allowed = parseWeekdays(weekdays); // set of day numbers 0-6
    if (allowed.size === 0) {
      d.setDate(d.getDate() + 7);
      return d;
    }
    do { d.setDate(d.getDate() + 1); } while (!allowed.has(d.getDay()));
    return d;
  }
  // Default: weekly
  d.setDate(d.getDate() + 7);
  return d;
}

function parseWeekdays(str) {
  const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const set = new Set();
  String(str || '').split(',').forEach(s => {
    const k = s.trim().toLowerCase().slice(0, 3);
    if (map[k] !== undefined) set.add(map[k]);
  });
  return set;
}

// ----------------------------------------------------------
// Public scheduler
// ----------------------------------------------------------

function startBackgroundJobs() {
  // Run shortly after server boot
  setTimeout(() => { autoSyncFeeds(); generateRecurringTasks(); }, 30 * 1000);
  // Then on intervals
  setInterval(autoSyncFeeds, 10 * 60 * 1000);            // every 10 min
  setInterval(generateRecurringTasks, 6 * 60 * 60 * 1000); // every 6h
  console.log('✓ Background jobs scheduled (auto-sync 10min, recurring 6h)');
}

module.exports = { startBackgroundJobs, autoSyncFeeds, generateRecurringTasks, computeNextDue };
