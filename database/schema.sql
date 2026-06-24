-- ════════════════════════════════════════════════════════════════
--  DriveX Motors — SQLite schema
--  Safe to run repeatedly (everything uses IF NOT EXISTS).
-- ════════════════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

-- ── Administrators ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Vehicles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  make         TEXT    NOT NULL,
  model        TEXT    NOT NULL,
  year         INTEGER NOT NULL,
  price        INTEGER NOT NULL,             -- whole AED
  mileage      INTEGER NOT NULL DEFAULT 0,   -- kilometres
  engine       TEXT,
  transmission TEXT,                          -- Automatic | Manual
  fuel_type    TEXT,                          -- Petrol | Diesel | Hybrid | Electric
  body_type    TEXT,                          -- SUV | Sedan | Coupe | ...
  color        TEXT,
  vin          TEXT,
  description  TEXT,
  features     TEXT,                          -- JSON array string, e.g. ["Sunroof","360 Camera"]
  is_featured  INTEGER NOT NULL DEFAULT 0,    -- 0 | 1
  is_sold      INTEGER NOT NULL DEFAULT 0,    -- 0 | 1
  is_published INTEGER NOT NULL DEFAULT 1,    -- 0 | 1 (hidden from public inventory)
  views        INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vehicles_make      ON vehicles (make);
CREATE INDEX IF NOT EXISTS idx_vehicles_model     ON vehicles (model);
CREATE INDEX IF NOT EXISTS idx_vehicles_featured  ON vehicles (is_featured);
CREATE INDEX IF NOT EXISTS idx_vehicles_sold      ON vehicles (is_sold);
CREATE INDEX IF NOT EXISTS idx_vehicles_published ON vehicles (is_published);
CREATE INDEX IF NOT EXISTS idx_vehicles_price     ON vehicles (price);
CREATE INDEX IF NOT EXISTS idx_vehicles_year      ON vehicles (year);
CREATE INDEX IF NOT EXISTS idx_vehicles_created   ON vehicles (created_at);

-- ── Vehicle images (one-to-many) ────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id  INTEGER NOT NULL,
  file_path   TEXT    NOT NULL,               -- web path, e.g. /uploads/abc.jpg
  is_primary  INTEGER NOT NULL DEFAULT 0,     -- 0 | 1
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_images_vehicle ON vehicle_images (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_images_primary ON vehicle_images (vehicle_id, is_primary);

-- ── Contact / enquiry messages ──────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  phone       TEXT,
  subject     TEXT,
  message     TEXT    NOT NULL,
  vehicle_id  INTEGER,                         -- optional: enquiry about a specific car
  is_read     INTEGER NOT NULL DEFAULT 0,      -- 0 | 1
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON contact_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_read    ON contact_messages (is_read);

-- ── "Sell Your Car" submissions (vehicle purchase leads) ────────
CREATE TABLE IF NOT EXISTS vehicle_submissions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_number TEXT,                              -- human ref, e.g. DX-00007
  -- Owner / contact
  full_name         TEXT    NOT NULL,
  phone             TEXT    NOT NULL,
  whatsapp          TEXT,
  email             TEXT    NOT NULL,
  city              TEXT,
  -- Vehicle
  make              TEXT    NOT NULL,
  model             TEXT    NOT NULL,
  year              INTEGER NOT NULL,
  trim              TEXT,
  mileage           INTEGER,
  engine_size       TEXT,
  fuel_type         TEXT,
  transmission      TEXT,
  color             TEXT,
  vin               TEXT,
  -- Condition / history
  owners_count      INTEGER,
  service_history   TEXT,                              -- Yes | No
  accident_history  TEXT,                              -- Yes | No
  paintwork         TEXT,                              -- Yes | No
  mechanical_issues TEXT,
  additional_notes  TEXT,
  highlights        TEXT,                              -- JSON array of checkbox tags
  -- Pricing
  asking_price      INTEGER,
  negotiable        TEXT,                              -- Yes | No
  -- Workflow
  status            TEXT    NOT NULL DEFAULT 'New',    -- New|Under Review|Contacted|Offer Sent|Purchased|Rejected
  internal_notes    TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_status  ON vehicle_submissions (status);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON vehicle_submissions (created_at);

-- ── Submission images (one-to-many) ─────────────────────────────
CREATE TABLE IF NOT EXISTS submission_images (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  image_path    TEXT    NOT NULL,                      -- web path, e.g. /uploads/submissions/abc.jpg
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (submission_id) REFERENCES vehicle_submissions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subimages_submission ON submission_images (submission_id);
