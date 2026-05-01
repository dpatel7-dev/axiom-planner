const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');
const { limiters } = require('../lib/rate-limit');

const router = express.Router();
router.use(requireAuth);

// GET /api/search?q=query — search tasks, classes, notes
router.get('/', limiters.search, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 1) return res.json({ results: [] });
  const like = `%${q.replace(/[%_]/g, '\\$&')}%`;
  try {
    const [tasksR, subjectsR, notesR] = await Promise.all([
      pool.query(`
        SELECT t.id, t.title, t.due_date, t.completed, t.type, s.name AS subject_name, s.color AS subject_color
        FROM tasks t
        LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE t.user_id = $1
          AND (t.title ILIKE $2 OR t.description ILIKE $2)
        ORDER BY t.completed ASC, t.due_date ASC NULLS LAST
        LIMIT 12
      `, [req.userId, like]),
      pool.query(`
        SELECT id, name, teacher, room, color
        FROM subjects
        WHERE user_id = $1
          AND (name ILIKE $2 OR teacher ILIKE $2)
        LIMIT 8
      `, [req.userId, like]),
      pool.query(`
        SELECT n.id, n.title, LEFT(n.content, 80) AS preview, s.name AS subject_name, s.color AS subject_color
        FROM notes n
        LEFT JOIN subjects s ON s.id = n.subject_id
        WHERE n.user_id = $1
          AND (n.title ILIKE $2 OR n.content ILIKE $2)
        ORDER BY n.updated_at DESC
        LIMIT 8
      `, [req.userId, like]),
    ]);

    const results = [];
    tasksR.rows.forEach(t => {
      results.push({
        kind: 'task',
        id: t.id,
        title: t.title,
        sub: [t.subject_name, t.due_date && t.due_date.toISOString().slice(0, 10)].filter(Boolean).join(' · ') || null,
        completed: t.completed,
        type: t.type,
        color: t.subject_color,
      });
    });
    subjectsR.rows.forEach(s => {
      results.push({
        kind: 'class',
        id: s.id,
        title: s.name,
        sub: [s.teacher, s.room].filter(Boolean).join(' · ') || null,
        color: s.color,
      });
    });
    notesR.rows.forEach(n => {
      results.push({
        kind: 'note',
        id: n.id,
        title: n.title || 'Untitled',
        sub: n.preview ? n.preview.replace(/\s+/g, ' ').slice(0, 60) : null,
        color: n.subject_color,
      });
    });

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
