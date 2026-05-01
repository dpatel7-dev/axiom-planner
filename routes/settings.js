const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();
router.use(requireAuth);

const VALID_GREETING_STYLES = ['warm', 'formal', 'casual', 'minimal'];

// GET /api/settings — full preferences (excluding API key)
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        accent_color, display_name, greeting_style, pinned_logo, rotate_favorites_only,
        show_overdue, show_exams, show_today, show_week, show_reminders_today,
        ai_enabled,
        gemini_api_key IS NOT NULL AS has_gemini_key,
        anthropic_api_key IS NOT NULL AS has_anthropic_key,
        preferred_ai, theme
      FROM user_settings WHERE user_id = $1
    `, [req.userId]);
    if (r.rows.length === 0) {
      return res.json({
        accent_color: '#d4a857',
        display_name: null,
        greeting_style: 'warm',
        pinned_logo: null,
        rotate_favorites_only: false,
        show_overdue: true,
        show_exams: true,
        show_today: true,
        show_week: true,
        show_reminders_today: false,
        ai_enabled: false,
        has_gemini_key: false,
        has_anthropic_key: false,
        preferred_ai: 'gemini',
        theme: 'dawn',
      });
    }
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/settings — update any/all preferences
router.patch('/', async (req, res) => {
  const allowed = [
    'accent_color', 'display_name', 'greeting_style', 'pinned_logo',
    'rotate_favorites_only', 'preferred_ai', 'theme',
    'show_overdue', 'show_exams', 'show_today', 'show_week', 'show_reminders_today'
  ];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  // Validate
  if (updates.accent_color && !/^#[0-9a-fA-F]{6}$/.test(updates.accent_color)) {
    return res.status(400).json({ error: 'Invalid color (must be #rrggbb)' });
  }
  if (updates.greeting_style && !VALID_GREETING_STYLES.includes(updates.greeting_style)) {
    return res.status(400).json({ error: 'Invalid greeting style' });
  }
  if (updates.preferred_ai !== undefined && !['gemini', 'claude'].includes(updates.preferred_ai)) {
    return res.status(400).json({ error: 'preferred_ai must be "gemini" or "claude"' });
  }
  if (updates.theme !== undefined && !['dawn', 'calm'].includes(updates.theme)) {
    return res.status(400).json({ error: 'theme must be "dawn" or "calm"' });
  }
  if (updates.display_name !== undefined && updates.display_name !== null) {
    updates.display_name = String(updates.display_name).slice(0, 80) || null;
  }
  if (updates.pinned_logo !== undefined && updates.pinned_logo !== null) {
    const n = parseInt(updates.pinned_logo);
    if (Number.isNaN(n) || n < 0 || n > 41) {
      return res.status(400).json({ error: 'Logo must be 0-41 or null' });
    }
    updates.pinned_logo = n;
  }
  for (const k of ['show_overdue', 'show_exams', 'show_today', 'show_week', 'show_reminders_today', 'rotate_favorites_only']) {
    if (updates[k] !== undefined) updates[k] = !!updates[k];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    // Make sure a row exists
    await pool.query(
      'INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [req.userId]
    );

    const fields = [];
    const values = [];
    let idx = 1;
    for (const [k, v] of Object.entries(updates)) {
      fields.push(`${k} = $${idx++}`);
      values.push(v);
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.userId);

    await pool.query(
      `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = $${idx}`,
      values
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/anthropic-key — save and validate Claude API key
router.post('/anthropic-key', async (req, res) => {
  const { anthropic_api_key } = req.body || {};
  if (!anthropic_api_key) return res.status(400).json({ error: 'API key required' });
  try {
    const { testClaudeKey } = require('../lib/anthropic');
    await testClaudeKey(anthropic_api_key);
    await pool.query(`
      INSERT INTO user_settings (user_id, anthropic_api_key, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE
      SET anthropic_api_key = $2, updated_at = CURRENT_TIMESTAMP
    `, [req.userId, anthropic_api_key]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/settings/anthropic-key
router.delete('/anthropic-key', async (req, res) => {
  await pool.query(
    'UPDATE user_settings SET anthropic_api_key = NULL WHERE user_id = $1',
    [req.userId]
  );
  res.json({ ok: true });
});

// POST /api/settings/clear-tasks — granular task clearing
// Body: { mode: 'completed' | 'all' | 'subject' | 'date_range', subject_id?, before_date?, after_date? }
router.post('/clear-tasks', async (req, res) => {
  const { mode, subject_id, before_date, after_date } = req.body || {};

  let sql = 'DELETE FROM tasks WHERE user_id = $1';
  const values = [req.userId];
  let idx = 2;

  switch (mode) {
    case 'completed':
      sql += ' AND completed = TRUE';
      break;
    case 'all':
      // No additional filter
      break;
    case 'subject':
      if (!subject_id) return res.status(400).json({ error: 'subject_id required' });
      sql += ` AND subject_id = $${idx++}`;
      values.push(subject_id);
      break;
    case 'date_range':
      if (before_date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(before_date)) {
          return res.status(400).json({ error: 'before_date must be YYYY-MM-DD' });
        }
        sql += ` AND due_date IS NOT NULL AND due_date < $${idx++}`;
        values.push(before_date);
      }
      if (after_date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(after_date)) {
          return res.status(400).json({ error: 'after_date must be YYYY-MM-DD' });
        }
        sql += ` AND due_date IS NOT NULL AND due_date > $${idx++}`;
        values.push(after_date);
      }
      if (!before_date && !after_date) {
        return res.status(400).json({ error: 'Provide before_date or after_date' });
      }
      break;
    default:
      return res.status(400).json({ error: 'Invalid mode' });
  }

  try {
    const r = await pool.query(sql + ' RETURNING id', values);
    res.json({ ok: true, deleted: r.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
