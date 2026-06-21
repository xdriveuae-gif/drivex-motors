'use strict';

/**
 * Public website pages (server-rendered HTML shells with injected SEO meta)
 * plus the contact-form submission endpoint, robots.txt and sitemap.xml.
 */

const express = require('express');
const { validationResult } = require('express-validator');
const db = require('../database/db');
const site = require('../config/site');
const { render } = require('../utils/render');
const { contactValidators, submissionValidators, handleValidation } = require('../middleware/validators');
const {
  submissionUpload,
  SUBMISSION_MAX_IMAGES,
  submissionWebPath
} = require('../middleware/upload');
const { notifyNewSubmission } = require('../utils/notify');
const {
  formatPrice,
  formatMileage,
  truncate,
  absoluteUrl
} = require('../utils/helpers');

const fs = require('fs');
const router = express.Router();

/* ─────────────── Static-content pages ─────────────── */

router.get('/', (req, res) => {
  render(req, res, 'index', {
    description: site.shortDescription,
    bodyClass: 'page-home'
  });
});

router.get('/inventory', (req, res) => {
  render(req, res, 'inventory', {
    title: 'Vehicle Inventory',
    description:
      'Browse our full range of premium pre-owned vehicles in Abu Dhabi — luxury SUVs, sedans and sports cars. Filter by make, model, year, price and more.',
    keywords: 'used cars Abu Dhabi, car inventory UAE, buy used car, pre-owned SUV',
    bodyClass: 'page-inventory'
  });
});

router.get('/about', (req, res) => {
  render(req, res, 'about', {
    title: 'About Us',
    description: `Learn the story behind ${site.name} — Abu Dhabi’s trusted destination for premium pre-owned vehicles, our mission, values and the team that drives us.`,
    bodyClass: 'page-about'
  });
});

router.get('/contact', (req, res) => {
  render(req, res, 'contact', {
    title: 'Contact Us',
    description: `Get in touch with ${site.name} in Abu Dhabi. Call, email, WhatsApp or visit our showroom — we’re here to help you find your next vehicle.`,
    bodyClass: 'page-contact'
  });
});

router.get('/sold', (req, res) => {
  render(req, res, 'sold', {
    title: 'Sold Vehicles',
    description: `Recently sold vehicles at ${site.name}, Abu Dhabi. See cars that have found their new owners — and let us help you find a similar one.`,
    keywords: 'sold cars Abu Dhabi, recently sold vehicles, DriveX Motors sold',
    bodyClass: 'page-sold'
  });
});

router.get('/sell-your-car', (req, res) => {
  render(req, res, 'sell-your-car', {
    title: 'Sell Your Car in Abu Dhabi',
    description:
      'Get a free valuation and sell your car quickly in Abu Dhabi. Submit your vehicle details and our team will contact you with an offer.',
    keywords: 'sell my car Abu Dhabi, sell car UAE, car valuation Abu Dhabi, we buy cars, instant car offer',
    bodyClass: 'page-sell'
  });
});

/* ─────────────── Vehicle detail (dynamic SEO) ─────────────── */

function buildVehicleJsonLd(vehicle, imageUrl) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: vehicle.title,
    brand: { '@type': 'Brand', name: vehicle.make },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: vehicle.mileage, unitCode: 'KMT' },
    color: vehicle.color || undefined,
    vehicleTransmission: vehicle.transmission || undefined,
    fuelType: vehicle.fuel_type || undefined,
    vehicleIdentificationNumber: vehicle.vin || undefined,
    image: imageUrl,
    offers: {
      '@type': 'Offer',
      priceCurrency: site.currency,
      price: vehicle.price,
      availability: vehicle.is_sold
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      url: absoluteUrl(`/vehicle/${vehicle.id}`),
      seller: { '@type': 'AutoDealer', name: site.name }
    }
  };
  // Escape "<" so a vehicle title/description can never break out of the script tag.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

router.get('/vehicle/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const vehicle = Number.isNaN(id)
    ? null
    : db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);

  if (!vehicle) {
    return render(req, res, '404', {
      title: 'Vehicle Not Found',
      description: 'The vehicle you are looking for is no longer available.',
      status: 404,
      bodyClass: 'page-404'
    });
  }

  const primary = db
    .prepare(
      `SELECT file_path FROM vehicle_images WHERE vehicle_id = ?
        ORDER BY is_primary DESC, sort_order ASC, id ASC LIMIT 1`
    )
    .get(id);
  const imageUrl = absoluteUrl(primary ? primary.file_path : '/images/og-default.svg');

  const desc = truncate(
    vehicle.description ||
      `${vehicle.year} ${vehicle.make} ${vehicle.model} — ${formatMileage(vehicle.mileage)}, ${vehicle.transmission || ''}. ${formatPrice(vehicle.price)}.`,
    180
  );

  render(req, res, 'vehicle-details', {
    title: `${vehicle.title} (${vehicle.year})`,
    description: desc,
    keywords: `${vehicle.make} ${vehicle.model}, used ${vehicle.make} Abu Dhabi, ${vehicle.year} ${vehicle.make}`,
    ogImage: primary ? primary.file_path : '/images/og-default.svg',
    ogType: 'product',
    jsonLd: buildVehicleJsonLd(vehicle, imageUrl),
    bodyClass: 'page-vehicle'
  });
});

/* ─────────────── Contact form submission ─────────────── */

