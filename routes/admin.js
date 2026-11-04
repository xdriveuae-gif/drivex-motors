'use strict';

/**
 * Admin area: authentication, protected pages and the management JSON API.
 *   Pages:  /admin/login  /admin/dashboard  /admin/vehicles
 *           /admin/vehicles/new  /admin/vehicles/:id/edit
 *   API:    /admin/api/stats
 *           /admin/api/vehicles            (GET list, POST create)
 *           /admin/api/vehicles/filters    (GET distinct make/model/year/color)
 *           /admin/api/vehicles/:id        (GET, PUT update, PATCH flags, DELETE)
 *           /admin/api/vehicles/:id/duplicate (POST clone listing + images)
 *           /admin/api/vehicles/:id/images (POST add)
 *           /admin/api/vehicles/:id/images/:imageId        (DELETE)
 *           /admin/api/vehicles/:id/images/:imageId/primary (PATCH)
 *           /admin/api/messages            (GET)
 *           /admin/api/messages/:id        (PATCH read, DELETE)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { validationResult } = require('express-validator');

const db = require('../database/db');
const site = require('../config/site');
const { render } = require('../utils/render');
const { parseFeatures } = require('../utils/helpers');
const { requireAuth, requireAdmin, requireSession, redirectIfAuthed, sessionTag } = require('../middleware/auth');
const totp = require('../utils/totp');
const {
  vehicleValidators,
  loginValidators,
  handleValidation
} = require('../middleware/validators');
const {
  upload,
  MAX_IMAGES,
  UPLOAD_DIR,
  webPath,
  deleteUploadByWebPath,
  deleteSubmissionByWebPath
} = require('../middleware/upload');

const router = express.Router();

const SUBMISSION_STATUSES = [
  'New', 'Under Review', 'Contacted', 'Offer Sent', 'Purchased', 'Rejected'
];
const PRIMARY_IMAGE_SQL = `
  (SELECT file_path FROM vehicle_images WHERE vehicle_id = v.id
    ORDER BY is_primary DESC, sort_order ASC, id ASC LIMIT 1) AS primary_image`;
const ADMIN_SORT_MAP = {
  newest: 'v.created_at DESC, v.id DESC',
  oldest: 'v.created_at ASC, v.id ASC',
  title_asc: 'v.title COLLATE NOCASE ASC',
  title_desc: 'v.title COLLATE NOCASE DESC',
  price_asc: 'v.price ASC',
  price_desc: 'v.price DESC',
  mileage_asc: 'v.mileage ASC',
  mileage_desc: 'v.mileage DESC',
  year_asc: 'v.year ASC, v.title COLLATE NOCASE ASC',
  year_desc: 'v.year DESC, v.title COLLATE NOCASE ASC',
  views_desc: 'v.views DESC'
};

/* ───────────────────────── helpers ───────────────────────── */

function toBool(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
}

function normalizeFeatures(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
  const str = String(input).trim();
  if (str.startsWith('[')) {
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) return arr.map((s) => String(s).trim()).filter(Boolean);
    } catch (_e) { /* fall through */ }
  }
  return str.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
}

// SQL fragment for the sold_at column given the sold flag's old/new value:
// stamps the moment it flips to sold, clears it if unmarked (a stale "sold on"
// date would be misleading once a car is available again), and otherwise
// leaves the column out of the SET clause entirely so it's untouched.
function soldAtClause(wasSold, willBeSold) {
  if (willBeSold && !wasSold) return "sold_at=datetime('now')";
  if (!willBeSold && wasSold) return 'sold_at=NULL';
  return null;
}

function vehiclePayload(body) {
  return {
    title: (body.title || '').trim(),
    make: (body.make || '').trim(),
    model: (body.model || '').trim(),
    year: parseInt(body.year, 10),
    price: parseInt(body.price, 10),
    mileage: parseInt(body.mileage, 10) || 0,
    engine: (body.engine || '').trim() || null,
    transmission: (body.transmission || '').trim() || null,
    fuel_type: (body.fuel_type || '').trim() || null,
    body_type: (body.body_type || '').trim() || null,
    color: (body.color || '').trim() || null,
    vin: (body.vin || '').trim() || null,
    description: (body.description || '').trim() || null,
    features: JSON.stringify(normalizeFeatures(body.features)),
    is_sold: toBool(body.is_sold) ? 1 : 0,
    is_reserved: toBool(body.is_reserved) ? 1 : 0,
    is_coming_soon: toBool(body.is_coming_soon) ? 1 : 0
  };
}

/** Wrap multer so upload errors return clean JSON instead of crashing. */
function uploadImages(field) {
  const mw = upload.array(field, MAX_IMAGES);
  return (req, res, next) =>
    mw(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Image upload failed.' });
      next();
    });
}

function cleanupFiles(files) {
  (files || []).forEach((f) => fs.promises.unlink(f.path).catch(() => {}));
}

/** Attach uploaded files to a vehicle; first image becomes primary if none exists. */
function addImagesToVehicle(vehicleId, files) {
  if (!files || !files.length) return;
  const hasPrimary =
    db.prepare('SELECT COUNT(*) AS n FROM vehicle_images WHERE vehicle_id = ? AND is_primary = 1')
      .get(vehicleId).n > 0;
  const maxOrder =
    db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM vehicle_images WHERE vehicle_id = ?')
      .get(vehicleId).m;
  const ins = db.prepare(
    'INSERT INTO vehicle_images (vehicle_id, file_path, is_primary, sort_order) VALUES (?, ?, ?, ?)'
  );
  files.forEach((f, i) => {
    const isPrimary = !hasPrimary && i === 0 ? 1 : 0;
    ins.run(vehicleId, webPath(f.filename), isPrimary, maxOrder + 1 + i);
  });
}

