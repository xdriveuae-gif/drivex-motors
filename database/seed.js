'use strict';

/**
 * Database seeding.
 * -----------------
 *   node database/seed.js            → ensure default admin + sample inventory
 *   node database/seed.js --reset    → wipe vehicles/images and re-seed them
 *
 * `ensureDefaultAdmin` is also imported by server.js so a usable admin
 * account always exists on first boot (password hashed with bcryptjs).
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

/* ───────────────────────────── Admin ───────────────────────────── */

function ensureDefaultAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123';
  const force = process.env.ADMIN_RESET_PASSWORD === '1';

  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);

  if (!existing) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
    return { created: true, username };
  }

  if (force) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, existing.id);
    return { created: false, reset: true, username };
  }

  return { created: false, username: null };
}

/* ──────────────────────────── Vehicles ─────────────────────────── */

// Sample inventory tuned to the Abu Dhabi premium pre-owned market.
// Prices are in AED, mileage in kilometres. Images point at the bundled
// SVG placeholders — the admin replaces them with real photos via uploads.
const SAMPLE_VEHICLES = [
  {
    title: 'Toyota Land Cruiser VXR', make: 'Toyota', model: 'Land Cruiser', year: 2021,
    price: 289000, mileage: 64000, engine: '5.7L V8', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'SUV', color: 'Pearl White',
    vin: 'JTMHV05J104120771',
    description: 'GCC-spec Land Cruiser VXR with full Toyota service history. Immaculate condition inside and out, fully loaded with rear entertainment, cool box and premium leather.',
    features: ['Sunroof', '360° Camera', 'Leather Seats', 'Adaptive Cruise', 'Rear Entertainment', 'Cool Box', 'Power Tailgate'],
    is_featured: 1, is_sold: 0, daysAgo: 1
  },
  {
    title: 'Nissan Patrol Platinum', make: 'Nissan', model: 'Patrol', year: 2020,
    price: 212000, mileage: 79000, engine: '5.6L V8', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'SUV', color: 'Black',
    vin: 'JN8AY2NF7L9320145',
    description: 'Patrol Platinum City — agency maintained, accident free. Quilted leather, BOSE sound system and intelligent rear-view mirror.',
    features: ['BOSE Sound', 'Leather Seats', '360° Camera', 'Cruise Control', 'Sunroof', 'Apple CarPlay'],
    is_featured: 1, is_sold: 0, daysAgo: 3
  },
  {
    title: 'Mercedes-Benz G 63 AMG', make: 'Mercedes-Benz', model: 'G 63 AMG', year: 2019,
    price: 689000, mileage: 41000, engine: '4.0L V8 Biturbo', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'SUV', color: 'Obsidian Black',
    vin: 'WDCYC7HJ5KX320991',
    description: 'Iconic G 63 AMG with AMG Night Package and carbon trim. Burmester surround sound, designo leather and 22" AMG wheels.',
    features: ['AMG Night Package', 'Burmester Sound', 'Carbon Trim', 'designo Leather', '22" Wheels', 'Heads-Up Display'],
    is_featured: 1, is_sold: 0, daysAgo: 5
  },
  {
    title: 'Land Rover Range Rover Vogue SE', make: 'Land Rover', model: 'Range Rover', year: 2020,
    price: 318000, mileage: 56000, engine: '3.0L I6', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'SUV', color: 'Santorini Black',
    vin: 'SALGS2SE7LA420118',
    description: 'Range Rover Vogue SE with panoramic roof, Meridian sound and soft-close doors. Full service history, warranty available.',
    features: ['Panoramic Roof', 'Meridian Sound', 'Soft-Close Doors', 'Massage Seats', 'Air Suspension'],
    is_featured: 0, is_sold: 0, daysAgo: 7
  },
  {
    title: 'BMW X5 xDrive40i M-Sport', make: 'BMW', model: 'X5', year: 2021,
    price: 244000, mileage: 37000, engine: '3.0L I6 TwinPower', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'SUV', color: 'Phytonic Blue',
    vin: '5UXCR6C09M9D12045',
    description: 'X5 40i with M-Sport package, Harman Kardon audio and laser headlights. Under warranty, single owner.',
    features: ['M-Sport Package', 'Harman Kardon', 'Laser Lights', 'Panoramic Roof', 'Wireless CarPlay', 'Heated Seats'],
    is_featured: 1, is_sold: 0, daysAgo: 9
  },
  {
    title: 'Lexus LX 570', make: 'Lexus', model: 'LX 570', year: 2019,
    price: 299000, mileage: 88000, engine: '5.7L V8', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'SUV', color: 'Silver',
    vin: 'JTJHY00W104230882',
    description: 'LX 570 with Mark Levinson audio and rear entertainment. Beautifully maintained, full Lexus history.',
    features: ['Mark Levinson Sound', 'Rear Entertainment', 'Cool Box', '360° Camera', 'Sunroof'],
    is_featured: 0, is_sold: 0, daysAgo: 12
  },
  {
    title: 'Porsche Cayenne', make: 'Porsche', model: 'Cayenne', year: 2020,
    price: 279000, mileage: 46000, engine: '3.0L V6 Turbo', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'SUV', color: 'Carrara White',
    vin: 'WP1AA2AY7LDA20771',
    description: 'Cayenne with Sport Chrono, panoramic roof and BOSE sound. Pristine, accident-free, agency serviced.',
    features: ['Sport Chrono', 'Panoramic Roof', 'BOSE Sound', 'Air Suspension', 'Apple CarPlay'],
    is_featured: 0, is_sold: 0, daysAgo: 14
  },
  {
    title: 'Audi Q7 45 TFSI quattro', make: 'Audi', model: 'Q7', year: 2021,
    price: 214000, mileage: 40000, engine: '3.0L V6 TFSI', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'SUV', color: 'Glacier White',
    vin: 'WA1VAAF77MD030552',
    description: '7-seater Q7 quattro with virtual cockpit, Bang & Olufsen sound and matrix LED headlights.',
    features: ['Virtual Cockpit', 'Bang & Olufsen', 'Matrix LED', '7 Seats', 'Panoramic Roof'],
    is_featured: 0, is_sold: 0, daysAgo: 16
  },
  {
    title: 'Ford Mustang GT Premium', make: 'Ford', model: 'Mustang', year: 2021,
    price: 162000, mileage: 21000, engine: '5.0L V8', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'Coupe', color: 'Race Red',
    vin: '1FA6P8CF7M5120447',
    description: 'Mustang GT Premium with active exhaust, Recaro seats and digital cluster. Low mileage, stunning condition.',
    features: ['Active Exhaust', 'Recaro Seats', 'Digital Cluster', 'B&O Sound', 'Launch Control'],
    is_featured: 1, is_sold: 0, daysAgo: 18
  },
  {
    title: 'Mercedes-Benz S 500', make: 'Mercedes-Benz', model: 'S 500', year: 2020,
    price: 372000, mileage: 34000, engine: '3.0L I6 EQ Boost', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'Sedan', color: 'Obsidian Black',
    vin: 'WDDUG8DB7LA520663',
    description: 'Flagship S 500 with Burmester 3D sound, rear executive seating and full ADAS suite. Showroom condition.',
    features: ['Burmester 3D Sound', 'Executive Rear Seats', 'Massage Seats', 'Heads-Up Display', 'Night Vision'],
    is_featured: 0, is_sold: 0, daysAgo: 21
  },
  {
    title: 'Tesla Model 3 Long Range', make: 'Tesla', model: 'Model 3', year: 2022,
    price: 159000, mileage: 26000, engine: 'Dual Motor (Electric)', transmission: 'Automatic',
    fuel_type: 'Electric', body_type: 'Sedan', color: 'Pearl White',
    vin: '5YJ3E1EB7NF120994',
    description: 'Model 3 Long Range AWD with Autopilot, premium interior and panoramic glass roof. Includes home charger.',
    features: ['Autopilot', 'Glass Roof', 'Premium Audio', 'Heated Seats', 'Home Charger'],
    is_featured: 0, is_sold: 0, daysAgo: 24
  },
  {
    title: 'Chevrolet Tahoe LT', make: 'Chevrolet', model: 'Tahoe', year: 2021,
    price: 189000, mileage: 61000, engine: '5.3L V8', transmission: 'Automatic',
    fuel_type: 'Petrol', body_type: 'SUV', color: 'Black',
    vin: '1GNSKNKD7MR320110',
    description: 'Spacious Tahoe LT 8-seater with rear camera, Bose audio and large infotainment. Family-ready and reliable.',
    features: ['8 Seats', 'Bose Audio', 'Rear Camera', 'Apple CarPlay', 'Power Seats'],
    is_featured: 0, is_sold: 1, daysAgo: 30
  }
];

