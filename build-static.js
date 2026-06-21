'use strict';

/**
 * Static-site builder for shared hosting (Hostinger Web Hosting, etc.)
 * --------------------------------------------------------------------
 * Renders the server views into plain .html, inlines partials, fills in
 * all business tokens, bakes the current inventory into an editable
 * js/data.js, and assembles an upload-ready folder.
 *
 *   node build-static.js
 *
 * Output: ./dist   (inside this project)
 * Set your real domain:  STATIC_DOMAIN=https://yourdomain.com node build-static.js
 */

const fs = require('fs');
const path = require('path');
const site = require('./config/site');
const db = require('./database/db');
const { escapeHtml, parseFeatures } = require('./utils/helpers');

const ROOT = __dirname;
const VIEWS = path.join(ROOT, 'views');
const PUB = path.join(ROOT, 'public');
const SRC = path.join(ROOT, 'static-src');
const OUT = path.resolve(process.env.STATIC_OUT || ROOT, 'dist');
const DOMAIN = (process.env.STATIC_DOMAIN || 'https://www.drivexmotors.ae').replace(/\/$/, '');

/* ---------- template helpers (mirror utils/render.js) ---------- */
function readView(p) {
  const f = p.endsWith('.html') ? p : p + '.html';
  return fs.readFileSync(path.join(VIEWS, f), 'utf8');
}
function resolveIncludes(content, depth) {
  depth = depth || 0;
  if (depth > 10) return content;
  return content.replace(/{{>\s*([\w\-./]+)\s*}}/g, (_m, name) => resolveIncludes(readView(name), depth + 1));
}
function fillTokens(tpl, tokens) {
  return tpl.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_m, k) =>
    Object.prototype.hasOwnProperty.call(tokens, k) ? String(tokens[k]) : ''
  );
}

function buildTokens(meta) {
  const canonical = DOMAIN + '/' + (meta.file === 'index.html' ? '' : meta.file);
  const title = meta.title ? `${meta.title} | ${site.name}` : `${site.name} — ${site.tagline}`;
  const description = meta.description || site.shortDescription;
  const ogImage = DOMAIN + '/images/og-default.svg';
  return {
    SITE_NAME: site.name, SITE_LEGAL_NAME: site.legalName, SITE_TAGLINE: site.tagline,
    SITE_DESC: site.shortDescription, SITE_URL: DOMAIN,
    SITE_PHONE: site.phoneDisplay, SITE_PHONE_RAW: site.phone, SITE_WHATSAPP: site.whatsapp,
    SITE_WHATSAPP_LINK: site.whatsappLink(`Hello ${site.name}, I'm interested in a vehicle from your showroom.`),
    SITE_EMAIL: site.email, SITE_ADDRESS: site.addressLine, SITE_HOURS: site.hours, SITE_CURRENCY: site.currency,
    SITE_MAP_EMBED: site.mapEmbedUrl, SITE_MAP_LINK: site.mapLink,
    SOC_FACEBOOK: site.social.facebook, SOC_INSTAGRAM: site.social.instagram, SOC_X: site.social.x,
    SOC_YOUTUBE: site.social.youtube, SOC_TIKTOK: site.social.tiktok,
    YEAR: String(new Date().getFullYear()), CSRF_TOKEN: '',
    TITLE: escapeHtml(title), META_DESCRIPTION: escapeHtml(description),
    META_KEYWORDS: escapeHtml(meta.keywords || 'used cars Abu Dhabi, pre-owned vehicles UAE, luxury cars, DriveX Motors'),
    OG_TITLE: escapeHtml(title), OG_DESCRIPTION: escapeHtml(description), OG_IMAGE: escapeHtml(ogImage),
    OG_URL: escapeHtml(canonical), OG_TYPE: 'website', CANONICAL: escapeHtml(canonical),
    JSON_LD: '', BODY_CLASS: meta.bodyClass || ''
  };
}

const SCRIPT_BLOCK_FROM =
  '  <script src="/js/main.js" defer></script>\n' +
  '  <script src="/js/favorites.js" defer></script>';
const SCRIPT_BLOCK_TO =
  '  <script src="/js/data.js" defer></script>\n' +
  '  <script src="/js/main.js" defer></script>\n' +
  '  <script src="/js/store.js" defer></script>\n' +
  '  <script src="/js/favorites.js" defer></script>';

