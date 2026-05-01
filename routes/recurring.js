const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');
const { computeNextDue } = require('../jobs');

const router = express.Router();
router.use(requireAuth);

// GET /api/recurring — list user's rules
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT r.*, s.name AS subject_name, s.color AS subject_color
      FROM recurring_rules r
      LEFT JOIN subjects s ON s.id = (r.task_template->>'subject_id')::int
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `, [req.userId]);
    res.json({ rules: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/recurring — create a new recurring rule
// Body: { task_template: {...}, pattern, pattern_value?, weekdays?, start_date? }
router.post('/', async (req, res) => {
  const { task_template, pattern, pattern_value, weekdays, start_date } = req.body || {};
  if (!task_template || !task_template.title) return res.status(400).json({ error: 'task_template with title required' });
  if (!['daily', 'weekdays', 'weekly', 'every_n_days'].includes(pattern)) {
    return res.status(400).json({ error: 'Invalid pattern' });
  }
  let firstDate = start_date ? new Date(start_date + 'T00:00:00') : new Date();
  // Ensure firstDate fits the pattern
  if (pattern === 'weekdays') {
    while (firstDate.getDay() === 0 || firstDate.getDay() === 6) firstDate.setDate(firstDate.getDate() + 1);
  }
  if (pattern === 'weekly' && weekdays) {
    const allowed = parseWeekdays(weekdays);
    if (allowed.size > 0) {
      while (!allowed.has(firstDate.getDay())) firstDate.setDate(firstDate.getDate() + 1);
    }
  }

  try {
    const r = await pool.query(`
      INSERT INTO recurring_rules (user_id, task_template, pattern, pattern_value, weekdays, next_due)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [req.userId, JSON.stringify(task_template), pattern, pattern_value || null,
        weekdays || null, firstDate.toISOString().slice(0, 10)]);
    res.json({ rule: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/recurring/:id — update (typically to toggle active)
router.patch('/:id', async (req, res) => {
  const { active, task_template, pattern, pattern_value, weekdays } = req.body || {};
  const fields = [];
  const values = [];
  let idx = 1;
  if (active !== undefined) { fields.push(`active = $${idx++}`); values.push(!!active); }
  if (task_template !== undefined) { fields.push(`task_template = $${idx++}`); values.push(JSON.stringify(task_template)); }
  if (pattern !== undefined) { fields.push(`pattern = $${idx++}`); values.push(pattern); }
  if (pattern_value !== undefined) { fields.push(`pattern_value = $${idx++}`); values.push(pattern_value); }
  if (weekdays !== undefined) { fields.push(`weekdays = $${idx++}`); values.push(weekdays); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  values.push(req.userId);
  try {
    const r = await pool.query(
      `UPDATE recurring_rules SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
      values
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ rule: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/recurring/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM recurring_rules WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

function parseWeekdays(str) {
  const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const set = new Set();
  String(str || '').split(',').forEach(s => {
    const k = s.trim().toLowerCase().slice(0, 3);
    if (map[k] !== undefined) set.add(map[k]);
  });
  return set;
}

module.exports = router;
