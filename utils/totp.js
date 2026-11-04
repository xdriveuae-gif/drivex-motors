'use strict';

/**
 * Time-based one-time passwords (RFC 6238: SHA-1, 6 digits, 30 seconds), the
 * format Google Authenticator and similar apps use, plus one-use backup codes.
 */

const crypto = require('crypto');
const qrcode = require('qrcode-generator');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_MS = 30000;
const BACKUP_CODE_COUNT = 10;

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of str) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(out);
}

const generateSecret = () => base32Encode(crypto.randomBytes(20));

function codeForStep(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

const stepAt = (ms) => Math.floor(ms / STEP_MS);

/**
 * Returns the matching time step, or null. Allows one step of clock drift each
 * way, and refuses steps at or before lastStep so a code can't be used twice.
 */
function matchStep(secret, code, lastStep = 0, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const current = stepAt(now);
  for (const step of [current - 1, current, current + 1]) {
    if (step > lastStep && crypto.timingSafeEqual(Buffer.from(codeForStep(secret, step)), Buffer.from(code))) {
      return step;
    }
  }
  return null;
}

const normalizeBackupCode = (code) => String(code).toUpperCase().replace(/[^A-Z2-7]/g, '');
const hashBackupCode = (code) => crypto.createHash('sha256').update(normalizeBackupCode(code)).digest('hex');

function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    codes.push(base32Encode(crypto.randomBytes(10)).match(/.{4}/g).join('-'));
  }
  return codes;
}

function otpauthUrl(secret, username, issuer) {
  const label = encodeURIComponent(`${issuer}:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function qrDataUrl(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createDataURL(6, 12);
}

module.exports = {
  generateSecret,
  codeForStep,
  stepAt,
  matchStep,
  hashBackupCode,
  generateBackupCodes,
  otpauthUrl,
  qrDataUrl
};