function getVehicleOr404(id, res) {
  const vid = parseInt(id, 10);
  if (Number.isNaN(vid)) {
    res.status(400).json({ error: 'Invalid vehicle id.' });
    return null;
  }
  const v = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vid);
  if (!v) {
    res.status(404).json({ error: 'Vehicle not found.' });
    return null;
  }
  return v;
}

// Shared by the vehicle list and export endpoints so their filtering can
// never drift apart — same query params, same WHERE clause, either way.
function buildVehicleWhere(query) {
  const where = [];
  const params = [];
  const q = (query.q || '').trim();
  if (q) {
    where.push('(v.title LIKE ? OR v.make LIKE ? OR v.model LIKE ? OR v.vin LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (query.status === 'sold') where.push('v.is_sold = 1');
  if (query.status === 'available') where.push('v.is_sold = 0');
  if (query.status === 'reserved') where.push('v.is_reserved = 1');
  if (query.status === 'coming_soon') where.push('v.is_coming_soon = 1');

  const exact = { make: 'v.make', model: 'v.model', year: 'v.year', color: 'v.color' };
  for (const [param, col] of Object.entries(exact)) {
    if (query[param]) {
      where.push(`${col} = ?`);
      params.push(String(query[param]));
    }
  }

  const ranges = [
    ['price_min', 'v.price >= ?'],
    ['price_max', 'v.price <= ?'],
    ['mileage_max', 'v.mileage <= ?']
  ];
  for (const [param, clause] of ranges) {
    if (query[param] !== undefined && query[param] !== '') {
      const n = parseInt(query[param], 10);
      if (!Number.isNaN(n)) {
        where.push(clause);
        params.push(n);
      }
    }
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function safeNext(next) {
  if (typeof next === 'string' && /^\/admin(\/|$)/.test(next) && !next.startsWith('//')) {
    return next;
  }
  return '/admin/dashboard';
}

/* ═════════════════════════ PAGES ═════════════════════════ */

router.get('/', (req, res) =>
  res.redirect(req.session && req.session.adminId ? '/admin/dashboard' : '/admin/login')
);

router.get('/login', redirectIfAuthed, (req, res) =>
  render(req, res, 'admin/login', { title: 'Admin Login', bodyClass: 'admin-auth' })
);

router.get('/dashboard', requireAuth, (req, res) =>
  render(req, res, 'admin/dashboard', { title: 'Dashboard', bodyClass: 'admin' })
);

router.get('/vehicles', requireAuth, (req, res) =>
  render(req, res, 'admin/vehicles', { title: 'Manage Vehicles', bodyClass: 'admin' })
);

router.get('/vehicles/sold', requireAuth, (req, res) =>
  render(req, res, 'admin/vehicles', { title: 'Sold Vehicles', bodyClass: 'admin' })
);

router.get('/vehicles/available', requireAuth, (req, res) =>
  render(req, res, 'admin/vehicles', { title: 'Available Vehicles', bodyClass: 'admin' })
);

router.get('/vehicles/reserved', requireAuth, (req, res) =>
  render(req, res, 'admin/vehicles', { title: 'Reserved Vehicles', bodyClass: 'admin' })
);

router.get('/vehicles/coming-soon', requireAuth, (req, res) =>
  render(req, res, 'admin/vehicles', { title: 'Coming Soon Vehicles', bodyClass: 'admin' })
);

router.get('/vehicles/new', requireAdmin, (req, res) =>
  render(req, res, 'admin/vehicle-form', { title: 'Add Vehicle', bodyClass: 'admin' })
);

router.get('/vehicles/:id/edit', requireAdmin, (req, res) =>
  render(req, res, 'admin/vehicle-form', { title: 'Edit Vehicle', bodyClass: 'admin' })
);

router.get('/two-factor', requireSession, (req, res) =>
  render(req, res, 'admin/two-factor', { title: 'Two-Factor Login', bodyClass: 'admin' })
);

router.get('/users', requireAdmin, (req, res) =>
  render(req, res, 'admin/users', { title: 'Users Settings', bodyClass: 'admin' })
);

router.get('/leads', requireAuth, (req, res) =>
  render(req, res, 'admin/leads', { title: 'Vehicle Purchase Leads', bodyClass: 'admin' })
);

router.get('/leads/:id', requireAuth, (req, res) =>
  render(req, res, 'admin/lead-detail', { title: 'Submission Details', bodyClass: 'admin' })
);

/* ═════════════════════════ AUTH ═════════════════════════ */

router.post('/login', loginValidators, handleValidation, (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  const ok = admin && bcrypt.compareSync(password, admin.password_hash);

  if (!ok) return res.status(401).json({ error: 'Invalid username or password.' });

  if (admin.totp_enabled) {
    // Password is right but the login isn't complete until the code is checked.
    req.session.pending2fa = { id: admin.id, at: Date.now(), tag: sessionTag(admin), next: safeNext(req.body.next) };
    return res.json({ ok: true, twoFactor: true });
  }
  completeLogin(req, res, admin, safeNext(req.body.next));
});

function completeLogin(req, res, admin, redirect, extra = {}) {
  // Regenerate session to prevent fixation.
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Login failed. Please try again.' });
    req.session.adminId = admin.id;
    req.session.adminUser = admin.username;
    req.session.adminPwTag = sessionTag(admin);
    res.json({ ok: true, redirect, user: admin.username, ...extra });
  });
}

/* Wrong-code lockout per account (on top of the per-IP login rate limit). */
const CODE_MAX_FAILS = 8;
const CODE_LOCK_MS = 15 * 60 * 1000;
const codeFails = new Map();

const codeLocked = (id) => {
  const f = codeFails.get(id);
  return Boolean(f && f.until > Date.now());
};

function recordCodeFail(id) {
  const f = codeFails.get(id) || { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= CODE_MAX_FAILS) {
    f.count = 0;
    f.until = Date.now() + CODE_LOCK_MS;
  }
  codeFails.set(id, f);
}

/** Checks an authenticator or (optionally) backup code and uses it up. */
function useSecondFactor(admin, rawCode, { allowBackup = false } = {}) {
  const code = String(rawCode || '').trim();
  const step = totp.matchStep(admin.totp_secret, code, admin.totp_last_step);
  if (step !== null) {
    db.prepare('UPDATE admins SET totp_last_step = ? WHERE id = ?').run(step, admin.id);
    return { ok: true };
  }
  if (allowBackup && code.length > 6) {
    const hashes = JSON.parse(admin.totp_backup || '[]');
    const hash = totp.hashBackupCode(code);
    if (hashes.includes(hash)) {
      const left = hashes.filter((h) => h !== hash);
      db.prepare('UPDATE admins SET totp_backup = ? WHERE id = ?').run(JSON.stringify(left), admin.id);
      return { ok: true, backupLeft: left.length };
    }
  }
  return { ok: false };
}

const PENDING_LOGIN_MS = 5 * 60 * 1000;

router.post('/login/verify', (req, res) => {
  const pending = req.session.pending2fa;
  const admin = pending && db.prepare('SELECT * FROM admins WHERE id = ?').get(pending.id);
  if (!admin || Date.now() - pending.at > PENDING_LOGIN_MS || sessionTag(admin) !== pending.tag) {
    delete req.session.pending2fa;
    return res.status(401).json({ error: 'Your login expired. Please sign in again.', restart: true });
  }
  if (codeLocked(admin.id)) {
    return res.status(429).json({ error: 'Too many wrong codes. Please try again in 15 minutes.' });
  }
  const result = useSecondFactor(admin, req.body.code, { allowBackup: true });
  if (!result.ok) {
    recordCodeFail(admin.id);
    return res.status(401).json({ error: 'That code is not correct.' });
  }
  codeFails.delete(admin.id);
  const extra = result.backupLeft === undefined ? {} : { backupLeft: result.backupLeft };
  completeLogin(req, res, admin, pending.next, extra);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('drivex.sid');
    res.json({ ok: true, redirect: '/admin/login' });
  });
});