// Bundled placeholder images (replace per-vehicle via the admin panel).
const PLACEHOLDER_IMAGES = [
  '/images/placeholders/car-a.svg',
  '/images/placeholders/car-b.svg',
  '/images/placeholders/car-c.svg'
];

function seedVehicles({ reset = false } = {}) {
  if (reset) {
    db.exec('DELETE FROM vehicle_images; DELETE FROM vehicles;');
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('vehicles','vehicle_images');");
  }

  const existing = db.prepare('SELECT COUNT(*) AS n FROM vehicles').get().n;
  if (existing > 0) {
    return { inserted: 0, skipped: true };
  }

  const insertVehicle = db.prepare(`
    INSERT INTO vehicles
      (title, make, model, year, price, mileage, engine, transmission,
       fuel_type, body_type, color, vin, description, features,
       is_featured, is_sold, views, created_at, updated_at)
    VALUES
      (@title, @make, @model, @year, @price, @mileage, @engine, @transmission,
       @fuel_type, @body_type, @color, @vin, @description, @features,
       @is_featured, @is_sold, @views,
       datetime('now', @createdMod), datetime('now', @createdMod))
  `);

  const insertImage = db.prepare(`
    INSERT INTO vehicle_images (vehicle_id, file_path, is_primary, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  const run = db.transaction((vehicles) => {
    for (const v of vehicles) {
      const info = insertVehicle.run({
        title: v.title, make: v.make, model: v.model, year: v.year,
        price: v.price, mileage: v.mileage, engine: v.engine,
        transmission: v.transmission, fuel_type: v.fuel_type,
        body_type: v.body_type, color: v.color, vin: v.vin,
        description: v.description, features: JSON.stringify(v.features),
        is_featured: v.is_featured, is_sold: v.is_sold,
        views: Math.floor(Math.random() * 400) + 20,
        createdMod: `-${v.daysAgo} days`
      });
      const vehicleId = info.lastInsertRowid;
      PLACEHOLDER_IMAGES.forEach((src, i) => {
        insertImage.run(vehicleId, src, i === 0 ? 1 : 0, i);
      });
    }
  });

  run(SAMPLE_VEHICLES);
  return { inserted: SAMPLE_VEHICLES.length, skipped: false };
}

module.exports = { ensureDefaultAdmin, seedVehicles };

/* ─── Run directly: node database/seed.js [--reset] ─── */
if (require.main === module) {
  const reset = process.argv.includes('--reset');

  const admin = ensureDefaultAdmin();
  if (admin.created) {
    console.log(`✓ Default admin created → username: "${admin.username}"`);
  } else {
    console.log('• Admin already exists — left untouched.');
  }

  const result = seedVehicles({ reset });
  if (result.skipped) {
    console.log('• Vehicles already present — skipped (use --reset to wipe & re-seed).');
  } else {
    console.log(`✓ Seeded ${result.inserted} sample vehicles with images.`);
  }

  console.log('Done.');
  process.exit(0);
}