router.post('/api/contact', contactValidators, handleValidation, (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  let vehicleId = parseInt(req.body.vehicle_id, 10);
  if (Number.isNaN(vehicleId)) vehicleId = null;

  db.prepare(
    `INSERT INTO contact_messages (name, email, phone, subject, message, vehicle_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(name, email, phone || null, subject || null, message, vehicleId);

  res.status(201).json({ ok: true, message: 'Thank you! Your message has been sent. We will contact you shortly.' });
});

/* ─────────────── "Sell Your Car" submission ─────────────── */

function submissionUploadMw(req, res, next) {
  submissionUpload.array('images', SUBMISSION_MAX_IMAGES)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Image upload failed.' });
    next();
  });
}

function cleanupSubmissionFiles(files) {
  (files || []).forEach((f) => fs.promises.unlink(f.path).catch(() => {}));
}

// Yes/No normaliser: returns 'Yes' | 'No' | null
function yesNo(v) {
  if (v === undefined || v === null || v === '') return null;
  return (v === 'Yes' || v === 'yes' || v === '1' || v === 'true' || v === true || v === 'on') ? 'Yes' : 'No';
}

router.post('/api/sell-your-car', submissionUploadMw, submissionValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    cleanupSubmissionFiles(req.files);
    return res.status(422).json({
      error: 'Please correct the highlighted fields.',
      errors: errors.array().map((e) => ({ field: e.path || e.param, message: e.msg }))
    });
  }

  const b = req.body;
  let highlights = b.highlights || [];
  if (!Array.isArray(highlights)) highlights = [highlights];
  highlights = highlights.map((s) => String(s).trim()).filter(Boolean);

  const payload = {
    full_name: (b.full_name || '').trim(),
    phone: (b.phone || '').trim(),
    whatsapp: (b.whatsapp || '').trim() || null,
    email: (b.email || '').trim(),
    city: (b.city || '').trim() || null,
    make: (b.make || '').trim(),
    model: (b.model || '').trim(),
    year: parseInt(b.year, 10),
    trim: (b.trim || '').trim() || null,
    mileage: b.mileage !== undefined && b.mileage !== '' ? parseInt(b.mileage, 10) : null,
    engine_size: (b.engine_size || '').trim() || null,
    fuel_type: (b.fuel_type || '').trim() || null,
    transmission: (b.transmission || '').trim() || null,
    color: (b.color || '').trim() || null,
    vin: (b.vin || '').trim() || null,
    owners_count: b.owners_count !== undefined && b.owners_count !== '' ? parseInt(b.owners_count, 10) : null,
    service_history: yesNo(b.service_history),
    accident_history: yesNo(b.accident_history),
    paintwork: yesNo(b.paintwork),
    mechanical_issues: (b.mechanical_issues || '').trim() || null,
    additional_notes: (b.additional_notes || '').trim() || null,
    highlights: JSON.stringify(highlights),
    asking_price: b.asking_price !== undefined && b.asking_price !== '' ? parseInt(b.asking_price, 10) : null,
    negotiable: yesNo(b.negotiable)
  };

  const save = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO vehicle_submissions
          (full_name, phone, whatsapp, email, city, make, model, year, trim, mileage,
           engine_size, fuel_type, transmission, color, vin, owners_count, service_history,
           accident_history, paintwork, mechanical_issues, additional_notes, highlights,
           asking_price, negotiable)
         VALUES
          (@full_name, @phone, @whatsapp, @email, @city, @make, @model, @year, @trim, @mileage,
           @engine_size, @fuel_type, @transmission, @color, @vin, @owners_count, @service_history,
           @accident_history, @paintwork, @mechanical_issues, @additional_notes, @highlights,
           @asking_price, @negotiable)`
      )
      .run(payload);
    const id = info.lastInsertRowid;
    const number = 'DX-' + String(id).padStart(5, '0');
    db.prepare('UPDATE vehicle_submissions SET submission_number = ? WHERE id = ?').run(number, id);
    if (req.files && req.files.length) {
      const ins = db.prepare('INSERT INTO submission_images (submission_id, image_path) VALUES (?, ?)');
      req.files.forEach((f) => ins.run(id, submissionWebPath(f.filename)));
    }
    return { id, number };
  });

  let result;
  try {
    result = save();
  } catch (e) {
    cleanupSubmissionFiles(req.files);
    return res.status(500).json({ error: 'Could not save your submission. Please try again.' });
  }

  // Best-effort email notification (does not block / fail the response).
  const sub = db.prepare('SELECT * FROM vehicle_submissions WHERE id = ?').get(result.id);
  notifyNewSubmission(sub, (req.files || []).length);

  res.status(201).json({
    ok: true,
    submission_number: result.number,
    message: 'Thank you. Our team will review your vehicle and contact you shortly.'
  });
});

/* ─────────────── robots.txt & sitemap.xml ─────────────── */

router.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: ${site.url}/sitemap.xml
`
  );
});

router.get('/sitemap.xml', (_req, res) => {
  const statics = ['/', '/inventory', '/sold', '/about', '/contact', '/sell-your-car'];
  const vehicles = db
    .prepare('SELECT id, updated_at FROM vehicles WHERE is_sold = 0 ORDER BY updated_at DESC')
    .all();

  const urls = [
    ...statics.map((p) => ({ loc: site.url + p, priority: p === '/' ? '1.0' : '0.8' })),
    ...vehicles.map((v) => ({
      loc: `${site.url}/vehicle/${v.id}`,
      lastmod: (v.updated_at || '').slice(0, 10),
      priority: '0.7'
    }))
  ];

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`
    )
    .join('\n');

  res
    .type('application/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`);
});

module.exports = router;