/** Lightweight "who am I" used by admin pages to show the username. */
router.get('/api/me', requireSession, (req, res) =>
  res.json({ user: req.admin.username, role: req.admin.role })
);

/* ═════════════════════════ STATS ═════════════════════════ */

router.get('/api/stats', requireAuth, (_req, res) => {
  const counts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN is_sold = 1 THEN 1 ELSE 0 END) AS sold,
         SUM(CASE WHEN is_sold = 0 THEN 1 ELSE 0 END) AS available,
         COALESCE(SUM(views), 0) AS views
       FROM vehicles`
    )
    .get();
  const messages = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
         FROM contact_messages`
    )
    .get();
  const submissions = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END) AS fresh
         FROM vehicle_submissions`
    )
    .get();
  const latest = db
    .prepare(
      `SELECT v.id, v.title, v.make, v.model, v.year, v.price, v.is_sold, v.is_reserved,
              v.created_at, ${PRIMARY_IMAGE_SQL}
         FROM vehicles v ORDER BY v.created_at DESC, v.id DESC LIMIT 6`
    )
    .all();

  res.json({
    totalVehicles: counts.total || 0,
    sold: counts.sold || 0,
    available: counts.available || 0,
    totalViews: counts.views || 0,
    messages: messages.total || 0,
    unreadMessages: messages.unread || 0,
    submissions: submissions.total || 0,
    newSubmissions: submissions.fresh || 0,
    latest
  });
});

/* ═══════════════════════ VEHICLES API ═══════════════════════ */

// List (admin view — includes sold flag + image counts)
router.get('/api/vehicles', requireAuth, (req, res) => {
  const { whereSql, params } = buildVehicleWhere(req.query);
  const orderSql = ADMIN_SORT_MAP[req.query.sort] || ADMIN_SORT_MAP.newest;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 15));
  const offset = (page - 1) * limit;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM vehicles v ${whereSql}`).get(...params).n;
  const rows = db
    .prepare(
      `SELECT v.id, v.title, v.make, v.model, v.year, v.price, v.mileage, v.color,
              v.fuel_type, v.transmission, v.is_sold, v.sold_at, v.is_reserved, v.is_coming_soon, v.is_published, v.views, v.created_at,
              ${PRIMARY_IMAGE_SQL},
              (SELECT COUNT(*) FROM vehicle_images WHERE vehicle_id = v.id) AS image_count
         FROM vehicles v ${whereSql}
         ORDER BY ${orderSql}
         LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({
    data: rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  });
});

// Filter metadata for the admin vehicles list (distinct across ALL vehicles,
// including sold/unpublished — unlike the public /api/filters).
router.get('/api/vehicles/filters', requireAuth, (_req, res) => {
  const col = (name) =>
    db.prepare(`SELECT DISTINCT ${name} AS v FROM vehicles WHERE ${name} IS NOT NULL AND ${name} <> '' ORDER BY ${name}`)
      .all()
      .map((r) => r.v);

  const makeModelRows = db.prepare('SELECT DISTINCT make, model FROM vehicles ORDER BY make, model').all();
  const modelsByMake = {};
  for (const { make, model } of makeModelRows) {
    (modelsByMake[make] = modelsByMake[make] || []).push(model);
  }

  const years = db.prepare('SELECT DISTINCT year AS v FROM vehicles ORDER BY year DESC').all().map((r) => r.v);

  res.json({
    makes: col('make'),
    modelsByMake,
    years,
    colors: col('color')
  });
});

// Export the current filtered view (same params as the list endpoint, minus
// pagination — every matching row, not just the current page) as a real .xlsx.
router.get('/api/vehicles/export', requireAuth, async (req, res) => {
  const { whereSql, params } = buildVehicleWhere(req.query);
  const orderSql = ADMIN_SORT_MAP[req.query.sort] || ADMIN_SORT_MAP.newest;
  const rows = db
    .prepare(
      `SELECT id, year, title, make, model, body_type, fuel_type, engine, color, transmission,
              mileage, price, is_sold, is_reserved, is_coming_soon
         FROM vehicles v ${whereSql} ORDER BY ${orderSql}`
    )
    .all(...params);

  // Sold wins over Reserved wins over Coming Soon, matching the public badge's precedence.
  const statusOf = (v) => (v.is_sold ? 'Sold' : v.is_reserved ? 'Reserved' : v.is_coming_soon ? 'Coming Soon' : 'Available');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Vehicles');
  sheet.columns = [
    { header: 'Title', key: 'title', width: 42 },
    { header: 'Make', key: 'make', width: 16 },
    { header: 'Model', key: 'model', width: 18 },
    { header: 'Body Type', key: 'body_type', width: 14 },
    { header: 'Fuel Type', key: 'fuel_type', width: 14 },
    { header: 'Engine', key: 'engine', width: 16 },
    { header: 'Colour', key: 'colour', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Model Year', key: 'year', width: 12 },
    { header: 'Mileage (km)', key: 'mileage', width: 14 },
    { header: 'Transmission', key: 'transmission', width: 14 },
    { header: 'Price (AED)', key: 'price', width: 14 },
    { header: 'URL', key: 'url', width: 48 }
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((v) => {
    // site.url is SITE_URL (https://drivex-motors.com in production) — the
    // link points wherever the site is actually configured to live.
    const url = `${site.url}/vehicle/${v.id}`;
    sheet.addRow({
      title: `${v.year} ${v.title}`,
      make: v.make,
      model: v.model,
      body_type: v.body_type || '',
      fuel_type: v.fuel_type || '',
      engine: v.engine || '',
      colour: v.color || '',
      status: statusOf(v),
      year: v.year,
      mileage: v.mileage,
      transmission: v.transmission || '',
      price: v.price,
      url: { text: url, hyperlink: url }
    });
  });
  sheet.getColumn('mileage').numFmt = '#,##0';
  sheet.getColumn('price').numFmt = '#,##0';
  // Clickable, and styled like a link so it reads as one.
  sheet.getColumn('url').eachCell({ includeEmpty: false }, (cell, rowNumber) => {
    if (rowNumber > 1) cell.font = { color: { argb: 'FF0563C1' }, underline: true };
  });

  // Whitelist rather than reflect req.query.status straight into the
  // filename — it ends up in a response header.
  const statusLabel = { available: 'available', reserved: 'reserved', sold: 'sold', coming_soon: 'coming-soon' }[req.query.status] || 'all';
  const filename = `drivex-vehicles-${statusLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

// Single (for the edit form)
router.get('/api/vehicles/:id', requireAuth, (req, res) => {
  const vehicle = getVehicleOr404(req.params.id, res);
  if (!vehicle) return;
  const images = db
    .prepare(
      `SELECT id, file_path, is_primary, sort_order FROM vehicle_images
        WHERE vehicle_id = ? ORDER BY is_primary DESC, sort_order ASC, id ASC`
    )
    .all(vehicle.id);
  res.json({ ...vehicle, features: parseFeatures(vehicle.features), images });
});

// Create (multipart: fields + images)
router.post('/api/vehicles', requireAuth, uploadImages('images'), vehicleValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    cleanupFiles(req.files);
    return res.status(422).json({
      error: 'Please correct the highlighted fields.',
      errors: errors.array().map((e) => ({ field: e.path || e.param, message: e.msg }))
    });
  }

  const p = vehiclePayload(req.body);
  // A vehicle can in principle be created already marked sold — stamp sold_at
  // then too, rather than leaving it NULL until the next edit touches it.
  const soldAtSql = p.is_sold ? "datetime('now')" : 'NULL';
  const create = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO vehicles
          (title, make, model, year, price, mileage, engine, transmission,
           fuel_type, body_type, color, vin, description, features, is_sold, sold_at, is_reserved, is_coming_soon)
         VALUES
          (@title, @make, @model, @year, @price, @mileage, @engine, @transmission,
           @fuel_type, @body_type, @color, @vin, @description, @features, @is_sold, ${soldAtSql}, @is_reserved, @is_coming_soon)`
      )
      .run(p);
    const id = info.lastInsertRowid;
    addImagesToVehicle(id, req.files);
    return id;
  });

  const id = create();
  res.status(201).json({ ok: true, id, redirect: '/admin/vehicles' });
});

// Duplicate an existing vehicle (fields + a physical copy of its images).
// New listing is unpublished by default so it can be reviewed/edited before going live;
// the sold/reserved flags are reset since they rarely apply to the copy as-is.
router.post('/api/vehicles/:id/duplicate', requireAuth, (req, res) => {
  const source = getVehicleOr404(req.params.id, res);
  if (!source) return;

  const images = db
    .prepare('SELECT file_path, is_primary, sort_order FROM vehicle_images WHERE vehicle_id = ? ORDER BY sort_order ASC, id ASC')
    .all(source.id);

  const duplicate = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO vehicles
          (title, make, model, year, price, mileage, engine, transmission,
           fuel_type, body_type, color, vin, description, features, is_sold, is_reserved, is_coming_soon, is_published)
         VALUES
          (@title, @make, @model, @year, @price, @mileage, @engine, @transmission,
           @fuel_type, @body_type, @color, @vin, @description, @features, 0, 0, 0, 0)`
      )
      .run({
        title: `${source.title} (Copy)`,
        make: source.make, model: source.model, year: source.year, price: source.price,
        mileage: source.mileage, engine: source.engine, transmission: source.transmission,
        fuel_type: source.fuel_type, body_type: source.body_type, color: source.color,
        vin: source.vin, description: source.description, features: source.features
      });
    const newId = info.lastInsertRowid;

    const insImg = db.prepare(
      'INSERT INTO vehicle_images (vehicle_id, file_path, is_primary, sort_order) VALUES (?, ?, ?, ?)'
    );
    images.forEach((img) => {
      const srcName = path.basename(img.file_path);
      const ext = path.extname(srcName) || '.jpg';
      const newName = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
      try {
        fs.copyFileSync(path.join(UPLOAD_DIR, srcName), path.join(UPLOAD_DIR, newName));
        insImg.run(newId, webPath(newName), img.is_primary, img.sort_order);
      } catch (e) { /* source file missing on disk — skip that image */ }
    });

    return newId;
  });

  const id = duplicate();
  res.status(201).json({ ok: true, id, redirect: '/admin/vehicles/' + id + '/edit' });
});

