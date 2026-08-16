'use strict';

/**
 * Create (or reset) an admin account.
 * ----------------------------------
 *   node database/create-admin.js <username> <password>
 *   node database/create-admin.js <username> <password> --force   → reset an existing account's password
 *
 * Credentials may also be supplied via the environment, which keeps the
 * password out of shell history — preferred on the server:
 *
 *   NEW_ADMIN_USERNAME=osama NEW_ADMIN_PASSWORD='...' node database/create-admin.js
 *
 * `ensureDefaultAdmin` in seed.js only manages the ONE account named by
 * ADMIN_USERNAME/ADMIN_PASSWORD; this script is how additional admins are
 * added. Hashing matches it exactly (bcryptjs, cost 12), and the account is
 * written to whatever database DB_PATH points at.
 */

require('dotenv').config();
const path = require('path');
const bcrypt = require('bcryptjs');

// Resolved the same way db.js does it. Printed on every run: if DB_PATH is
// unset or still holds an unsubstituted template like {{USERNAME}}, node
// silently resolves it to a bogus location and creates an empty database
// there instead of failing — so the account lands somewhere nobody reads.
// Seeing the real target is the only cheap way to catch that.
const RESOLVED_DB = path.resolve(
  process.env.DB_PATH || path.join(__dirname, 'database.db')
);

// This guard MUST run before ./db is required: db.js opens the database (and
// mkdir -p's its parent) at import time, so by the time any function here runs
// the bogus directory has already been created or the process has died with a
// raw EPERM stack. Exiting here is safe — no wasm handles exist yet.
if (require.main === module && RESOLVED_DB.includes('{{')) {
  console.error(`✗ DB_PATH still contains an unsubstituted {{placeholder}}: ${RESOLVED_DB}`);
  console.error('  Set a real DB_PATH, e.g.');
  console.error('  DB_PATH=/home/<user>/persistent_data/database/database.db');
  process.exit(1);
}

const db = require('./db');

const BCRYPT_COST = 12;

function createAdmin(username, password, { force = false } = {}) {
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);

  if (existing && !force) return { created: false, username };

  const hash = bcrypt.hashSync(password, BCRYPT_COST);

  if (existing) {
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, existing.id);
    return { created: false, reset: true, username, id: existing.id };
  }

  const info = db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  return { created: true, username, id: info.lastInsertRowid };
}

module.exports = { createAdmin };

/* ─── Run directly: node database/create-admin.js <username> <password> [--force] ─── */
//
// NOTE: no process.exit() below. Forcing exit while node-sqlite3-wasm still
// holds handles trips a libuv assertion on Windows ("UV_HANDLE_CLOSING") and
// replaces the real exit code with garbage — which would silently break any
// deploy script checking the result. Set process.exitCode, close the database,
// and let node drain and exit on its own.
function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--force');
  const force = process.argv.includes('--force');

  const username = (args[0] || process.env.NEW_ADMIN_USERNAME || '').trim();
  const password = args[1] || process.env.NEW_ADMIN_PASSWORD || '';

  if (!username || !password) {
    console.error('Usage: node database/create-admin.js <username> <password> [--force]');
    console.error('   or: NEW_ADMIN_USERNAME=… NEW_ADMIN_PASSWORD=… node database/create-admin.js');
    process.exitCode = 1;
    return;
  }

  // Mirrors the limits in loginValidators — an account that cannot satisfy
  // them would be impossible to log in with.
  if (username.length > 80 || password.length > 200) {
    console.error('✗ Username must be ≤ 80 characters and password ≤ 200.');
    process.exitCode = 1;
    return;
  }

  console.log(`Database: ${RESOLVED_DB}`);

  const result = createAdmin(username, password, { force });

  if (result.created) {
    console.log(`✓ Admin created → username: "${result.username}" (id ${result.id})`);
  } else if (result.reset) {
    console.log(`✓ Password reset for existing admin "${result.username}" (id ${result.id})`);
  } else {
    console.log(`• Admin "${result.username}" already exists — left untouched. Use --force to reset the password.`);
  }

  console.log('\nAdmins in this database:');
  for (const a of db.prepare('SELECT id, username, created_at FROM admins ORDER BY id').all()) {
    console.log(`  ${a.id}  ${a.username}  (created ${a.created_at})`);
  }
}

if (require.main === module) {
  try {
    main();
  } finally {
    try { db.close(); } catch (_e) { /* already closed */ }
  }
}
