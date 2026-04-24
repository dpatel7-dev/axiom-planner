const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();
router.use(requireAuth);

// GET /api/reminders
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reminders WHERE user_id = $1 ORDER BY remind_at ASC',
      [req.userId]
    );
    res.json({ reminders: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reminders/due — reminders that are due now but not yet notified
router.get('/due', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM reminders WHERE user_id = $1 AND notified = FALSE AND remind_at <= CURRENT_TIMESTAMP`,
      [req.userId]
    );
    // Mark as notified
    if (result.rows.length > 0) {
      const ids = result.rows.map(r => r.id);
      await pool.query(`UPDATE reminders SET notified = TRUE WHERE id = ANY($1::int[])`, [ids]);
    }
    res.json({ reminders: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reminders
router.post('/', async (req, res) => {
  const { title, remind_at } = req.body;
  if (!title || !remind_at) return res.status(400).json({ error: 'Title and remind_at required' });
  try {
    const result = await pool.query(
      'INSERT INTO reminders (user_id, title, remind_at) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, title, remind_at]
    );
    res.json({ reminder: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
