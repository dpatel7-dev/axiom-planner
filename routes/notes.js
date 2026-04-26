const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();
router.use(requireAuth);

// GET /api/notes — with subject join
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, s.name AS subject_name, s.color AS subject_color
      FROM notes n
      LEFT JOIN subjects s ON s.id = n.subject_id
      WHERE n.user_id = $1
      ORDER BY n.updated_at DESC
    `, [req.userId]);
    res.json({ notes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notes
router.post('/', async (req, res) => {
  const { title, content, subject_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO notes (user_id, title, content, subject_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, title || 'Untitled', content || '', subject_id || null]
    );
    const full = await pool.query(`
      SELECT n.*, s.name AS subject_name, s.color AS subject_color
      FROM notes n LEFT JOIN subjects s ON s.id = n.subject_id
      WHERE n.id = $1
    `, [result.rows[0].id]);
    res.json({ note: full.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notes/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content, subject_id } = req.body;
  try {
    const check = await pool.query('SELECT user_id FROM notes WHERE id = $1', [id]);
    if (check.rows.length === 0 || check.rows[0].user_id !== req.userId) {
      return res.status(404).json({ error: 'Note not found' });
    }
    const fields = [];
    const values = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (content !== undefined) { fields.push(`content = $${idx++}`); values.push(content); }
    if (subject_id !== undefined) { fields.push(`subject_id = $${idx++}`); values.push(subject_id); }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    if (fields.length === 1) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    await pool.query(`UPDATE notes SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    const full = await pool.query(`
      SELECT n.*, s.name AS subject_name, s.color AS subject_color
      FROM notes n LEFT JOIN subjects s ON s.id = n.subject_id
      WHERE n.id = $1
    `, [id]);
    res.json({ note: full.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
