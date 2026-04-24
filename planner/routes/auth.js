const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { signToken, requireAuth } = require('./auth-middleware');

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: 'Username min 3 chars, password min 4 chars' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, streak_count, longest_streak, last_active_date)
       VALUES ($1, $2, 1, 1, CURRENT_DATE) RETURNING id, username`,
      [username, hash]
    );
    const user = result.rows[0];
    const token = signToken({ userId: user.id, username: user.username });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    res.json({ user: { id: user.id, username: user.username } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already taken' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update streak based on last active date
    await updateStreak(user.id);

    const token = signToken({ userId: user.id, username: user.username });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    res.json({ user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, username, streak_count, longest_streak, last_active_date FROM users WHERE id = $1',
    [req.userId]
  );
  res.json({ user: result.rows[0] });
});

// Duolingo-style streak logic
async function updateStreak(userId) {
  const result = await pool.query('SELECT streak_count, longest_streak, last_active_date FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!user.last_active_date) {
    // First login ever
    await pool.query(
      'UPDATE users SET streak_count = 1, longest_streak = GREATEST(longest_streak, 1), last_active_date = CURRENT_DATE WHERE id = $1',
      [userId]
    );
    return;
  }

  const lastActive = new Date(user.last_active_date);
  lastActive.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Same day, no change
    return;
  } else if (diffDays === 1) {
    // Consecutive day — increment streak
    const newStreak = user.streak_count + 1;
    await pool.query(
      'UPDATE users SET streak_count = $1, longest_streak = GREATEST(longest_streak, $1), last_active_date = CURRENT_DATE WHERE id = $2',
      [newStreak, userId]
    );
  } else {
    // Broken streak — reset to 1
    await pool.query(
      'UPDATE users SET streak_count = 1, last_active_date = CURRENT_DATE WHERE id = $1',
      [userId]
    );
  }
}

module.exports = router;
