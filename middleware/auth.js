'use strict';

/** Session-based authentication guards and role checks for the admin area. */

const crypto = require('crypto');
const db = require('../database/db');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Roles that can change data. They must use an authenticator; anything else is read-only.
const EDIT_ROLES = new Set(['admin', 'editor']);
const canEdit = (admin) => EDIT_ROLES.has(admin.role);
const mustEnroll = (admin) => canEdit(admin) && !admin.totpEnabled;

function wantsJson(req) {
  return (
    req.xhr ||
    req.path.includes('/api/') ||
    req.get('x-requested-with') === 'XMLHttpRequest' ||
    (req.get('accept') || '').includes('application/json')
  );
}

/** Fingerprint of the login secrets: changing a password or authenticator invalidates older sessions. */
function sessionTag(admin) {
  const secret = admin.totp_enabled ? admin.totp_secret : '';
  return crypto.createHash('sha256').update(`${admin.password_hash}|${secret}`).digest('hex').slice(0, 32);
}

/** Looked up on every request so deleted users and role changes apply immediately. */
function loadAdmin(req) {
  if (!req.session || !req.session.adminId) return null;
  const admin = db
    .prepare('SELECT id, username, role, password_hash, totp_enabled, totp_secret FROM admins WHERE id = ?')
    .get(req.session.adminId);
  if (!admin || req.session.adminPwTag !== sessionTag(admin)) return null;
  return { id: admin.id, username: admin.username, role: admin.role, totpEnabled: Boolean(admin.totp_enabled) };
}

function rejectUnauthenticated(req, res) {
  if (req.session && req.session.adminId) {
    delete req.session.adminId;
    delete req.session.adminUser;
    delete req.session.adminPwTag;
  }
  if (wantsJson(req)) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  const next_ = encodeURIComponent(req.originalUrl || '/admin/dashboard');
  return res.redirect(`/admin/login?next=${next_}`);
}

/** Admins and editors must finish authenticator setup before they can use anything else. */
function blockUntilEnrolled(req, res) {
  if (wantsJson(req)) {
    return res.status(403).json({ error: 'Set up two-factor login first.', twoFactorRequired: true });
  }
  return res.redirect('/admin/two-factor');
}

/** Any signed-in user, even before setup. Only for account pages like two-factor setup. */
function requireSession(req, res, next) {
  const admin = loadAdmin(req);
  if (!admin) return rejectUnauthenticated(req, res);
  req.admin = admin;
  return next();
}

/**
 * Block a route unless a valid session exists. Viewers are read-only: every
 * change made through a guarded route is refused here, so a new endpoint is
 * protected by default.
 */
function requireAuth(req, res, next) {
  const admin = loadAdmin(req);
  if (!admin) return rejectUnauthenticated(req, res);
  req.admin = admin;
  if (mustEnroll(admin)) return blockUntilEnrolled(req, res);
  if (!canEdit(admin) && !SAFE_METHODS.has(req.method)) {
    return res.status(403).json({ error: 'Your account is view-only.' });
  }
  return next();
}

/** Pages for adding and editing content: admins and editors. */
function requireEditor(req, res, next) {
  const admin = loadAdmin(req);
  if (!admin) return rejectUnauthenticated(req, res);
  req.admin = admin;
  if (mustEnroll(admin)) return blockUntilEnrolled(req, res);
  if (canEdit(admin)) return next();
  if (wantsJson(req)) return res.status(403).json({ error: 'Your account is view-only.' });
  return res.redirect('/admin/dashboard');
}

/** Admin-only pages and data, such as Users Settings. */
function requireAdmin(req, res, next) {
  const admin = loadAdmin(req);
  if (!admin) return rejectUnauthenticated(req, res);
  req.admin = admin;
  if (mustEnroll(admin)) return blockUntilEnrolled(req, res);
  if (admin.role === 'admin') return next();
  if (wantsJson(req)) return res.status(403).json({ error: 'Admin access required.' });
  return res.redirect('/admin/dashboard');
}

/** Keep logged-in admins away from the login page. */
function redirectIfAuthed(req, res, next) {
  if (loadAdmin(req)) return res.redirect('/admin/dashboard');
  return next();
}

module.exports = { requireAuth, requireEditor, requireAdmin, requireSession, redirectIfAuthed, wantsJson, sessionTag, canEdit };
