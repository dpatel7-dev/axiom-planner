const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');
const { limiters } = require('../lib/rate-limit');
const { parseICS } = require('../lib/ics-parser');
const { extractSubjects, transformAssignments, testApiKey } = require('../lib/gemini');

const router = express.Router();
router.use(requireAuth);

// ----------------------------------------------------------
// AI key settings
// ----------------------------------------------------------

router.get('/settings', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT ai_enabled, gemini_api_key IS NOT NULL AS has_key FROM user_settings WHERE user_id = $1',
      [req.userId]
    );
    if (r.rows.length === 0) return res.json({ ai_enabled: false, has_key: false });
    res.json({ ai_enabled: r.rows[0].ai_enabled, has_key: r.rows[0].has_key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/settings', async (req, res) => {
  const { gemini_api_key } = req.body;
  if (!gemini_api_key) return res.status(400).json({ error: 'API key required' });
  try {
    await testApiKey(gemini_api_key);
    await pool.query(`
      INSERT INTO user_settings (user_id, gemini_api_key, ai_enabled, updated_at)
      VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE
      SET gemini_api_key = $2, ai_enabled = TRUE, updated_at = CURRENT_TIMESTAMP
    `, [req.userId, gemini_api_key]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/settings', async (req, res) => {
  await pool.query(
    'UPDATE user_settings SET gemini_api_key = NULL, ai_enabled = FALSE WHERE user_id = $1',
    [req.userId]
  );
  res.json({ ok: true });
});

// ----------------------------------------------------------
// ICS feeds
// ----------------------------------------------------------

router.get('/feeds', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, label, url, feed_type, last_synced, last_status, last_error, created_at
       FROM ical_feeds WHERE user_id = $1 ORDER BY feed_type ASC, created_at DESC`,
      [req.userId]
    );
    res.json({ feeds: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/feeds', async (req, res) => {
  let { url, label, feed_type } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  url = url.trim();
  if (url.startsWith('webcal://')) url = 'https://' + url.slice('webcal://'.length);
  if (!/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'URL must start with http://, https://, or webcal://' });
  }
  if (!['classes', 'assignments'].includes(feed_type)) feed_type = 'assignments';
  try {
    const r = await pool.query(
      'INSERT INTO ical_feeds (user_id, url, label, feed_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, url, label || (feed_type === 'classes' ? 'Class Schedule' : 'Assignments'), feed_type]
    );
    res.json({ feed: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/feeds/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM ical_feeds WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Feed not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------
// Sync — different logic depending on feed type
// ----------------------------------------------------------

router.post('/feeds/:id/sync', limiters.importSync, async (req, res) => {
  const feedId = req.params.id;
  const { daysAhead = 28 } = req.body || {};

  try {
    const feedR = await pool.query(
      'SELECT * FROM ical_feeds WHERE id = $1 AND user_id = $2',
      [feedId, req.userId]
    );
    if (feedR.rows.length === 0) return res.status(404).json({ error: 'Feed not found' });
    const feed = feedR.rows[0];

    // Fetch ICS
    let icsText;
    try {
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': 'Axiom-Planner/1.0', 'Accept': 'text/calendar, text/plain' }
      });
      if (!r.ok) throw new Error(`Fetch failed: HTTP ${r.status}`);
      icsText = await r.text();
    } catch (err) {
      await markFeedError(feedId, err.message);
      return res.status(400).json({ error: 'Could not fetch calendar: ' + err.message });
    }

    const allEvents = parseICS(icsText);
    if (allEvents.length === 0) {
      await markFeedStatus(feedId, 'empty');
      return res.json({ created: 0, skipped: 0, message: 'No events found.' });
    }

    // Get user's API key (may be null)
    const settingsR = await pool.query(
      'SELECT gemini_api_key FROM user_settings WHERE user_id = $1',
      [req.userId]
    );
    const apiKey = settingsR.rows[0]?.gemini_api_key;

    let result;
    if (feed.feed_type === 'classes') {
      result = await syncClassesFeed({ userId: req.userId, feedId, allEvents, apiKey });
    } else {
      result = await syncAssignmentsFeed({ userId: req.userId, feedId, allEvents, apiKey, daysAhead: parseInt(daysAhead) || 28 });
    }

    await markFeedStatus(feedId, 'ok');
    res.json(result);
  } catch (err) {
    console.error('Sync error:', err);
    await markFeedError(feedId, err.message).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------
// CLASSES sync — extract subjects, create them if new
// ----------------------------------------------------------
async function syncClassesFeed({ userId, feedId, allEvents, apiKey }) {
  if (!apiKey) {
    // Without AI, fall back to simple dedup-by-summary
    const seen = new Set();
    const created = [];
    for (const e of allEvents) {
      const name = (e.summary || '').trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      // Skip obvious non-classes
      if (/^(lunch|free|study hall|advisory|chapel|assembly|break|holiday|recess)/i.test(name)) continue;
      const existing = await pool.query(
        'SELECT id FROM subjects WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
        [userId, name]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO subjects (user_id, name, color) VALUES ($1, $2, $3)',
          [userId, name, '#d4a857']
        );
        created.push(name);
      }
    }
    return {
      ai_used: false,
      created: created.length,
      skipped: 0,
      message: `Found ${created.length} new class${created.length === 1 ? '' : 'es'} (simple mode — connect AI for better names).`
    };
  }

  // AI extraction
  const extracted = await extractSubjects(apiKey, allEvents);
  let createdCount = 0;
  let updatedCount = 0;
  const palette = ['#d4a857', '#e08667', '#b8c9e0', '#8fb67c', '#c9a3d4', '#f0c274', '#7ab0c4', '#d68aa3', '#a8b87c', '#9cabbf'];

  // Get existing subjects to count toward palette assignment
  const existingR = await pool.query('SELECT id, name FROM subjects WHERE user_id = $1', [userId]);
  const existingByName = new Map(existingR.rows.map(s => [s.name.toLowerCase(), s]));
  let colorIdx = existingR.rows.length;

  for (const c of extracted) {
    const lookup = existingByName.get(c.name.toLowerCase());
    if (lookup) {
      // Update teacher/room only if currently empty
      await pool.query(`
        UPDATE subjects
           SET teacher = COALESCE(teacher, $1),
               room    = COALESCE(room, $2)
         WHERE id = $3
      `, [c.teacher, c.room, lookup.id]);
      updatedCount++;
    } else {
      const color = palette[colorIdx % palette.length];
      await pool.query(
        'INSERT INTO subjects (user_id, name, color, teacher, room) VALUES ($1, $2, $3, $4, $5)',
        [userId, c.name, color, c.teacher, c.room]
      );
      createdCount++;
      colorIdx++;
    }
  }

  return {
    ai_used: true,
    created: createdCount,
    skipped: updatedCount,
    message: `${createdCount} new class${createdCount === 1 ? '' : 'es'} added${updatedCount > 0 ? `, ${updatedCount} existing class${updatedCount === 1 ? '' : 'es'} updated` : ''}.`
  };
}

// ----------------------------------------------------------
// ASSIGNMENTS sync — transform with AI, dedupe, create tasks
// ----------------------------------------------------------
async function syncAssignmentsFeed({ userId, feedId, allEvents, apiKey, daysAhead }) {
  // Filter to events in window
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + daysAhead);

  const windowEvents = allEvents.filter(e => {
    if (!e.start || !e.start.date) return false;
    const eventDate = new Date(e.start.date + 'T00:00:00');
    return eventDate >= yesterday && eventDate <= windowEnd;
  });

  // Filter out already-imported UIDs
  const existing = await pool.query('SELECT ical_uid FROM ical_imported WHERE user_id = $1', [userId]);
  const existingUids = new Set(existing.rows.map(r => r.ical_uid));
  const newEvents = windowEvents.filter(e => !existingUids.has(e.uid));

  if (newEvents.length === 0) {
    return {
      ai_used: false,
      created: 0,
      skipped: windowEvents.length,
      message: `All ${windowEvents.length} events in the next ${daysAhead} days are already imported.`
    };
  }

  // Get subjects for matching
  const subjR = await pool.query('SELECT id, name, teacher FROM subjects WHERE user_id = $1', [userId]);
  const subjects = subjR.rows;

  // Transform via AI in batches
  let tasks = [];
  let aiUsed = false;
  if (apiKey) {
    try {
      for (let i = 0; i < newEvents.length; i += 25) {
        const batch = newEvents.slice(i, i + 25);
        const batchTasks = await transformAssignments(apiKey, batch, subjects);
        for (let j = 0; j < batchTasks.length && j < batch.length; j++) {
          tasks.push({ ...batchTasks[j], _uid: batch[j].uid });
        }
      }
      aiUsed = true;
    } catch (err) {
      console.error('AI transform failed, using fallback:', err.message);
      tasks = simpleConvert(newEvents, subjects);
    }
  } else {
    tasks = simpleConvert(newEvents, subjects);
  }

  // Insert tasks transactionally
  const client = await pool.connect();
  let createdCount = 0;
  try {
    await client.query('BEGIN');
    for (const t of tasks) {
      if (!t._uid) continue;
      const ins = await client.query(`
        INSERT INTO tasks (user_id, subject_id, title, description, type, due_date, due_time, priority)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
      `, [
        userId, t.subject_id || null, t.title, t.description || null,
        t.type || 'assignment', t.due_date || null, t.due_time || null, t.priority || 'medium'
      ]);
      const taskId = ins.rows[0].id;
      await client.query(`
        INSERT INTO ical_imported (user_id, feed_id, ical_uid, task_id) VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, ical_uid) DO NOTHING
      `, [userId, feedId, t._uid, taskId]);
      createdCount++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    ai_used: aiUsed,
    created: createdCount,
    skipped: windowEvents.length - newEvents.length,
    message: `${createdCount} new task${createdCount === 1 ? '' : 's'} imported${aiUsed ? ' (AI-organized)' : ''}.`
  };
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
    // Detect tests/quizzes by keyword
    let type = 'assignment';
    let priority = 'medium';
    const lower = (e.summary + ' ' + (e.description || '')).toLowerCase();
    if (/\b(test|exam|midterm|final)\b/.test(lower)) { type = 'exam'; priority = 'high'; }
    else if (/\bquiz\b/.test(lower)) { type = 'quiz'; priority = 'high'; }
    else if (/\b(essay|paper|write|writing)\b/.test(lower)) { type = 'essay'; priority = 'high'; }
    else if (/\b(read|reading)\b/.test(lower)) { type = 'reading'; }
    else if (/\bproject\b/.test(lower)) { type = 'project'; priority = 'high'; }
    else if (/\blab\b/.test(lower)) { type = 'lab'; }
    return {
      _uid: e.uid,
      title: title.slice(0, 250),
      description: e.description ? e.description.slice(0, 1000) : null,
      type,
      due_date: e.start?.date || null,
      due_time: e.start?.time || null,
      priority,
      subject_id: subjectId,
    };
  });
}

async function markFeedStatus(feedId, status) {
  await pool.query(
    'UPDATE ical_feeds SET last_synced = CURRENT_TIMESTAMP, last_status = $1, last_error = NULL WHERE id = $2',
    [status, feedId]
  );
}
async function markFeedError(feedId, msg) {
  await pool.query(
    'UPDATE ical_feeds SET last_synced = CURRENT_TIMESTAMP, last_status = $1, last_error = $2 WHERE id = $3',
    ['error', String(msg).slice(0, 500), feedId]
  );
}

module.exports = router;
