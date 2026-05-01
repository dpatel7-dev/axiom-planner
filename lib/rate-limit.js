// ==========================================================
// Rate limiter — in-memory token bucket
// ==========================================================
// Why in-memory? We're on Render free tier (single instance, ~512MB RAM).
// A Map keyed by user+route is plenty. If we ever scale to multiple instances,
// swap this for Redis — same interface.
//
// Each bucket holds N tokens; one token spent per request.
// Tokens refill linearly over `windowMs`. When empty, requests get 429.
// We auto-evict idle keys after 30 minutes to keep the map bounded.

const buckets = new Map();           // key → { tokens, lastRefill }
const EVICT_INTERVAL_MS = 5 * 60 * 1000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

// Periodic cleanup so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets.entries()) {
    if (now - b.lastRefill > IDLE_TIMEOUT_MS) buckets.delete(k);
  }
}, EVICT_INTERVAL_MS).unref();

function getKey(req, scope) {
  // Prefer user ID when authenticated (so one logged-in user can't spread abuse across IPs)
  // Fall back to IP for unauthenticated routes (login/signup)
  const id = req.userId ? `u:${req.userId}` : `ip:${(req.ip || 'unknown').slice(0, 45)}`;
  return `${scope}:${id}`;
}

function tryConsume(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: limit, lastRefill: now };
    buckets.set(key, b);
  } else {
    // Refill proportional to elapsed time
    const elapsed = now - b.lastRefill;
    if (elapsed > 0) {
      const refill = (elapsed / windowMs) * limit;
      b.tokens = Math.min(limit, b.tokens + refill);
      b.lastRefill = now;
    }
  }
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, remaining: Math.floor(b.tokens), retryAfterSec: 0 };
  }
  // How long until 1 token is available?
  const tokensNeeded = 1 - b.tokens;
  const msToWait = (tokensNeeded / limit) * windowMs;
  return { ok: false, remaining: 0, retryAfterSec: Math.ceil(msToWait / 1000) };
}

// Factory: produces an Express middleware enforcing `limit` requests per `windowMs`
function rateLimit({ scope, limit, windowMs, message }) {
  return (req, res, next) => {
    const key = getKey(req, scope);
    const result = tryConsume(key, limit, windowMs);
    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(result.remaining));
    if (!result.ok) {
      res.set('Retry-After', String(result.retryAfterSec));
      return res.status(429).json({
        error: message || 'Too many requests. Please slow down.',
        retry_after_seconds: result.retryAfterSec,
      });
    }
    next();
  };
}

// Pre-configured limiters for common scenarios
const limiters = {
  // AI generation — expensive (real $ per call). Strict.
  aiGenerate: rateLimit({
    scope: 'ai-gen',
    limit: 10,
    windowMs: 60 * 60 * 1000, // 10 per hour per user
    message: 'You\'ve generated a lot of study guides recently. Try again in a bit.',
  }),
  // AI chat — also expensive but more granular
  aiChat: rateLimit({
    scope: 'ai-chat',
    limit: 60,
    windowMs: 60 * 60 * 1000, // 60 per hour per user
    message: 'Whoa, slow down on the questions! Try again in a few minutes.',
  }),
  // Auth — prevent brute force on login/signup. Per-IP (no user yet).
  auth: rateLimit({
    scope: 'auth',
    limit: 8,
    windowMs: 5 * 60 * 1000, // 8 attempts per 5 minutes per IP
    message: 'Too many attempts. Try again in a few minutes.',
  }),
  // Search — keep it snappy but cap firehose abuse
  search: rateLimit({
    scope: 'search',
    limit: 60,
    windowMs: 60 * 1000, // 60 per minute per user
    message: 'Too many searches at once.',
  }),
  // ICS import / sync — moderate (hits external URLs)
  importSync: rateLimit({
    scope: 'import',
    limit: 12,
    windowMs: 10 * 60 * 1000, // 12 per 10 min
    message: 'Sync requests too frequent — auto-sync runs every 10 min.',
  }),
};

module.exports = { rateLimit, limiters };
