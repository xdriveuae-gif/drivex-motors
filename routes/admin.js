'use strict';

/**
 * Admin area: authentication, protected pages and the management JSON API.
 *   Pages:  /admin/login  /admin/dashboard  /admin/vehicles
 *           /admin/vehicles/new  /admin/vehicles/:id/edit
 *   API:    /admin/api/stats
 *           /admin/api/vehicles            (GET list, POST create)
 *           /admin/api/vehicles/:id        (GET, PUT update, PATCH flags, DELETE)
 *           /admin/api/vehicles/:id/images (POST add)
 *           /admin/api/vehicles/:id/images/:imageId        (DELETE)
 *           /admin/api/vehicles/:id/images/:imageId/primary (PATCH)
 *           /admin/api/messages            (GET)
 *           /admin/api/messages/:id        (PATCH read, DELETE)
 */

const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

const db = require('../database/db');
const { render } = require('../utils/render');
const { parseFeatures } = require('../utils/helpers');
const { requireAuth, redirectIfAuthed } = require('../middleware/auth');
const {
  vehicleValidators,
  loginValidators,
  handleValidation
} = require('../middleware/validators');
const {
  upload,
  MAX_IMAGES,
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
    is_featured: toBool(body.is_featured) ? 1 : 0,
    is_sold: toBool(body.is_sold) ? 1 : 0
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

router.get('/vehicles/new', requireAuth, (req, res) =>
  render(req, res, 'admin/vehicle-form', { title: 'Add Vehicle', bodyClass: 'admin' })
);

router.get('/vehicles/:id/edit', requireAuth, (req, res) =>
  render(req, res, 'admin/vehicle-form', { title: 'Edit Vehicle', bodyClass: 'admin' })
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

  // Regenerate session to prevent fixation.
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Login failed. Please try again.' });
    req.session.adminId = admin.id;
    req.session.adminUser = admin.username;
    res.json({ ok: true, redirect: safeNext(req.body.next), user: admin.username });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('drivex.sid');
    res.json({ ok: true, redirect: '/admin/login' });
  });
});

/** Lightweight "who am I" used by admin pages to show the username. */
router.get('/api/me', requireAuth, (req, res) =>
  res.json({ user: req.session.adminUser })
);

/* ═════════════════════════ STATS ═════════════════════════ */

router.get('/api/stats', requireAuth, (_req, res) => {
  const counts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) AS featured,
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
      `SELECT v.id, v.title, v.make, v.model, v.year, v.price, v.is_sold, v.is_featured,
              v.created_at, ${PRIMARY_IMAGE_SQL}
         FROM vehicles v ORDER BY v.created_at DESC, v.id DESC LIMIT 6`
    )
    .all();

  res.json({
    totalVehicles: counts.total || 0,
    featured: counts.featured || 0,
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

// List (admin view — includes sold/featured + image counts)
router.get('/api/vehicles', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  const where = [];
  const params = [];
  if (q) {
    where.push('(v.title LIKE ? OR v.make LIKE ? OR v.model LIKE ? OR v.vin LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (req.query.status === 'sold') where.push('v.is_sold = 1');
  if (req.query.status === 'available') where.push('v.is_sold = 0');
  if (req.query.status === 'featured') where.push('v.is_featured = 1');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 15));
  const offset = (page - 1) * limit;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM vehicles v ${whereSql}`).get(...params).n;
  const rows = db
    .prepare(
      `SELECT v.id, v.title, v.make, v.model, v.year, v.price, v.mileage,
              v.fuel_type, v.transmission, v.is_featured, v.is_sold, v.views, v.created_at,
              ${PRIMARY_IMAGE_SQL},
              (SELECT COUNT(*) FROM vehicle_images WHERE vehicle_id = v.id) AS image_count
         FROM vehicles v ${whereSql}
         ORDER BY v.created_at DESC, v.id DESC
         LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({
    data: rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  });
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
  const create = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO vehicles
          (title, make, model, year, price, mileage, engine, transmission,
           fuel_type, body_type, color, vin, description, features, is_featured, is_sold)
         VALUES
          (@title, @make, @model, @year, @price, @mileage, @engine, @transmission,
           @fuel_type, @body_type, @color, @vin, @description, @features, @is_featured, @is_sold)`
      )
      .run(p);
    const id = info.lastInsertRowid;
    addImagesToVehicle(id, req.files);
    return id;
  });

  const id = create();
  res.status(201).json({ ok: true, id, redirect: '/admin/vehicles' });
});

// Update fields (JSON)
router.put('/api/vehicles/:id', requireAuth, vehicleValidators, handleValidation, (req, res) => {
  const vehicle = getVehicleOr404(req.params.id, res);
  if (!vehicle) return;
  const p = vehiclePayload(req.body);
  db.prepare(
    `UPDATE vehicles SET
        title=@title, make=@make, model=@model, year=@year, price=@price, mileage=@mileage,
        engine=@engine, transmission=@transmission, fuel_type=@fuel_type, body_type=@body_type,
        color=@color, vin=@vin, description=@description, features=@features,
        is_featured=@is_featured, is_sold=@is_sold, updated_at=datetime('now')
      WHERE id=@id`
  ).run({ ...p, id: vehicle.id });
  res.json({ ok: true, id: vehicle.id });
});

// Quick flag toggle (featured / sold) from the list view
router.patch('/api/vehicles/:id', requireAuth, (req, res) => {
  const vehicle = getVehicleOr404(req.params.id, res);
  if (!vehicle) return;
  const fields = [];
  const params = {};
  if (req.body.is_featured !== undefined) {
    fields.push('is_featured=@is_featured');
    params.is_featured = toBool(req.body.is_featured) ? 1 : 0;
  }
  if (req.body.is_sold !== undefined) {
    fields.push('is_sold=@is_sold');
    params.is_sold = toBool(req.body.is_sold) ? 1 : 0;
  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });
  db.prepare(
    `UPDATE vehicles SET ${fields.join(', ')}, updated_at=datetime('now') WHERE id=@id`
  ).run({ ...params, id: vehicle.id });
  const updated = db
    .prepare('SELECT id, is_featured, is_sold FROM vehicles WHERE id = ?')
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

module.exports = router;
