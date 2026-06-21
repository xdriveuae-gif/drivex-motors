'use strict';

/**
 * DriveX Motors — application entry point.
 * Express + better-sqlite3 + session auth. See README.md for full docs.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const db = require('./database/db');
const site = require('./config/site');
const { render } = require('./utils/render');
const { ensureDefaultAdmin } = require('./database/seed');
const { wantsJson } = require('./middleware/auth');
const csrf = require('./middleware/csrf');
const { UPLOAD_DIR } = require('./middleware/upload');

const pagesRouter = require('./routes/pages');
const vehiclesRouter = require('./routes/vehicles');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

if (IS_PROD) app.set('trust proxy', 1); // behind nginx / a reverse proxy
app.disable('x-powered-by');

/* ───────────────────────── Security headers ───────────────────────── */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // allow the Google Maps iframe + remote images
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ['https://www.google.com', 'https://maps.google.com'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        ...(IS_PROD ? { upgradeInsecureRequests: [] } : {})
      }
    }
  })
);

/* ───────────────────────── Core middleware ───────────────────────── */
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static assets.
//  - public/ holds code (JS/CSS) that changes on each deploy → revalidate every
//    time (ETag → cheap 304s) so browsers never get stuck on a stale script.
//  - uploads/ are content-addressed (unique filenames) so they're safe to cache long.
app.use(express.static(path.join(__dirname, 'public'), { etag: true, maxAge: 0 }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: IS_PROD ? '30d' : 0 }));

// Sessions
if (IS_PROD && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16)) {
  console.warn('⚠  SESSION_SECRET is missing or weak — set a long random value in .env for production.');
}
app.use(
  session({
    name: 'drivex.sid',
    secret: process.env.SESSION_SECRET || 'drivex-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // 'auto' = secure cookie only when the connection is actually HTTPS
      // (true behind Hostinger's HTTPS proxy via trust proxy; false on local http).
      // This keeps the live site secure while allowing local testing over http.
      secure: 'auto',
      maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
  })
);

// CSRF (after session + body parsers)
app.use(csrf);

/* ───────────────────────── Rate limiting ───────────────────────── */
const onlyPost = (limiter) => (req, res, next) =>
  req.method === 'POST' ? limiter(req, res, next) : next();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' }
});
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please try again later.' }
});
app.use('/admin/login', onlyPost(loginLimiter));
app.use('/api/contact', onlyPost(contactLimiter));

/* ───────────────────────── Routes ───────────────────────── */
app.use('/admin', adminRouter);
app.use('/api', vehiclesRouter);
app.use('/', pagesRouter);

/* ───────────────────────── 404 + errors ───────────────────────── */
app.use((req, res) => {
  if (wantsJson(req)) return res.status(404).json({ error: 'Not found.' });
  return render(req, res, '404', {
    title: 'Page Not Found',
    description: 'The page you are looking for could not be found.',
    status: 404,
    bodyClass: 'page-404'
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('✗ Unhandled error:', err.message);
  if (res.headersSent) return;
  const status = err.status || 500;
  if (wantsJson(req)) {
    return res.status(status).json({ error: IS_PROD ? 'Something went wrong.' : err.message });
  }
  return render(req, res, '404', {
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred.',
    status,
    bodyClass: 'page-404'
  });
});

/* ───────────────────────── Boot ───────────────────────── */
function start() {
  const admin = ensureDefaultAdmin();
  if (admin.created) {
    console.log(`✓ Default admin created → username: "${admin.username}" (change the password!).`);
  }
  void db; // ensure the DB module is initialised (schema applied) before listening
  app.listen(PORT, () => {
    console.log(`\n  ${site.name} is running`);
    console.log(`  → Local:  http://localhost:${PORT}`);
    console.log(`  → Admin:  http://localhost:${PORT}/admin/login`);
    console.log(`  → Env:    ${IS_PROD ? 'production' : 'development'}\n`);
  });
}

start();

module.exports = app;