// Update fields (JSON)
router.put('/api/vehicles/:id', requireAuth, vehicleValidators, handleValidation, (req, res) => {
  const vehicle = getVehicleOr404(req.params.id, res);
  if (!vehicle) return;
  const p = vehiclePayload(req.body);
  const soldClause = soldAtClause(!!vehicle.is_sold, !!p.is_sold);
  db.prepare(
    `UPDATE vehicles SET
        title=@title, make=@make, model=@model, year=@year, price=@price, mileage=@mileage,
        engine=@engine, transmission=@transmission, fuel_type=@fuel_type, body_type=@body_type,
        color=@color, vin=@vin, description=@description, features=@features,
        is_sold=@is_sold, is_reserved=@is_reserved, is_coming_soon=@is_coming_soon${soldClause ? ', ' + soldClause : ''}, updated_at=datetime('now')
      WHERE id=@id`
  ).run({ ...p, id: vehicle.id });
  res.json({ ok: true, id: vehicle.id });
});

// Quick flag toggle (sold / reserved / published) from the list view
router.patch('/api/vehicles/:id', requireAuth, (req, res) => {
  const vehicle = getVehicleOr404(req.params.id, res);
  if (!vehicle) return;
  const fields = [];
  const params = {};
  if (req.body.is_sold !== undefined) {
    const newSold = toBool(req.body.is_sold) ? 1 : 0;
    fields.push('is_sold=@is_sold');
    params.is_sold = newSold;
    const soldClause = soldAtClause(!!vehicle.is_sold, !!newSold);
    if (soldClause) fields.push(soldClause);
  }
  if (req.body.is_reserved !== undefined) {
    fields.push('is_reserved=@is_reserved');
    params.is_reserved = toBool(req.body.is_reserved) ? 1 : 0;
  }
  if (req.body.is_coming_soon !== undefined) {
    fields.push('is_coming_soon=@is_coming_soon');
    params.is_coming_soon = toBool(req.body.is_coming_soon) ? 1 : 0;
  }
  if (req.body.is_published !== undefined) {
    fields.push('is_published=@is_published');
    params.is_published = toBool(req.body.is_published) ? 1 : 0;
  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });
  db.prepare(
    `UPDATE vehicles SET ${fields.join(', ')}, updated_at=datetime('now') WHERE id=@id`
  ).run({ ...params, id: vehicle.id });
  const updated = db
    .prepare('SELECT id, is_sold, sold_at, is_reserved, is_coming_soon, is_published FROM vehicles WHERE id = ?')
    .get(vehicle.id);
  res.json({ ok: true, ...updated });
});