const PAGES = [
  { view: 'index', file: 'index.html', bodyClass: 'page-home' },
  { view: 'inventory', file: 'inventory.html', title: 'Vehicle Inventory', bodyClass: 'page-inventory', keywords: 'used cars Abu Dhabi, car inventory UAE, buy used car, pre-owned SUV' },
  { view: 'about', file: 'about.html', title: 'About Us', bodyClass: 'page-about' },
  { view: 'contact', file: 'contact.html', title: 'Contact Us', bodyClass: 'page-contact' },
  { view: 'vehicle-details', file: 'vehicle.html', title: 'Vehicle Details', bodyClass: 'page-vehicle' },
  { view: '404', file: '404.html', title: 'Page Not Found', bodyClass: 'page-404' }
];

/* ---------- build ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });

// 1) HTML pages
PAGES.forEach((p) => {
  let html = fillTokens(resolveIncludes(readView(p.view)), buildTokens(p));
  html = html.replace(SCRIPT_BLOCK_FROM, SCRIPT_BLOCK_TO);
  if (p.view === 'vehicle-details') html = html.replace('/js/vehicle-details.js', '/js/vehicle.js');
  fs.writeFileSync(path.join(OUT, p.file), html);
});

// 2) assets
fs.copyFileSync(path.join(PUB, 'css', 'styles.css'), path.join(OUT, 'css', 'styles.css'));
fs.copyFileSync(path.join(PUB, 'favicon.svg'), path.join(OUT, 'favicon.svg'));
fs.cpSync(path.join(PUB, 'images'), path.join(OUT, 'images'), { recursive: true });

// uploaded vehicle photos added via the admin panel (so /uploads/... paths resolve)
const uploadsSrc = path.join(ROOT, 'uploads');
if (fs.existsSync(uploadsSrc)) {
  fs.cpSync(uploadsSrc, path.join(OUT, 'uploads'), { recursive: true });
}

// 3) unchanged scripts
['favorites.js', 'home.js', 'inventory.js'].forEach((f) =>
  fs.copyFileSync(path.join(PUB, 'js', f), path.join(OUT, 'js', f))
);

// 4) static-only scripts
['store.js', 'contact.js'].forEach((f) =>
  fs.copyFileSync(path.join(SRC, f), path.join(OUT, 'js', f))
);

// 5) main.js — point card links at vehicle.html?id=
let mainJs = fs.readFileSync(path.join(PUB, 'js', 'main.js'), 'utf8');
mainJs = mainJs.split("/vehicle/' + v.id").join("/vehicle.html?id=' + v.id");
fs.writeFileSync(path.join(OUT, 'js', 'main.js'), mainJs);

// 6) vehicle.js — id from ?id=, links to vehicle.html?id=
let vehJs = fs.readFileSync(path.join(PUB, 'js', 'vehicle-details.js'), 'utf8');
vehJs = vehJs.replace(
  '  var m = location.pathname.match(/\\/vehicle\\/(\\d+)/);\n  var id = m ? m[1] : null;',
  "  var id = new URLSearchParams(location.search).get('id');"
);
vehJs = vehJs.split("'/vehicle/' + vehicle.id").join("'/vehicle.html?id=' + vehicle.id");
fs.writeFileSync(path.join(OUT, 'js', 'vehicle.js'), vehJs);

// 7) data.js — baked, editable inventory
const rows = db.prepare('SELECT * FROM vehicles ORDER BY datetime(created_at) DESC, id DESC').all();
const vehicles = rows.map((v) => ({
  id: v.id, title: v.title, make: v.make, model: v.model, year: v.year, price: v.price,
  mileage: v.mileage, engine: v.engine, transmission: v.transmission, fuel_type: v.fuel_type,
  body_type: v.body_type, color: v.color, vin: v.vin, description: v.description,
  features: parseFeatures(v.features), is_featured: v.is_featured ? 1 : 0, is_sold: v.is_sold ? 1 : 0,
  created_at: v.created_at,
  images: db.prepare('SELECT file_path FROM vehicle_images WHERE vehicle_id = ? ORDER BY is_primary DESC, sort_order ASC, id ASC').all(v.id).map((r) => r.file_path)
}));
const dataHeader =
  '/* ============================================================\n' +
  '   DriveX Motors — INVENTORY DATA  (edit this file to manage cars)\n' +
  '   ------------------------------------------------------------\n' +
  '   • Add a car: copy an object in the array and change the fields.\n' +
  '   • Remove a car: delete its object.\n' +
  '   • Mark sold: set "is_sold": 1.  Feature on home: "is_featured": 1.\n' +
  '   • Images: put files in /images and list their paths, e.g.\n' +
  '       "images": ["/images/cars/patrol-1.jpg", "/images/cars/patrol-2.jpg"]\n' +
  '   • Each car needs a UNIQUE "id".\n' +
  '   ============================================================ */\n';
