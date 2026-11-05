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
 * - A request is also accepted when the browser itself reports that it came
 *   from one of this site's own pages (Sec-Fetch-Site: same-origin). Web pages
 *   can't set or fake that header, and other sites' requests are labelled
 *   cross-site, so this keeps the protection while sparing real visitors a
 *   refusal when their token is out of date or their cookies are blocked.
 *   Logging in is still required separately for anything in the admin.
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
  if (req.get('sec-fetch-site') === 'same-origin') return next();

  return res.status(403).json({
    code: 'CSRF_INVALID', // public/js/csrf-retry.js recovers from this by itself
    error: 'Your session expired. Please refresh the page and try again.'
  });
}

module.exports = csrf;
