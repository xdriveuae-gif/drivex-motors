'use strict';

/** Session-based authentication guards for the admin area. */

function wantsJson(req) {
  return (
    req.xhr ||
    req.path.includes('/api/') ||
    req.get('x-requested-with') === 'XMLHttpRequest' ||
    (req.get('accept') || '').includes('application/json')
  );
}

/** Block a route unless a valid admin session exists. */
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();

  if (wantsJson(req)) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  const next_ = encodeURIComponent(req.originalUrl || '/admin/dashboard');
  return res.redirect(`/admin/login?next=${next_}`);
}

/** Keep logged-in admins away from the login page. */
function redirectIfAuthed(req, res, next) {
  if (req.session && req.session.adminId) return res.redirect('/admin/dashboard');
  return next();
}

module.exports = { requireAuth, redirectIfAuthed, wantsJson };
