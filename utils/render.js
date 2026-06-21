'use strict';

/**
 * Tiny HTML renderer for static views.
 * -------------------------------------
 * Keeps the "HTML5 + CSS3 + Vanilla JS" stack intact (the views are plain
 * .html files) while still giving us two server-side super-powers:
 *
 *   1. Partials / a reusable logo+header+footer:  {{> partials/header }}
 *   2. SEO + business tokens injected per request: {{ TITLE }}, {{ SITE_PHONE }} …
 *
 * Partial-resolved templates are cached in production; tokens are applied
 * on every request (so CSRF + per-page meta stay correct).
 */

const fs = require('fs');
const path = require('path');
const site = require('../config/site');
const { escapeHtml } = require('./helpers');

const VIEWS_DIR = path.join(__dirname, '..', 'views');
const IS_PROD = process.env.NODE_ENV === 'production';
const cache = new Map();

const INCLUDE_RE = /{{>\s*([\w\-./]+)\s*}}/g;
const TOKEN_RE = /{{\s*([A-Z0-9_]+)\s*}}/g;

function readView(viewPath) {
  const file = viewPath.endsWith('.html') ? viewPath : `${viewPath}.html`;
  return fs.readFileSync(path.join(VIEWS_DIR, file), 'utf8');
}

/** Recursively inline {{> partial }} includes. */
function resolveIncludes(content, depth = 0) {
  if (depth > 10) return content; // guard against include loops
  return content.replace(INCLUDE_RE, (_m, name) =>
    resolveIncludes(readView(name), depth + 1)
  );
}

function getTemplate(view) {
  if (!IS_PROD && cache.has(view)) cache.delete(view); // always fresh in dev
  if (cache.has(view)) return cache.get(view);
  const tpl = resolveIncludes(readView(view));
  if (IS_PROD) cache.set(view, tpl);
  return tpl;
}

function baseTokens(req, res) {
  return {
    SITE_NAME: site.name,
    SITE_LEGAL_NAME: site.legalName,
    SITE_TAGLINE: site.tagline,
    SITE_DESC: site.shortDescription,
    SITE_URL: site.url,
    SITE_PHONE: site.phoneDisplay,
    SITE_PHONE_RAW: site.phone,
    SITE_WHATSAPP: site.whatsapp,
    SITE_WHATSAPP_LINK: site.whatsappLink(
      `Hello ${site.name}, I'm interested in a vehicle from your showroom.`
    ),
    SITE_EMAIL: site.email,
    SITE_ADDRESS: site.addressLine,
    SITE_HOURS: site.hours,
    SITE_CURRENCY: site.currency,
    SITE_MAP_EMBED: site.mapEmbedUrl,
    SITE_MAP_LINK: site.mapLink,
    SOC_FACEBOOK: site.social.facebook,
    SOC_INSTAGRAM: site.social.instagram,
    SOC_X: site.social.x,
    SOC_YOUTUBE: site.social.youtube,
    SOC_TIKTOK: site.social.tiktok,
    YEAR: String(new Date().getFullYear()),
    CSRF_TOKEN: (res.locals && res.locals.csrfToken) || ''
  };
}

/**
 * render(req, res, view, opts)
 *   opts: { title, description, keywords, ogImage, ogType, canonical,
 *           jsonLd, bodyClass, status }
 */
function render(req, res, view, opts = {}) {
  const reqPath = req.originalUrl.split('?')[0];
  const canonical = opts.canonical || site.url + reqPath;
  const title = opts.title
    ? `${opts.title} | ${site.name}`
    : `${site.name} — ${site.tagline}`;
  const description = opts.description || site.shortDescription;
  const ogImage = (opts.ogImage || '/images/og-default.svg');
  const ogImageAbs = /^https?:\/\//i.test(ogImage) ? ogImage : site.url + ogImage;

  // Per-page meta can contain admin/DB-sourced text, and is placed inside HTML
  // attributes/elements — so escape it. SITE_* config tokens are trusted and
  // left raw; JSON_LD is pre-serialised (and </script>-safe) by the caller.
  const keywords =
    opts.keywords || 'used cars Abu Dhabi, pre-owned vehicles UAE, luxury cars, DriveX Motors';
  const tokens = {
    ...baseTokens(req, res),
    TITLE: escapeHtml(title),
    META_DESCRIPTION: escapeHtml(description),
    META_KEYWORDS: escapeHtml(keywords),
    OG_TITLE: escapeHtml(opts.ogTitle || title),
    OG_DESCRIPTION: escapeHtml(description),
    OG_IMAGE: escapeHtml(ogImageAbs),
    OG_URL: escapeHtml(canonical),
    OG_TYPE: opts.ogType || 'website',
    CANONICAL: escapeHtml(canonical),
    JSON_LD: opts.jsonLd || '',
    BODY_CLASS: opts.bodyClass || ''
  };

  const html = getTemplate(view).replace(TOKEN_RE, (_m, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? String(tokens[key]) : ''
  );

  res
    .status(opts.status || 200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .send(html);
}

module.exports = { render };
