const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();
router.use(requireAuth);

// GET /api/tasks — list all tasks with subject info joined
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, s.name AS subject_name, s.color AS subject_color
      FROM tasks t
      LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE t.user_id = $1
      ORDER BY t.completed ASC, t.due_date ASC NULLS LAST, t.created_at DESC
    `, [req.userId]);
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  const { title, description, due_date, due_time, priority, subject_id, type } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    const result = await pool.query(
      `INSERT INTO tasks (user_id, title, description, due_date, due_time, priority, subject_id, type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.userId,
        title,
        description || null,
        due_date || null,
        due_time || null,
        priority || 'medium',
        subject_id || null,
        type || 'assignment'
      ]
    );
    // Re-fetch with subject info
    const full = await pool.query(`
      SELECT t.*, s.name AS subject_name, s.color AS subject_color
      FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE t.id = $1
    `, [result.rows[0].id]);
    res.json({ task: full.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, due_date, due_time, completed, priority, subject_id, type } = req.body;
  try {
    const check = await pool.query('SELECT user_id FROM tasks WHERE id = $1', [id]);
    if (check.rows.length === 0 || check.rows[0].user_id !== req.userId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const fields = [];
    const values = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (due_date !== undefined) { fields.push(`due_date = $${idx++}`); values.push(due_date); }
    if (due_time !== undefined) { fields.push(`due_time = $${idx++}`); values.push(due_time); }
    if (priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(priority); }
    if (subject_id !== undefined) { fields.push(`subject_id = $${idx++}`); values.push(subject_id); }
    if (type !== undefined) { fields.push(`type = $${idx++}`); values.push(type); }
    if (completed !== undefined) {
      fields.push(`completed = $${idx++}`); values.push(completed);
      fields.push(`completed_at = $${idx++}`); values.push(completed ? new Date() : null);
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    await pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    const full = await pool.query(`
      SELECT t.*, s.name AS subject_name, s.color AS subject_color
      FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE t.id = $1
    `, [id]);
    res.json({ task: full.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/auto-link — bulk-link tasks with NULL subject_id using AI/keywords
// Body: { matches: [{ id, subject_id }, ...] }  — frontend computes via local matcher
router.post('/auto-link', async (req, res) => {
  const { matches } = req.body || {};
  if (!Array.isArray(matches) || matches.length === 0) {
    return res.status(400).json({ error: 'No matches provided' });
  }
  const client = await pool.connect();
  let linked = 0;
  try {
    await client.query('BEGIN');
    for (const m of matches) {
      const id = parseInt(m.id);
      const sid = parseInt(m.subject_id);
      if (!Number.isInteger(id) || !Number.isInteger(sid)) continue;
      const r = await client.query(
        'UPDATE tasks SET subject_id = $1 WHERE id = $2 AND user_id = $3 AND subject_id IS NULL RETURNING id',
        [sid, id, req.userId]
      );
      if (r.rows.length > 0) linked++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    client.release();
    return res.status(500).json({ error: 'Server error' });
  }
  client.release();
  res.json({ ok: true, linked });
});

module.exports = router;
