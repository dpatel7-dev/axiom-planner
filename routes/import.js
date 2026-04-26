const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');
const { parseICS } = require('../lib/ics-parser');
const { transformEvents, testApiKey } = require('../lib/gemini');

const router = express.Router();
router.use(requireAuth);

// ----------------------------------------------------------
// Settings (Gemini API key)
// ----------------------------------------------------------

// GET /api/import/settings — returns whether AI key is configured (never returns the key itself)
router.get('/settings', async (req, res) => {
  try {
    const r = await pool.query('SELECT ai_enabled, gemini_api_key IS NOT NULL AS has_key FROM user_settings WHERE user_id = $1', [req.userId]);
    if (r.rows.length === 0) {
      return res.json({ ai_enabled: false, has_key: false });
    }
    res.json({ ai_enabled: r.rows[0].ai_enabled, has_key: r.rows[0].has_key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/import/settings — save Gemini API key
router.post('/settings', async (req, res) => {
  const { gemini_api_key } = req.body;
  if (!gemini_api_key) return res.status(400).json({ error: 'API key required' });
  try {
    // Validate the key works
    await testApiKey(gemini_api_key);
    // Upsert
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

// DELETE /api/import/settings — remove API key
router.delete('/settings', async (req, res) => {
  await pool.query('UPDATE user_settings SET gemini_api_key = NULL, ai_enabled = FALSE WHERE user_id = $1', [req.userId]);
  res.json({ ok: true });
});

// ----------------------------------------------------------
// ICS Feeds
// ----------------------------------------------------------

// GET /api/import/feeds
router.get('/feeds', async (req, res) => {
  try {
    const r = await pool.query('SELECT id, label, url, last_synced, last_status, last_error, created_at FROM ical_feeds WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
    res.json({ feeds: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/import/feeds — add a new feed
router.post('/feeds', async (req, res) => {
  let { url, label } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  url = url.trim();
  // Convert webcal:// to https:// (Mac Calendar gives webcal URLs)
  if (url.startsWith('webcal://')) url = 'https://' + url.slice('webcal://'.length);
  if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'URL must start with http://, https://, or webcal://' });
  try {
    const r = await pool.query(
      'INSERT INTO ical_feeds (user_id, url, label) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, url, label || 'School Calendar']
    );
    res.json({ feed: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/import/feeds/:id
router.delete('/feeds/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM ical_feeds WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Feed not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------
// Sync — fetch ICS, parse, transform with AI, create tasks
// ----------------------------------------------------------

// POST /api/import/feeds/:id/sync
router.post('/feeds/:id/sync', async (req, res) => {
  const feedId = req.params.id;
  const { useAi = true, daysAhead = 21 } = req.body || {};

  try {
    // Get feed
    const feedR = await pool.query('SELECT * FROM ical_feeds WHERE id = $1 AND user_id = $2', [feedId, req.userId]);
    if (feedR.rows.length === 0) return res.status(404).json({ error: 'Feed not found' });
    const feed = feedR.rows[0];

    // Fetch the ICS
    let icsText;
    try {
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': 'Axiom-Planner/1.0', 'Accept': 'text/calendar, text/plain' }
      });
      if (!r.ok) throw new Error(`Fetch failed: HTTP ${r.status}`);
      icsText = await r.text();
    } catch (err) {
      await pool.query('UPDATE ical_feeds SET last_synced = CURRENT_TIMESTAMP, last_status = $1, last_error = $2 WHERE id = $3',
        ['error', err.message.slice(0, 500), feedId]);
      return res.status(400).json({ error: 'Could not fetch calendar: ' + err.message });
    }

    // Parse events
    const allEvents = parseICS(icsText);
    if (allEvents.length === 0) {
      await pool.query('UPDATE ical_feeds SET last_synced = CURRENT_TIMESTAMP, last_status = $1, last_error = NULL WHERE id = $2',
        ['empty', feedId]);
      return res.json({ created: 0, skipped: 0, message: 'No events found in calendar.' });
    }

    // Filter to events in window: from yesterday up to N days ahead
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + (parseInt(daysAhead) || 21));

    const windowEvents = allEvents.filter(e => {
      if (!e.start || !e.start.date) return false;
      const eventDate = new Date(e.start.date + 'T00:00:00');
      return eventDate >= yesterday && eventDate <= windowEnd;
    });

    // Filter out already-imported UIDs
    const existing = await pool.query('SELECT ical_uid FROM ical_imported WHERE user_id = $1', [req.userId]);
    const existingUids = new Set(existing.rows.map(r => r.ical_uid));
    const newEvents = windowEvents.filter(e => !existingUids.has(e.uid));

    if (newEvents.length === 0) {
      await pool.query('UPDATE ical_feeds SET last_synced = CURRENT_TIMESTAMP, last_status = $1, last_error = NULL WHERE id = $2',
        ['ok', feedId]);
      return res.json({
        created: 0,
        skipped: windowEvents.length,
        message: `All ${windowEvents.length} events in the next ${daysAhead} days are already imported.`
      });
    }

    // Get user's subjects for AI matching
    const subjR = await pool.query('SELECT id, name FROM subjects WHERE user_id = $1', [req.userId]);
    const subjects = subjR.rows;

    // Either AI-transform or simple-convert
    let tasks;
    let aiUsed = false;
    if (useAi) {
      const settingsR = await pool.query('SELECT gemini_api_key FROM user_settings WHERE user_id = $1', [req.userId]);
      const apiKey = settingsR.rows[0]?.gemini_api_key;
      if (apiKey) {
        try {
          // Process in batches of 25 to keep prompts manageable
          tasks = [];
          for (let i = 0; i < newEvents.length; i += 25) {
            const batch = newEvents.slice(i, i + 25);
            const batchTasks = await transformEvents(apiKey, batch, subjects);
            // Pair tasks back to source events for UID tracking
            // The AI may have skipped some (returned skip:true), so track by index
            // We can't perfectly match without indexes; instead, attach the source UID
            // by index assuming order is preserved (we instructed it to preserve order)
            for (let j = 0; j < batchTasks.length && j < batch.length; j++) {
              tasks.push({ ...batchTasks[j], _uid: batch[j].uid });
            }
          }
          aiUsed = true;
        } catch (err) {
          console.error('AI transform failed, falling back to simple:', err);
          tasks = simpleConvert(newEvents, subjects);
        }
      } else {
        tasks = simpleConvert(newEvents, subjects);
      }
    } else {
      tasks = simpleConvert(newEvents, subjects);
    }

    // Insert tasks + track imported UIDs (transactional)
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
          req.userId,
          t.subject_id || null,
          t.title,
          t.description || null,
          t.type || 'assignment',
          t.due_date || null,
          t.due_time || null,
          t.priority || 'medium'
        ]);
        const taskId = ins.rows[0].id;
        await client.query(`
          INSERT INTO ical_imported (user_id, feed_id, ical_uid, task_id) VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, ical_uid) DO NOTHING
        `, [req.userId, feedId, t._uid, taskId]);
        createdCount++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await pool.query('UPDATE ical_feeds SET last_synced = CURRENT_TIMESTAMP, last_status = $1, last_error = NULL WHERE id = $2',
      ['ok', feedId]);

    res.json({
      created: createdCount,
      skipped: windowEvents.length - newEvents.length,
      total_events: allEvents.length,
      ai_used: aiUsed,
      message: `Imported ${createdCount} new task${createdCount === 1 ? '' : 's'}${aiUsed ? ' (AI-transformed)' : ''}.`
    });
  } catch (err) {
    console.error('Sync error:', err);
    await pool.query('UPDATE ical_feeds SET last_synced = CURRENT_TIMESTAMP, last_status = $1, last_error = $2 WHERE id = $3',
      ['error', err.message.slice(0, 500), feedId]).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// Fallback: convert events to tasks without AI
function simpleConvert(events, subjects) {
  return events.map(e => {
    let title = e.summary || 'Calendar event';
    let subjectId = null;
    // Try to match a subject by name appearing in the title
    for (const s of subjects) {
      if (title.toLowerCase().includes(s.name.toLowerCase())) {
        subjectId = s.id;
        // Strip "ClassName:" prefix if present
        const re = new RegExp('^' + s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:?\\s*', 'i');
        title = title.replace(re, '').trim() || title;
        break;
      }
    }
    return {
      _uid: e.uid,
      title: title.slice(0, 250),
      description: e.description ? e.description.slice(0, 1000) : null,
      type: 'assignment',
      due_date: e.start?.date || null,
      due_time: e.start?.time || null,
      priority: 'medium',
      subject_id: subjectId,
    };
  });
}

module.exports = router;