// Delete vehicle (and its image files)
router.delete('/api/vehicles/:id', requireAuth, (req, res) => {
  const vehicle = getVehicleOr404(req.params.id, res);
  if (!vehicle) return;
  const images = db
    .prepare('SELECT file_path FROM vehicle_images WHERE vehicle_id = ?')
    .all(vehicle.id);
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(vehicle.id); // cascades image rows
  images.forEach((img) => deleteUploadByWebPath(img.file_path));
  res.json({ ok: true });
});

/* ─────────────────── Vehicle images ─────────────────── */

// Add images to an existing vehicle
router.post('/api/vehicles/:id/images', requireAuth, uploadImages('images'), (req, res) => {
  const vehicle = getVehicleOr404(req.params.id, res);
  if (!vehicle) {
    cleanupFiles(req.files);
    return;
  }
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No images were uploaded.' });
  }
  addImagesToVehicle(vehicle.id, req.files);
  const images = db
    .prepare(
      `SELECT id, file_path, is_primary, sort_order FROM vehicle_images
        WHERE vehicle_id = ? ORDER BY is_primary DESC, sort_order ASC, id ASC`
    )
    .all(vehicle.id);
  res.status(201).json({ ok: true, images });
});

// Delete an image
router.delete('/api/vehicles/:id/images/:imageId', requireAuth, (req, res) => {
  const vehicleId = parseInt(req.params.id, 10);
  const imageId = parseInt(req.params.imageId, 10);
  const img = db
    .prepare('SELECT * FROM vehicle_images WHERE id = ? AND vehicle_id = ?')
    .get(imageId, vehicleId);
  if (!img) return res.status(404).json({ error: 'Image not found.' });

  db.prepare('DELETE FROM vehicle_images WHERE id = ?').run(imageId);
  deleteUploadByWebPath(img.file_path);

  // If we removed the primary, promote the next image.
  if (img.is_primary) {
    const next = db
      .prepare(
        'SELECT id FROM vehicle_images WHERE vehicle_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1'
      )
      .get(vehicleId);
    if (next) db.prepare('UPDATE vehicle_images SET is_primary = 1 WHERE id = ?').run(next.id);
  }
  res.json({ ok: true });
});