fs.writeFileSync(path.join(OUT, 'js', 'data.js'), dataHeader + 'window.DX_VEHICLES = ' + JSON.stringify(vehicles, null, 2) + ';\n');

// 8) robots.txt
fs.writeFileSync(path.join(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${DOMAIN}/sitemap.xml\n`);

// 9) sitemap.xml
const staticUrls = ['', 'inventory.html', 'about.html', 'contact.html'];
const vehicleUrls = vehicles.filter((v) => !v.is_sold).map((v) => 'vehicle.html?id=' + v.id);
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  staticUrls.concat(vehicleUrls).map((u) =>
    `  <url><loc>${DOMAIN}/${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);

// 10) .htaccess (clean-URL rewrites + custom 404 + caching)
fs.writeFileSync(path.join(OUT, '.htaccess'),
  '<IfModule mod_rewrite.c>\n' +
  '  RewriteEngine On\n' +
  '  # Serve extensionless URLs (/inventory, /about, /contact) from their .html files\n' +
  '  RewriteCond %{REQUEST_FILENAME} !-f\n' +
  '  RewriteCond %{REQUEST_FILENAME} !-d\n' +
  '  RewriteCond %{REQUEST_FILENAME}.html -f\n' +
  '  RewriteRule ^(.*)$ $1.html [L]\n' +
  '</IfModule>\n\n' +
  'ErrorDocument 404 /404.html\n\n' +
  '<IfModule mod_expires.c>\n' +
  '  ExpiresActive On\n' +
  '  ExpiresByType text/css "access plus 7 days"\n' +
  '  ExpiresByType application/javascript "access plus 7 days"\n' +
  '  ExpiresByType image/svg+xml "access plus 30 days"\n' +
  '  ExpiresByType image/jpeg "access plus 30 days"\n' +
  '  ExpiresByType image/png "access plus 30 days"\n' +
  '</IfModule>\n');

// 11) upload instructions
fs.writeFileSync(path.join(OUT, 'UPLOAD-TO-HOSTINGER.txt'),
  'DriveX Motors — static site\n' +
  '===========================\n\n' +
  'HOW TO PUBLISH ON HOSTINGER (shared Web Hosting):\n' +
  '1. Log in to hPanel > Files > File Manager.\n' +
  '2. Open the public_html folder.\n' +
  '3. Upload EVERYTHING inside this folder (index.html, css/, js/, images/,\n' +
  '   .htaccess, etc.) into public_html. (Tip: zip this folder, upload the zip,\n' +
  '   then "Extract" inside public_html.)\n' +
  '4. Visit your domain — the site is live.\n\n' +
  'MANAGE YOUR CARS:\n' +
  '- Edit  js/data.js  to add / edit / remove vehicles (instructions are at the\n' +
  '  top of that file). Re-upload it after changes.\n' +
  '- Add car photos into the images/ folder and reference them in data.js.\n\n' +
  'NOTES:\n' +
  '- Set your real domain before building for accurate links/sitemap:\n' +
  '    STATIC_DOMAIN=https://yourdomain.com node build-static.js   (current: ' + DOMAIN + ')\n' +
  '- The contact form opens WhatsApp with the message (no server needed).\n' +
  '- There is no admin panel in the static version (manage cars via data.js).\n' +
  '- Open the site through your domain (or a local web server), not by double-\n' +
  '  clicking the .html files — the shared "/css, /js, /images" paths need a\n' +
  '  web root to resolve.\n');

console.log('✓ Static site built → ' + OUT);
console.log('  Pages: ' + PAGES.map((p) => p.file).join(', '));
console.log('  Vehicles baked into js/data.js: ' + vehicles.length);
console.log('  Domain used for links/sitemap: ' + DOMAIN + '  (override with STATIC_DOMAIN)');
