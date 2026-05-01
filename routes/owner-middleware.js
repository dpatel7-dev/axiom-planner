// Owner detection — owners are listed in OWNER_USERNAMES env var (comma-separated)
// They have admin powers like toggling maintenance mode.
//
// Set in Render's environment:
//   OWNER_USERNAMES=dpatel,someotheradmin
//
// And separately:
//   ADMIN_PASSWORD=<something long and random>
//
// The admin password is required as a second factor for destructive admin actions.

const { pool } = require('../db');

function getOwnerUsernames() {
  const raw = process.env.OWNER_USERNAMES || '';
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function isOwnerUsername(username) {
  if (!username) return false;
  const owners = getOwnerUsernames();
  return owners.includes(String(username).toLowerCase());
}

// Express middleware: requires that req.userId is set (auth middleware ran first)
// and that the logged-in user's username is on the owner allowlist.
async function requireOwner(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Auth required' });
  try {
    const r = await pool.query('SELECT username FROM users WHERE id = $1', [req.userId]);
    if (r.rows.length === 0) return res.status(401).json({ error: 'Auth required' });
    const username = r.rows[0].username;
    if (!isOwnerUsername(username)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    req.ownerUsername = username;
    next();
  } catch (err) {
    console.error('Owner check failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// Validates the admin password from req.body.admin_password against ADMIN_PASSWORD env var.
// Uses constant-time comparison to avoid timing attacks.
const crypto = require('crypto');
function checkAdminPassword(submitted) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // never accept if env not set
  if (!submitted || typeof submitted !== 'string') return false;
  // Compare as same-length buffers
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { isOwnerUsername, requireOwner, checkAdminPassword, getOwnerUsernames };
