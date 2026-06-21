'use strict';

/** Small formatting / safety helpers shared across the app. */

const site = require('../config/site');

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(value) {
  const num = Number(value) || 0;
  return `${site.currency} ${num.toLocaleString('en-US')}`;
}

function formatMileage(value) {
  const num = Number(value) || 0;
  return `${num.toLocaleString('en-US')} km`;
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** vehicles.features is stored as a JSON array string — parse defensively. */
function parseFeatures(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch (_e) {
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function absoluteUrl(pathname = '') {
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return site.url + (pathname.startsWith('/') ? pathname : `/${pathname}`);
}

function truncate(str, len = 160) {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  return s.length > len ? `${s.slice(0, len - 1).trimEnd()}…` : s;
}

module.exports = {
  escapeHtml,
  formatPrice,
  formatMileage,
  slugify,
  parseFeatures,
  absoluteUrl,
  truncate
};
