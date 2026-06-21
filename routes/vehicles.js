'use strict';

/**
 * Public vehicle JSON API  (mounted at /api)
 *   GET /api/vehicles          → search / filter / sort / paginate
 *   GET /api/vehicles/:id       → single vehicle + images + features
 *   GET /api/filters            → distinct values to populate filter UI
 *
 * All inventory data comes from SQLite — nothing is hard-coded.
 */

const express = require('express');
const db = require('../database/db');
const { parseFeatures } = require('../utils/helpers');

const router = express.Router();

const PRIMARY_IMAGE_SQL = `
  (SELECT file_path FROM vehicle_images
    WHERE vehicle_id = v.id
    ORDER BY is_primary DESC, sort_order ASC, id ASC
    LIMIT 1) AS primary_image`;

const SORT_MAP = {
  newest: 'v.created_at DESC, v.id DESC',
  oldest: 'v.created_at ASC, v.id ASC',
  price_asc: 'v.price ASC',
  price_desc: 'v.price DESC',
  mileage_asc: 'v.mileage ASC',
  year_desc: 'v.year DESC'
};

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/* ───────────── GET /api/vehicles ───────────── */
router.get('/vehicles', (req, res) => {
  const q = (req.query.q || '').trim();
  const where = [];
  const params = [];

  if (req.query.sold === '1') where.push('v.is_sold = 1');          // only sold (Sold page)
  else if (req.query.include_sold !== '1') where.push('v.is_sold = 0'); // default: hide sold
  if (req.query.featured === '1') where.push('v.is_featured = 1');

  if (q) {
    where.push(
      '(v.title LIKE ? OR v.make LIKE ? OR v.model LIKE ? OR v.description LIKE ? OR v.color LIKE ?)'
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }

  const exact = { make: 'v.make', model: 'v.model', fuel_type: 'v.fuel_type', body_type: 'v.body_type', transmission: 'v.transmission' };
  for (const [param, col] of Object.entries(exact)) {
    if (req.query[param]) {
      where.push(`${col} = ?`);
      params.push(String(req.query[param]));
    }
  }

  const ranges = [
    ['year_min', 'v.year >= ?'],
    ['year_max', 'v.year <= ?'],
    ['price_min', 'v.price >= ?'],
    ['price_max', 'v.price <= ?'],
    ['mileage_max', 'v.mileage <= ?']
  ];
  for (const [param, clause] of ranges) {
    if (req.query[param] !== undefined && req.query[param] !== '') {
      const n = parseInt(req.query[param], 10);
      if (!Number.isNaN(n)) {
        where.push(clause);
        params.push(n);
      }
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORT_MAP[req.query.sort] || SORT_MAP.newest;

  const page = clampInt(req.query.page, 1, 100000, 1);
  const limit = clampInt(req.query.limit, 1, 48, 12);
  const offset = (page - 1) * limit;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM vehicles v ${whereSql}`).get(...params).n;

  const rows = db
    .prepare(
      `SELECT v.id, v.title, v.make, v.model, v.year, v.price, v.mileage,
              v.engine, v.transmission, v.fuel_type, v.body_type, v.color,
              v.is_featured, v.is_sold, v.created_at, ${PRIMARY_IMAGE_SQL}
         FROM vehicles v
         ${whereSql}
         ORDER BY ${orderSql}
         LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  });
});

/* ───────────── GET /api/filters ───────────── */
router.get('/filters', (_req, res) => {
  const onlyAvailable = 'WHERE is_sold = 0';
  const col = (name) =>
    db
      .prepare(`SELECT DISTINCT ${name} AS v FROM vehicles ${onlyAvailable} AND ${name} IS NOT NULL AND ${name} <> '' ORDER BY ${name}`)
      .all()
      .map((r) => r.v);

  const makeModelRows = db
    .prepare(`SELECT DISTINCT make, model FROM vehicles ${onlyAvailable} ORDER BY make, model`)
    .all();
  const modelsByMake = {};
  for (const { make, model } of makeModelRows) {
    (modelsByMake[make] = modelsByMake[make] || []).push(model);
  }

  const bounds = db
    .prepare(
      `SELECT MIN(year) AS yearMin, MAX(year) AS yearMax,
              MIN(price) AS priceMin, MAX(price) AS priceMax,
              MAX(mileage) AS mileageMax
         FROM vehicles ${onlyAvailable}`
    )
    .get();

  res.json({
    makes: col('make'),
    modelsByMake,
    bodyTypes: col('body_type'),
    fuelTypes: col('fuel_type'),
    transmissions: col('transmission'),
    yearMin: bounds.yearMin || 1990,
    yearMax: bounds.yearMax || new Date().getFullYear(),
    priceMin: bounds.priceMin || 0,
    priceMax: bounds.priceMax || 0,
    mileageMax: bounds.mileageMax || 0
  });
});

/* ───────────── GET /api/vehicles/:id ───────────── */
router.get('/vehicles/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid vehicle id.' });

  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found.' });

  // Count a view (best-effort, non-blocking for the response shape).
  db.prepare('UPDATE vehicles SET views = views + 1 WHERE id = ?').run(id);

  const images = db
    .prepare(
      `SELECT id, file_path, is_primary, sort_order
         FROM vehicle_images WHERE vehicle_id = ?
        ORDER BY is_primary DESC, sort_order ASC, id ASC`
    )
    .all(id);

  res.json({
    ...vehicle,
    features: parseFeatures(vehicle.features),
    images: images.length
      ? images
      : [{ id: 0, file_path: '/images/placeholders/car-a.svg', is_primary: 1, sort_order: 0 }]
  });
});

module.exports = router;
