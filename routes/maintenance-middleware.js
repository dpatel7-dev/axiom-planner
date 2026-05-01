// Maintenance mode middleware
//
// When enabled, all /api/* requests return 503 EXCEPT:
//   - /api/auth/* (so users can still log in)
//   - /api/maintenance/status (so the maintenance screen can poll it)
//   - /api/maintenance/toggle (so owners can turn it back off)
//   - any request from an authenticated owner (so they can keep working)
//
// The state is cached in memory and refreshed every 30 seconds (or on toggle)
// so we don't hit the DB on every API call.

const { pool } = require('../db');
const { isOwnerUsername } = require('./owner-middleware');

let cachedState = {
  enabled: false,
  message: 'We\'re making things better. Back in a few minutes.',
  fetchedAt: 0,
};
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

async function refreshState() {
  try {
    const r = await pool.query('SELECT enabled, message FROM maintenance_state WHERE id = 1');
    if (r.rows.length > 0) {
      cachedState = {
        enabled: !!r.rows[0].enabled,
        message: r.rows[0].message || cachedState.message,
        fetchedAt: Date.now(),
      };
    }
  } catch (err) {
    // If DB is down, fail open (don't lock people out from a transient DB error)
    console.error('Maintenance state refresh failed:', err.message);
    cachedState.fetchedAt = Date.now();
  }
}

function getCachedState() {
  return { enabled: cachedState.enabled, message: cachedState.message };
}

// Force a refresh (called after toggling)
function invalidateCache() {
  cachedState.fetchedAt = 0;
}

// Express middleware
async function maintenanceMiddleware(req, res, next) {
  // Refresh stale cache
  if (Date.now() - cachedState.fetchedAt > CACHE_TTL_MS) {
    await refreshState();
  }

  if (!cachedState.enabled) return next();

  // Allowed endpoints even during maintenance
  const path = req.path || '';
  const allowedPaths = [
    '/api/auth/login',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/maintenance/status',
    '/api/maintenance/toggle',
  ];
  if (allowedPaths.some(p => req.originalUrl.startsWith(p))) return next();

  // If the user is logged in and an owner, let them through
  if (req.userId) {
    try {
      const r = await pool.query('SELECT username FROM users WHERE id = $1', [req.userId]);
      const username = r.rows[0]?.username;
      if (isOwnerUsername(username)) {
        // Tag the response so the frontend knows we're in owner-bypass mode
        res.set('X-Maintenance-Bypass', 'owner');
        return next();
      }
    } catch {
      // Fall through to maintenance response
    }
  }

  // Block: serve 503 with the configured message
  res.status(503).json({
    maintenance: true,
    message: cachedState.message,
  });
}

// Initial population on startup
refreshState().catch(() => {});

module.exports = { maintenanceMiddleware, getCachedState, invalidateCache, refreshState };
