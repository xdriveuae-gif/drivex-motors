'use strict';

/**
 * CSRF protection — synchronizer-token pattern (replaces the deprecated
 * `csurf` package, which has a published advisory and is unmaintained).
 *
 * - A random token is stored in the session and exposed to templates via
 *   res.locals.csrfToken (rendered into <meta name="csrf-token"> + hidden
 *   form fields).
 * - Mutating requests (POST/PUT/PATCH/DELETE) must echo it back, either in
 *   the `X-CSRF-Token` header (used by all our fetch() calls — works for
 *   multipart uploads too) or a `_csrf` body field.
 * - Comparison is constant-time.
 *
 * Must be mounted AFTER express-session and the body parsers.
 */

const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (_e) {
    return false;
  }
}

function csrf(req, res, next) {
  // Session is required; if it's missing something is wired wrong upstream.
  if (!req.session) return next();

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE_METHODS.has(req.method)) return next();

  const sent =
    req.get('x-csrf-token') ||
    (req.body && (req.body._csrf || req.body.csrf)) ||
    '';

  if (constantTimeEqual(sent, req.session.csrfToken)) return next();

  return res.status(403).json({
    error: 'Invalid or missing CSRF token. Please refresh the page and try again.'
  });
}

module.exports = csrf;
