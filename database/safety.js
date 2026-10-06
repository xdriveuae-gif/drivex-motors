'use strict';

/**
 * Database safety net for node-sqlite3-wasm.
 *
 * That driver has no real cross-process locking (its VFS uses one "<file>.lock"
 * directory), so two live processes on one file corrupt it. This module:
 *   1. refuses to open the DB while another instance of the app is alive
 *      (Hostinger restarts the app on its own, leaving the old worker running),
 *   2. checks integrity at boot and, if the file is malformed, restores the
 *      newest healthy backup or salvages every readable row into a fresh DB,
 *   3. keeps rolling backups so a bad day costs minutes of data, not everything.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Database } = require('node-sqlite3-wasm');

const BACKUP_KEEP = 14;
const BACKUP_EVERY_MS = 6 * 60 * 60 * 1000;
const BACKUP_MIN_GAP_MS = 60 * 60 * 1000;
const TABLES = [
  'admins', 'vehicles', 'vehicle_images', 'contact_messages',
  'vehicle_submissions', 'submission_images'
];

function sleepMs(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function waitUntilDead(pid, ms) {
  const end = Date.now() + ms;
  while (isPidAlive(pid) && Date.now() < end) sleepMs(100);
  return !isPidAlive(pid);
}

// Guards against a stale pid file whose number was recycled by an unrelated
// process: only ever signal something that looks like a Node app.
function looksLikeNodeProcess(pid) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
      return /node/i.test(out);
    }
    return /node|server\.js/i.test(fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8'));
  } catch (e) { return false; }
}

function ensureExclusiveOwnership(ownerPidPath) {
  let ownerPid;
  try { ownerPid = parseInt(fs.readFileSync(ownerPidPath, 'utf8'), 10); } catch (e) { return; }
  if (ownerPid === process.pid || !isPidAlive(ownerPid)) return;

  console.log(`  Previous instance (pid ${ownerPid}) is still running — waiting for it to release the database...`);
  if (waitUntilDead(ownerPid, 5000)) return;

  if (looksLikeNodeProcess(ownerPid)) {
    console.warn(`  pid ${ownerPid} did not exit — asking it to shut down (SIGTERM).`);
    try { process.kill(ownerPid, 'SIGTERM'); } catch (e) {}
    if (waitUntilDead(ownerPid, 8000)) return;
    console.warn(`  pid ${ownerPid} ignored SIGTERM — forcing it to stop (SIGKILL).`);
    try { process.kill(ownerPid, 'SIGKILL'); } catch (e) {}
    if (waitUntilDead(ownerPid, 4000)) return;
  }

  // Opening the file now would put two writers on it. A crash-and-retry by the
  // host is far cheaper than corrupting the database again.
  console.error(`  ✗ pid ${ownerPid} still holds the database and could not be stopped. Refusing to start.`);
  process.exit(1);
}

function quickCheck(file) {
  let conn;
  try {
    conn = new Database(file, { readOnly: true, fileMustExist: true });
    const rows = conn.all('PRAGMA quick_check');
    return rows.length === 1 && Object.values(rows[0])[0] === 'ok';
  } catch (e) {
    return false;
  } finally {
    try { conn && conn.close(); } catch (e) {}
  }
}

function listBackups(backupDir) {
  try {
    return fs.readdirSync(backupDir)
      .filter((f) => /^database-\d{8}-\d{6}\.db$/.test(f))
      .sort()
      .reverse()
      .map((f) => path.join(backupDir, f));
  } catch (e) { return []; }
}

function readRowsLoosely(src, table) {
  try { return src.all(`SELECT * FROM ${table}`); } catch (e) { /* fall through to probing */ }
  let maxId = 20000;
  try {
    const s = src.get('SELECT seq FROM sqlite_sequence WHERE name = ?', [table]);
    if (s && s.seq) maxId = s.seq + 50;
  } catch (e) {}
  const rows = [];
  const sql = `SELECT * FROM ${table} WHERE rowid BETWEEN ? AND ?`;
  for (let a = 1; a <= maxId; a += 25) {
    try { rows.push(...src.all(sql, [a, a + 24])); continue; } catch (e) {}
    for (let r = a; r < a + 25; r++) {
      try { rows.push(...src.all(sql, [r, r])); } catch (e) {}
    }
  }
  return rows;
}

