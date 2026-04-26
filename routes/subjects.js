const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();
router.use(requireAuth);

// GET /api/subjects — list user's subjects with task counts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        COUNT(t.id) FILTER (WHERE t.completed = FALSE) AS open_tasks,
        COUNT(t.id) AS total_tasks
      FROM subjects s
      LEFT JOIN tasks t ON t.subject_id = s.id
      WHERE s.user_id = $1
      GROUP BY s.id
      ORDER BY s.name ASC
    `, [req.userId]);
    res.json({ subjects: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/subjects
router.post('/', async (req, res) => {
  const { name, color, teacher, room } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = await pool.query(
      `INSERT INTO subjects (user_id, name, color, teacher, room)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, name, color || '#d4a857', teacher || null, room || null]
    );
    res.json({ subject: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/subjects/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color, teacher, room } = req.body;
  try {
    const check = await pool.query('SELECT user_id FROM subjects WHERE id = $1', [id]);
    if (check.rows.length === 0 || check.rows[0].user_id !== req.userId) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); values.push(color); }
    if (teacher !== undefined) { fields.push(`teacher = $${idx++}`); values.push(teacher); }
    if (room !== undefined) { fields.push(`room = $${idx++}`); values.push(room); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const result = await pool.query(
      `UPDATE subjects SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json({ subject: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/subjects/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM subjects WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
