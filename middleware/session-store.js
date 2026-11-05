'use strict';

/**
 * Session store that survives restarts.
 * -------------------------------------
 * express-session's default store lives in memory, so every restart or deploy
 * logged admins out and invalidated the CSRF token of every open page.
 *
 * Sessions are served from memory and copied to one JSON file beside the
 * database, about a second after each change. This is deliberately not in
 * SQLite: sessions change on nearly every visit, and that write traffic should
 * stay away from the database holding the cars. If the file is ever damaged or
 * deleted the only effect is that people log in again.
 */

const fs = require('fs');
const session = require('express-session');

const WRITE_DELAY_MS = 1000;
const TOUCH_WRITE_GAP_MS = 5 * 60 * 1000; // a mere expiry extension isn't worth a write until it's this old
const MAX_SESSIONS = 50000;
const DEFAULT_LIFETIME_MS = 8 * 60 * 60 * 1000;

function expiryOf(sess) {
  const at = sess && sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : NaN;
  return Number.isFinite(at) ? at : Date.now() + DEFAULT_LIFETIME_MS;
}

class FileSessionStore extends session.Store {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.tmpPath = filePath + '.tmp';
    this.sessions = new Map(); // sid -> { data: JSON string, expires: ms }
    this.timer = null;
    this.writing = false;
    this.dirty = false;
    this.warned = false;
    this.load();
    // Keep the last second of changes on a normal shutdown (db.js exits on SIGTERM/SIGINT).
    process.on('exit', () => this.flushSync());
  }

  load() {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') console.warn('Session file unreadable, starting with no sessions:', e.message);
      return;
    }
    const now = Date.now();
    Object.keys(parsed || {}).forEach((sid) => {
      const row = parsed[sid];
      if (row && typeof row.data === 'string' && row.expires > now) this.sessions.set(sid, row);
    });
  }

  serialize() {
    const now = Date.now();
    this.sessions.forEach((row, sid) => { if (row.expires <= now) this.sessions.delete(sid); });
    if (this.sessions.size > MAX_SESSIONS) {
      const soonest = [...this.sessions.entries()].sort((a, b) => a[1].expires - b[1].expires);
      soonest.slice(0, this.sessions.size - MAX_SESSIONS).forEach(([sid]) => this.sessions.delete(sid));
    }
    return JSON.stringify(Object.fromEntries(this.sessions));
  }

  scheduleWrite() {
    this.dirty = true;
    if (this.timer || this.writing) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.write();
    }, WRITE_DELAY_MS);
    this.timer.unref();
  }

  // Written to a temp file and renamed, so a crash can't leave half a file behind.
  write() {
    this.dirty = false;
    this.writing = true;
    fs.writeFile(this.tmpPath, this.serialize(), { mode: 0o600 }, (err) => {
      const done = (e) => {
        this.writing = false;
        if (e && !this.warned) {
          this.warned = true;
          console.warn('Could not save sessions (they still work until the next restart):', e.message);
        }
        if (this.dirty) this.scheduleWrite();
      };
      if (err) return done(err);
      fs.rename(this.tmpPath, this.filePath, done);
    });
  }

  flushSync() {
    if (!this.dirty && !this.timer) return;
    try {
      fs.writeFileSync(this.tmpPath, this.serialize(), { mode: 0o600 });
      fs.renameSync(this.tmpPath, this.filePath);
    } catch (e) { /* exiting anyway */ }
  }

  get(sid, cb) {
    const row = this.sessions.get(sid);
    if (!row) return setImmediate(cb, null, null);
    if (row.expires <= Date.now()) {
      this.sessions.delete(sid);
      this.scheduleWrite();
      return setImmediate(cb, null, null);
    }
    let data = null;
    try { data = JSON.parse(row.data); } catch (e) { this.sessions.delete(sid); }
    return setImmediate(cb, null, data);
  }

  set(sid, sess, cb) {
    this.sessions.set(sid, { data: JSON.stringify(sess), expires: expiryOf(sess), writtenExpires: expiryOf(sess) });
    this.scheduleWrite();
    if (cb) setImmediate(cb, null);
  }

  destroy(sid, cb) {
    if (this.sessions.delete(sid)) this.scheduleWrite();
    if (cb) setImmediate(cb, null);
  }

  touch(sid, sess, cb) {
    const row = this.sessions.get(sid);
    if (row) {
      row.expires = expiryOf(sess);
      if (row.expires - (row.writtenExpires || 0) > TOUCH_WRITE_GAP_MS) {
        row.writtenExpires = row.expires;
        this.scheduleWrite();
      }
    }
    if (cb) setImmediate(cb, null);
  }
}

module.exports = FileSessionStore;
