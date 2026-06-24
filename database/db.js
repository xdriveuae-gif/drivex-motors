'use strict';

/**
 * SQLite connection.
 * ------------------
 * Uses **node-sqlite3-wasm** — a pure WebAssembly build of SQLite that needs
 * NO native compilation, so it installs cleanly on managed Node hosts
 * (Hostinger, etc.) where a C++ toolchain isn't available.
 *
 * This module exposes a tiny compatibility layer so the rest of the app keeps
 * using the familiar better-sqlite3 style API:
 *     db.prepare(sql).get(...) / .all(...) / .run(...)
 *     db.exec(sql)
 *     db.transaction(fn)
 * Differences handled here:
 *   - node-sqlite3-wasm wants named params keyed WITH their prefix (@name),
 *     while the app passes prefix-less objects ({ name: ... }).
 *   - positional params must be passed as an array.
 *   - booleans must be coerced to 0/1; undefined to NULL.
 *   - prepared statements are cached by SQL text (reusable + no WASM leak).
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { Database } = require('node-sqlite3-wasm');

const DB_PATH = path.resolve(
  process.env.DB_PATH || path.join(__dirname, 'database.db')
);

// Make sure the containing folder exists (first run on a fresh machine).
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// node-sqlite3-wasm guards the database with a "<file>.lock" directory and only
// removes it on a clean close(). A crash or hard restart can leave a stale lock
// that blocks re-opening. This app runs as a single instance, so any lock found
// at startup is stale by definition — clear it before opening.
try { fs.rmSync(DB_PATH + '.lock', { recursive: true, force: true }); } catch (e) {}

const raw = new Database(DB_PATH);

// Relational integrity. (WAL isn't used with the wasm single-file backend;
// the default rollback journal is correct and durable.)
raw.exec('PRAGMA foreign_keys = ON');

// ── Lightweight in-place migrations (MUST run before the schema) ──
// schema.sql uses CREATE TABLE IF NOT EXISTS, which will NOT add new columns to
// a table that already exists — and it also creates indexes on those new
// columns. On an OLD database the table exists without the column, so the index
// creation in schema.sql would crash. We therefore add any missing columns
// FIRST, idempotently, so existing databases upgrade in place (no data loss,
// no manual database deletion). On a brand-new database the table doesn't exist
// yet, so these are skipped and schema.sql creates everything correctly.
function ensureColumn(table, column, definition) {
  const cols = raw.all(`PRAGMA table_info(${table})`);
  if (cols.length === 0) return;          // table doesn't exist yet (fresh DB)
  if (!cols.some((c) => c.name === column)) {
    raw.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('vehicles', 'is_published', 'INTEGER NOT NULL DEFAULT 1');

// Apply the schema (CREATE TABLE/INDEX IF NOT EXISTS — safe to re-run).
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
raw.exec(schema);

/* ---------- better-sqlite3 compatibility shim ---------- */

function coerce(v) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === undefined) return null;
  return v;
}

// Turn call-style args into what node-sqlite3-wasm expects:
//  - a single prefix-less object  -> named params keyed with "@"
//  - anything else                -> positional array
function normalize(args) {
  if (
    args.length === 1 &&
    args[0] !== null &&
    typeof args[0] === 'object' &&
    !Array.isArray(args[0])
  ) {
    const out = {};
    for (const k in args[0]) out['@' + k] = coerce(args[0][k]);
    return out;
  }
  return args.map(coerce);
}

function call(stmt, method, args) {
  const p = normalize(args);
  if (Array.isArray(p)) return p.length ? stmt[method](p) : stmt[method]();
  return stmt[method](p);
}

// Cache prepared statements by SQL text: lets the app reuse statements
// (seed loops, image inserts) and prevents leaking WASM statement handles
// for the common inline `db.prepare(sql).get(x)` pattern.
const cache = new Map();
const MAX_CACHE = 300;
function getStmt(sql) {
  let s = cache.get(sql);
  if (!s) {
    if (cache.size >= MAX_CACHE) {
      for (const st of cache.values()) { try { st.finalize(); } catch (e) {} }
      cache.clear();
    }
    s = raw.prepare(sql);
    cache.set(sql, s);
  }
  return s;
}

function prepare(sql) {
  const stmt = getStmt(sql);
  return {
    get: (...a) => call(stmt, 'get', a),
    all: (...a) => call(stmt, 'all', a),
    run: (...a) => call(stmt, 'run', a)
  };
}

function transaction(fn) {
  return (...args) => {
    raw.exec('BEGIN');
    try {
      const result = fn(...args);
      raw.exec('COMMIT');
      return result;
    } catch (err) {
      try { raw.exec('ROLLBACK'); } catch (e) {}
      throw err;
    }
  };
}

const db = {
  prepare,
  exec: (sql) => raw.exec(sql),
  transaction,
  pragma: (str) => raw.exec('PRAGMA ' + str),
  close: () => raw.close()
};

// Flush + release on shutdown (Linux deploy restarts send SIGTERM).
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try { raw.close(); } catch (e) {}
    process.exit(0);
  });
}

module.exports = db;
module.exports.DB_PATH = DB_PATH;
