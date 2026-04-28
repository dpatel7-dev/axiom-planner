const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();
router.use(requireAuth);

// GET /api/logos/favorites
router.get('/favorites', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT logo_idx FROM logo_favorites WHERE user_id = $1 ORDER BY created_at ASC',
      [req.userId]
    );
    res.json({ favorites: r.rows.map(x => x.logo_idx) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/logos/favorites — toggle a logo as favorite
router.post('/favorites', async (req, res) => {
  const { logo_idx } = req.body;
  const idx = parseInt(logo_idx);
  if (Number.isNaN(idx) || idx < 0 || idx > 41) {
    return res.status(400).json({ error: 'logo_idx must be 0-41' });
  }
  try {
    // Check if it exists
    const existing = await pool.query(
      'SELECT id FROM logo_favorites WHERE user_id = $1 AND logo_idx = $2',
      [req.userId, idx]
    );
    if (existing.rows.length > 0) {
      // Unfavorite
      await pool.query('DELETE FROM logo_favorites WHERE user_id = $1 AND logo_idx = $2', [req.userId, idx]);
      return res.json({ favorited: false, logo_idx: idx });
    }
    // Check count limit
    const countR = await pool.query('SELECT COUNT(*)::int AS n FROM logo_favorites WHERE user_id = $1', [req.userId]);
    if (countR.rows[0].n >= 5) {
      return res.status(400).json({ error: 'Max 5 favorites. Unfavorite one first.' });
    }
    await pool.query('INSERT INTO logo_favorites (user_id, logo_idx) VALUES ($1, $2)', [req.userId, idx]);
    res.json({ favorited: true, logo_idx: idx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