// Set an image as primary
router.patch('/api/vehicles/:id/images/:imageId/primary', requireAuth, (req, res) => {
  const vehicleId = parseInt(req.params.id, 10);
  const imageId = parseInt(req.params.imageId, 10);
  const img = db
    .prepare('SELECT id FROM vehicle_images WHERE id = ? AND vehicle_id = ?')
    .get(imageId, vehicleId);
  if (!img) return res.status(404).json({ error: 'Image not found.' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE vehicle_images SET is_primary = 0 WHERE vehicle_id = ?').run(vehicleId);
    db.prepare('UPDATE vehicle_images SET is_primary = 1 WHERE id = ?').run(imageId);
  });
  tx();
  res.json({ ok: true });
});

/* ═══════════════════════ MESSAGES API ═══════════════════════ */

router.get('/api/messages', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.*, v.title AS vehicle_title
         FROM contact_messages m
         LEFT JOIN vehicles v ON v.id = m.vehicle_id
        ORDER BY m.created_at DESC, m.id DESC`
    )
    .all();
  res.json({ data: rows });
});

router.patch('/api/messages/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const msg = db.prepare('SELECT id FROM contact_messages WHERE id = ?').get(id);
  if (!msg) return res.status(404).json({ error: 'Message not found.' });
  const isRead = toBool(req.body.is_read) ? 1 : 0;
  db.prepare('UPDATE contact_messages SET is_read = ? WHERE id = ?').run(isRead, id);
  res.json({ ok: true, is_read: isRead });
});

router.delete('/api/messages/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const info = db.prepare('DELETE FROM contact_messages WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Message not found.' });
  res.json({ ok: true });
});

/* ═════════════════ VEHICLE PURCHASE LEADS API ═════════════════ */

const SUB_THUMB_SQL = `
  (SELECT image_path FROM submission_images WHERE submission_id = s.id
    ORDER BY id ASC LIMIT 1) AS thumb`;

// Expose the allowed status list (used by the admin UI).
router.get('/api/submissions/statuses', requireAuth, (_req, res) =>
  res.json({ statuses: SUBMISSION_STATUSES })
);

// List (search + status filter + pagination)
router.get('/api/submissions', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  const where = [];
  const params = [];
  if (q) {
    where.push(
      '(s.full_name LIKE ? OR s.make LIKE ? OR s.model LIKE ? OR s.phone LIKE ? OR s.email LIKE ? OR s.submission_number LIKE ?)'
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }
  if (req.query.status && SUBMISSION_STATUSES.includes(req.query.status)) {
    where.push('s.status = ?');
    params.push(req.query.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 15));
  const offset = (page - 1) * limit;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM vehicle_submissions s ${whereSql}`).get(...params).n;
  const rows = db
    .prepare(
      `SELECT s.id, s.submission_number, s.full_name, s.phone, s.whatsapp, s.email, s.city,
              s.make, s.model, s.year, s.asking_price, s.negotiable, s.status, s.created_at,
              ${SUB_THUMB_SQL},
              (SELECT GROUP_CONCAT(image_path, '|') FROM submission_images WHERE submission_id = s.id) AS image_paths,
              (SELECT COUNT(*) FROM submission_images WHERE submission_id = s.id) AS image_count
         FROM vehicle_submissions s ${whereSql}
         ORDER BY s.created_at DESC, s.id DESC
         LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({
    data: rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  });
});

// Single submission (full detail + images)
router.get('/api/submissions/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid submission id.' });
  const sub = db.prepare('SELECT * FROM vehicle_submissions WHERE id = ?').get(id);
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  const images = db
    .prepare('SELECT id, image_path FROM submission_images WHERE submission_id = ? ORDER BY id ASC')
    .all(id);
  let highlights = [];
  try { highlights = JSON.parse(sub.highlights || '[]'); } catch (_e) { highlights = []; }
  res.json({ ...sub, highlights, images, statuses: SUBMISSION_STATUSES });
});

// Update status and/or internal notes
router.patch('/api/submissions/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sub = db.prepare('SELECT id FROM vehicle_submissions WHERE id = ?').get(id);
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });

  const fields = [];
  const params = {};
  if (req.body.status !== undefined) {
    if (!SUBMISSION_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    fields.push('status=@status');
    params.status = req.body.status;
  }
  if (req.body.internal_notes !== undefined) {
    fields.push('internal_notes=@internal_notes');
    params.internal_notes = String(req.body.internal_notes).slice(0, 4000) || null;
  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });

  db.prepare(
    `UPDATE vehicle_submissions SET ${fields.join(', ')}, updated_at=datetime('now') WHERE id=@id`
  ).run({ ...params, id });
  res.json({ ok: true, id, ...params });
});

// Delete a submission (and its uploaded photos)
router.delete('/api/submissions/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sub = db.prepare('SELECT id FROM vehicle_submissions WHERE id = ?').get(id);
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  const images = db.prepare('SELECT image_path FROM submission_images WHERE submission_id = ?').all(id);
  db.prepare('DELETE FROM vehicle_submissions WHERE id = ?').run(id); // cascades image rows
  images.forEach((img) => deleteSubmissionByWebPath(img.image_path));
  res.json({ ok: true });
});

/* ═══════════════════════ USERS SETTINGS API ═══════════════════════ */

const ROLES = ['admin', 'viewer'];
const USERNAME_RE = /^[A-Za-z0-9._-]{3,40}$/;
// ensureDefaultAdmin() recreates this account at every boot, so it has to stay.
const builtInUsername = () => process.env.ADMIN_USERNAME || 'admin';
const passwordIsManagedByEnv = () => process.env.ADMIN_RESET_PASSWORD === '1';

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 10) return 'Password must be at least 10 characters.';
  if (Buffer.byteLength(password) > 72) return 'Password must be at most 72 characters.'; // bcrypt ignores the rest
  return null;
}

function getUserOr404(id, res) {
  const user = db.prepare('SELECT id, username, role FROM admins WHERE id = ?').get(parseInt(id, 10));
  if (!user) res.status(404).json({ error: 'User not found.' });
  return user;
}

const adminCount = () => db.prepare("SELECT COUNT(*) AS n FROM admins WHERE role = 'admin'").get().n;

router.get('/api/users', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, username, role, created_at, totp_enabled FROM admins ORDER BY id').all();
  res.json({
    data: rows.map(({ totp_enabled: on, ...u }) => ({
      ...u,
      twoFactor: Boolean(on),
      isSelf: u.id === req.admin.id,
      isBuiltIn: u.username === builtInUsername()
    })),
    builtInPasswordLocked: passwordIsManagedByEnv(),
    twoFactorResetOn: process.env.ADMIN_RESET_2FA === '1'
  });
});

router.post('/api/users', requireAdmin, (req, res) => {
  const username = String(req.body.username || '').trim();
  const { password, role } = req.body;
  if (!USERNAME_RE.test(username)) {
    return res.status(422).json({ error: 'Username must be 3-40 letters, numbers, dots, dashes or underscores.' });
  }
  if (!ROLES.includes(role)) return res.status(422).json({ error: 'Choose a valid privilege.' });
  const problem = passwordProblem(password);
  if (problem) return res.status(422).json({ error: problem });
  if (db.prepare('SELECT id FROM admins WHERE username = ? COLLATE NOCASE').get(username)) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }
  const info = db
    .prepare('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, bcrypt.hashSync(password, 12), role);
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

router.patch('/api/users/:id/role', requireAdmin, (req, res) => {
  const user = getUserOr404(req.params.id, res);
  if (!user) return;
  const { role } = req.body;
  if (!ROLES.includes(role)) return res.status(422).json({ error: 'Choose a valid privilege.' });
  if (role !== 'admin' && user.role === 'admin') {
    if (user.id === req.admin.id) return res.status(409).json({ error: 'You cannot remove your own admin access.' });
    if (user.username === builtInUsername()) return res.status(409).json({ error: 'The built-in admin account must stay an admin.' });
    if (adminCount() <= 1) return res.status(409).json({ error: 'At least one admin is required.' });
  }
  db.prepare('UPDATE admins SET role = ? WHERE id = ?').run(role, user.id);
  res.json({ ok: true, role });
});

router.patch('/api/users/:id/password', requireAdmin, (req, res) => {
  const user = getUserOr404(req.params.id, res);
  if (!user) return;
  if (user.username === builtInUsername() && passwordIsManagedByEnv()) {
    return res.status(409).json({
      error: 'This password is reset from the server settings at every restart. Set ADMIN_RESET_PASSWORD to 0 in hPanel first.'
    });
  }
  const problem = passwordProblem(req.body.password);
  if (problem) return res.status(422).json({ error: problem });
  const hash = bcrypt.hashSync(req.body.password, 12);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, user.id);
  // Everyone logged in as this user is signed out; keep the person changing their own password signed in.
  if (user.id === req.admin.id) refreshSessionTag(req);
  res.json({ ok: true });
});

// Admin resets someone's authenticator (e.g. new phone). Signs that user out.
router.delete('/api/users/:id/two-factor', requireAdmin, (req, res) => {
  const user = getUserOr404(req.params.id, res);
  if (!user) return;
  if (user.id === req.admin.id) return res.status(409).json({ error: 'Use the Two-Factor Login page for your own account.' });
  clearTwoFactor(user.id);
  res.json({ ok: true });
});

router.delete('/api/users/:id', requireAdmin, (req, res) => {
  const user = getUserOr404(req.params.id, res);
  if (!user) return;
  if (user.id === req.admin.id) return res.status(409).json({ error: 'You cannot delete your own account.' });
  if (user.username === builtInUsername()) return res.status(409).json({ error: 'The built-in admin account cannot be deleted.' });
  if (user.role === 'admin' && adminCount() <= 1) return res.status(409).json({ error: 'At least one admin is required.' });
  db.prepare('DELETE FROM admins WHERE id = ?').run(user.id);
  res.json({ ok: true });
});

/* ═══════════════════════ TWO-FACTOR (OWN ACCOUNT) ═══════════════════════ */

const SETUP_MS = 15 * 60 * 1000;

function refreshSessionTag(req) {
  req.session.adminPwTag = sessionTag(db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id));
}

function clearTwoFactor(id) {
  db.prepare('UPDATE admins SET totp_enabled = 0, totp_secret = NULL, totp_backup = NULL, totp_last_step = 0 WHERE id = ?').run(id);
  codeFails.delete(id);
}

function newBackupCodes(id) {
  const codes = totp.generateBackupCodes();
  db.prepare('UPDATE admins SET totp_backup = ? WHERE id = ?').run(JSON.stringify(codes.map(totp.hashBackupCode)), id);
  return codes;
}

/** Sensitive changes need a current app code, not just a logged-in browser. */
function requireCurrentCode(req, res) {
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!admin.totp_enabled) {
    res.status(409).json({ error: 'Two-factor login is not on for this account.' });
    return null;
  }
  if (codeLocked(admin.id)) {
    res.status(429).json({ error: 'Too many wrong codes. Please try again in 15 minutes.' });
    return null;
  }
  if (!useSecondFactor(admin, req.body.code).ok) {
    recordCodeFail(admin.id);
    res.status(422).json({ error: 'Enter the current code from your authenticator app.' });
    return null;
  }
  codeFails.delete(admin.id);
  return admin;
}

router.get('/api/two-factor', requireSession, (req, res) => {
  const row = db.prepare('SELECT totp_enabled, totp_backup FROM admins WHERE id = ?').get(req.admin.id);
  res.json({
    enabled: Boolean(row.totp_enabled),
    required: req.admin.role === 'admin',
    backupLeft: JSON.parse(row.totp_backup || '[]').length
  });
});

router.post('/api/two-factor/setup', requireSession, (req, res) => {
  if (req.admin.totpEnabled) return res.status(409).json({ error: 'Two-factor login is already on.' });
  const secret = totp.generateSecret();
  req.session.totpSetup = { secret, at: Date.now() };
  res.json({ secret, qr: totp.qrDataUrl(totp.otpauthUrl(secret, req.admin.username, site.name)) });
});

router.post('/api/two-factor/confirm', requireSession, (req, res) => {
  const setup = req.session.totpSetup;
  if (req.admin.totpEnabled) return res.status(409).json({ error: 'Two-factor login is already on.' });
  if (!setup || Date.now() - setup.at > SETUP_MS) {
    return res.status(409).json({ error: 'Setup expired. Please start again.' });
  }
  const step = totp.matchStep(setup.secret, String(req.body.code || '').trim());
  if (step === null) return res.status(422).json({ error: 'That code is not correct. Check the app and try again.' });
  db.prepare('UPDATE admins SET totp_secret = ?, totp_enabled = 1, totp_last_step = ? WHERE id = ?').run(setup.secret, step, req.admin.id);
  const backupCodes = newBackupCodes(req.admin.id);
  delete req.session.totpSetup;
  refreshSessionTag(req);
  res.json({ ok: true, backupCodes });
});

router.post('/api/two-factor/backup-codes', requireSession, (req, res) => {
  const admin = requireCurrentCode(req, res);
  if (!admin) return;
  res.json({ ok: true, backupCodes: newBackupCodes(admin.id) });
});

router.post('/api/two-factor/disable', requireSession, (req, res) => {
  const admin = requireCurrentCode(req, res);
  if (!admin) return;
  clearTwoFactor(admin.id);
  refreshSessionTag(req);
  res.json({ ok: true });
});

module.exports = router;
