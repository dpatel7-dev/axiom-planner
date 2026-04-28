const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();
router.use(requireAuth);

// GET /api/stats/today — completed today / total due today / best record
router.get('/today', async (req, res) => {
  try {
    // Tasks completed today
    const completedR = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM tasks
      WHERE user_id = $1
        AND completed = TRUE
        AND completed_at::date = CURRENT_DATE
    `, [req.userId]);
    const completedToday = completedR.rows[0].n;

    // Total tasks due today (open + completed) — denominator for the ring
    const dueR = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM tasks
      WHERE user_id = $1 AND due_date = CURRENT_DATE
    `, [req.userId]);
    const dueToday = dueR.rows[0].n;

    // Best-day record from settings
    const bestR = await pool.query(`
      SELECT best_day_count, best_day_date FROM user_settings WHERE user_id = $1
    `, [req.userId]);
    let bestCount = bestR.rows[0]?.best_day_count || 0;
    let bestDate = bestR.rows[0]?.best_day_date || null;

    // If today's count beats the record, persist it
    if (completedToday > bestCount) {
      bestCount = completedToday;
      bestDate = new Date().toISOString().slice(0, 10);
      await pool.query(`
        INSERT INTO user_settings (user_id, best_day_count, best_day_date)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE
          SET best_day_count = $2, best_day_date = $3, updated_at = CURRENT_TIMESTAMP
      `, [req.userId, bestCount, bestDate]);
    }

    res.json({
      completed_today: completedToday,
      due_today: dueToday,
      best_day_count: bestCount,
      best_day_date: bestDate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
