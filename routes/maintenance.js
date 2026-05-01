const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');
const { requireOwner, checkAdminPassword, isOwnerUsername } = require('./owner-middleware');
const { getCachedState, invalidateCache, refreshState } = require('./maintenance-middleware');

const router = express.Router();

// Helper to get a usable IP from the request (handles proxies)
function getClientIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

// Public status — anyone can read whether maintenance is on, and what the message says.
// Used by the frontend to detect maintenance and to poll for "back online" while displayed.
router.get('/status', async (req, res) => {
  // Always read fresh on this endpoint so polling reflects reality quickly
  await refreshState();
  const state = getCachedState();
  res.json({
    enabled: state.enabled,
    message: state.enabled ? state.message : null,
  });
});

// Owner-only status with audit info — requires auth + owner allowlist
router.get('/admin/status', requireAuth, requireOwner, async (req, res) => {
  try {
    const stateR = await pool.query(`
      SELECT m.enabled, m.message, m.enabled_at, m.updated_at, u.username AS enabled_by_username
      FROM maintenance_state m
      LEFT JOIN users u ON u.id = m.enabled_by
      WHERE m.id = 1
    `);
    const state = stateR.rows[0] || { enabled: false, message: null };

    const auditR = await pool.query(`
      SELECT id, username, action, details, ip_address, created_at
      FROM admin_audit_log
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      ...state,
      audit: auditR.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle maintenance mode — requires auth + owner + admin password
// Body: { enabled: boolean, message?: string, admin_password: string }
router.post('/toggle', requireAuth, requireOwner, async (req, res) => {
  const { enabled, message, admin_password } = req.body || {};

  // Verify admin password (second factor)
  if (!checkAdminPassword(admin_password)) {
    // Log the failed attempt
    try {
      await pool.query(`
        INSERT INTO admin_audit_log (user_id, username, action, details, ip_address)
        VALUES ($1, $2, $3, $4, $5)
      `, [req.userId, req.ownerUsername, 'maintenance_toggle_denied', 'Wrong admin password', getClientIP(req)]);
    } catch {}
    // Don't say WHICH thing was wrong — generic error message
    return res.status(403).json({ error: 'Admin password incorrect' });
  }

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: '"enabled" must be true or false' });
  }

  // Sanitize message
  let cleanMessage = null;
  if (typeof message === 'string') {
    cleanMessage = message.trim().slice(0, 500);
    if (cleanMessage.length === 0) cleanMessage = null;
  }

  try {
    if (enabled) {
      const messageToUse = cleanMessage || 'We\'re making things better. Back in a few minutes.';
      await pool.query(`
        UPDATE maintenance_state
        SET enabled = TRUE, message = $1, enabled_at = CURRENT_TIMESTAMP, enabled_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `, [messageToUse, req.userId]);
      await pool.query(`
        INSERT INTO admin_audit_log (user_id, username, action, details, ip_address)
        VALUES ($1, $2, 'maintenance_on', $3, $4)
      `, [req.userId, req.ownerUsername, messageToUse, getClientIP(req)]);
    } else {
      await pool.query(`
        UPDATE maintenance_state
        SET enabled = FALSE, enabled_at = NULL, enabled_by = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);
      await pool.query(`
        INSERT INTO admin_audit_log (user_id, username, action, details, ip_address)
        VALUES ($1, $2, 'maintenance_off', NULL, $3)
      `, [req.userId, req.ownerUsername, getClientIP(req)]);
    }

    invalidateCache();
    await refreshState();
    res.json({ ok: true, ...getCachedState() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Quick check: am I (current user) an owner?
// Used by the frontend to decide whether to show the maintenance toggle UI
router.get('/whoami', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT username FROM users WHERE id = $1', [req.userId]);
    const username = r.rows[0]?.username;
    res.json({
      username,
      is_owner: isOwnerUsername(username),
      // Tell frontend whether the admin password env var is set
      admin_password_configured: !!process.env.ADMIN_PASSWORD,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
