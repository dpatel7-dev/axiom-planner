const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();
router.use(requireAuth);

// POST /api/focus/start — begin a focus session
router.post('/start', async (req, res) => {
  const { task_id, duration_minutes } = req.body || {};
  const dur = parseInt(duration_minutes);
  if (!Number.isInteger(dur) || dur < 1 || dur > 240) {
    return res.status(400).json({ error: 'duration_minutes must be 1-240' });
  }
  try {
    const r = await pool.query(`
      INSERT INTO focus_sessions (user_id, task_id, duration_minutes, started_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *
    `, [req.userId, task_id || null, dur]);
    res.json({ session: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/focus/:id/end — finish (or cancel) a session
router.post('/:id/end', async (req, res) => {
  const { completed } = req.body || {};
  try {
    const r = await pool.query(`
      UPDATE focus_sessions
      SET completed = $1, ended_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3 AND ended_at IS NULL
      RETURNING *
    `, [!!completed, req.params.id, req.userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Session not found or already ended' });
    res.json({ session: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/focus/today — total focus minutes today + count
router.get('/today', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)::int AS sessions,
        COALESCE(SUM(duration_minutes), 0)::int AS minutes
      FROM focus_sessions
      WHERE user_id = $1 AND completed = TRUE
        AND started_at::date = CURRENT_DATE
    `, [req.userId]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/focus/by-task/:task_id — total focus on a task
router.get('/by-task/:task_id', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)::int AS sessions,
        COALESCE(SUM(duration_minutes), 0)::int AS minutes
      FROM focus_sessions
      WHERE user_id = $1 AND task_id = $2 AND completed = TRUE
    `, [req.userId, req.params.task_id]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