// `overwrite`: the target is a restored backup, so rows still readable in the
// corrupt file are newer and replace the backup's copy. Otherwise it is empty.
function salvageInto(corruptFile, dbPath, schemaSql, overwrite) {
  const dst = new Database(dbPath);
  dst.exec('PRAGMA foreign_keys = OFF');
  try { dst.exec(schemaSql); } catch (e) { /* older backup without newer columns: import by shared columns */ }
  let src;
  const counts = {};
  try {
    src = new Database(corruptFile, { readOnly: true, fileMustExist: true });
    for (const table of TABLES) {
      let srcCols;
      try { srcCols = src.all(`PRAGMA table_info(${table})`).map((c) => c.name); } catch (e) { continue; }
      const dstCols = dst.all(`PRAGMA table_info(${table})`).map((c) => c.name);
      const cols = dstCols.filter((c) => srcCols.includes(c));
      if (!cols.length) continue;
      const rows = readRowsLoosely(src, table);
      const ins = dst.prepare(
        `INSERT OR ${overwrite ? 'REPLACE' : 'IGNORE'} INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
      );
      let n = 0;
      dst.exec('BEGIN');
      for (const row of rows) {
        try { ins.run(cols.map((c) => (row[c] === undefined ? null : row[c]))); n++; } catch (e) {}
      }
      dst.exec('COMMIT');
      ins.finalize();
      counts[table] = n;
    }
  } finally {
    try { src && src.close(); } catch (e) {}
  }
  dst.exec('DELETE FROM vehicle_images WHERE vehicle_id NOT IN (SELECT id FROM vehicles)');
  dst.exec('DELETE FROM submission_images WHERE submission_id NOT IN (SELECT id FROM vehicle_submissions)');
  dst.exec('UPDATE contact_messages SET vehicle_id = NULL WHERE vehicle_id IS NOT NULL AND vehicle_id NOT IN (SELECT id FROM vehicles)');
  dst.close();
  return counts;
}

function repairIfCorrupt(dbPath, backupDir, schemaSql) {
  if (!fs.existsSync(dbPath) || quickCheck(dbPath)) return;

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const aside = `${dbPath}.corrupt-${stamp}`;
  console.error(`  ✗ Database failed its integrity check. Moving it to ${path.basename(aside)} and recovering...`);
  fs.renameSync(dbPath, aside);
  try { fs.rmSync(dbPath + '.lock', { recursive: true, force: true }); } catch (e) {}
  try { fs.rmSync(dbPath + '-journal', { force: true }); } catch (e) {}

  let restoredFrom = null;
  for (const backup of listBackups(backupDir)) {
    if (!quickCheck(backup)) continue;
    fs.copyFileSync(backup, dbPath);
    restoredFrom = path.basename(backup);
    break;
  }

  const counts = salvageInto(aside, dbPath, schemaSql, !!restoredFrom);
  console.error(restoredFrom
    ? `  ✓ Restored backup ${restoredFrom}, then merged newer rows still readable in the corrupt file: ${JSON.stringify(counts)}`
    : `  ✓ No usable backup — salvaged readable rows into a fresh database: ${JSON.stringify(counts)}`);
}

function startBackups(raw, dbPath, backupDir) {
  function backupNow() {
    try {
      const existing = listBackups(backupDir);
      if (existing.length) {
        const age = Date.now() - fs.statSync(existing[0]).mtimeMs;
        if (age < BACKUP_MIN_GAP_MS) return;
      }
      const rows = raw.all('PRAGMA quick_check');
      if (!(rows.length === 1 && Object.values(rows[0])[0] === 'ok')) {
        console.error('  ✗ Skipping backup: live database failed its integrity check.');
        return;
      }
      fs.mkdirSync(backupDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const file = path.join(backupDir, `database-${stamp.slice(0, 8)}-${stamp.slice(8)}.db`);
      raw.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
      if (!quickCheck(file)) { fs.rmSync(file, { force: true }); return; }
      listBackups(backupDir).slice(BACKUP_KEEP).forEach((f) => fs.rmSync(f, { force: true }));
    } catch (e) {
      console.error('  ✗ Backup failed:', e.message);
    }
  }
  backupNow();
  setInterval(backupNow, BACKUP_EVERY_MS).unref();
}

module.exports = { ensureExclusiveOwnership, repairIfCorrupt, startBackups, quickCheck };
