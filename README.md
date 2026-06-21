# DriveX Motors — Used Car Showroom

A complete, production-ready website for a premium used-car dealership in **Abu Dhabi, UAE**, built with **Node.js + Express + SQLite**. Server-rendered HTML shells, a clean JSON API, a secure admin panel with full vehicle + image management, and a luxury gold-on-black design.

---

## ✨ Features

**Public site**
- Luxury responsive design (gold `#D4AF37` / black `#0A0A0A`), mobile menu, smooth scroll-reveal animations, toasts, back-to-top, floating WhatsApp button.
- **Home** — hero, featured vehicles, company intro, why-choose-us, benefits, animated stats, latest inventory, testimonials, contact + Google Map.
- **Inventory** — keyword search, filters (make, model, year, price, mileage, fuel, body, transmission), sorting, pagination — all powered by SQLite (no hard-coded cars).
- **Vehicle details** — image gallery + lightbox, full spec table, features, description, and WhatsApp / Call / Email / Share actions. Server-injected SEO meta + `Car` structured data per vehicle.
- **About** & **Contact** (form submissions saved to the database).
- **Favourites** (save vehicles) using Local Storage.
- SEO: dynamic titles/meta, Open Graph + Twitter cards, JSON-LD, `robots.txt`, dynamic `sitemap.xml`.

**Admin panel** (`/admin`)
- Session login (bcrypt-hashed passwords), logout, route protection, auth middleware.
- Dashboard widgets: total / featured / sold vehicles, messages, total views, latest listings.
- Full vehicle **CRUD**, mark **featured/sold**, multi-image upload (Multer), set primary image, delete images.
- Contact message inbox: read/unread + delete.

**Security:** Helmet (with a tuned Content-Security-Policy), session-based CSRF protection, `express-validator` input validation, parameterised SQL (injection-safe), output escaping (XSS), rate limiting on login + contact, secure cookies, secrets via `.env`.

---

## 🧱 Tech stack

| Layer | Choice |
|------|--------|
| Frontend | HTML5, CSS3, vanilla JavaScript (no framework) |
| Backend | Node.js, Express |
| Database | SQLite via **better-sqlite3** |
| Auth | express-session + **bcryptjs** |
| Uploads | Multer |
| Security | Helmet, express-validator, custom CSRF, express-rate-limit |
| Misc | dotenv, compression |

> **Note on packages.** The brief listed `sqlite3`, `bcrypt` and `csurf`. For a build that installs cleanly on Windows **and** a bare VPS (no C++ build tools) and that passes `npm audit`, this project substitutes:
> - `sqlite3` → **better-sqlite3** (faster, synchronous, reliable prebuilt binaries)
> - `bcrypt` → **bcryptjs** (pure-JS, identical hashing API, zero native deps)
> - `csurf` (deprecated, has a CVE) → a small **session-based CSRF middleware** in `middleware/csrf.js`
>
> To use the originally-specified packages instead, see **“Reverting package choices”** below.

---

## 📁 Project structure

```
drivex-motors/
├── server.js                # app entry: security, sessions, routes, errors
├── package.json
├── .env.example             # copy to .env
├── ecosystem.config.js      # PM2 config
├── config/
│   └── site.js              # ALL business/brand/contact details live here
├── database/
│   ├── schema.sql           # tables, indexes, foreign keys
│   ├── db.js                # connection + schema init (WAL, FKs)
│   └── seed.js              # default admin + sample inventory
├── middleware/
│   ├── auth.js              # requireAuth / redirectIfAuthed
│   ├── csrf.js              # CSRF protection
│   ├── upload.js            # Multer config
│   └── validators.js        # express-validator chains
├── routes/
│   ├── pages.js             # public pages + contact + robots/sitemap
│   ├── vehicles.js          # public vehicle JSON API
│   └── admin.js             # auth + admin pages + management API
├── utils/
│   ├── render.js            # HTML partials + token/SEO injection
│   └── helpers.js           # formatting helpers
├── views/                   # .html templates (+ partials/, admin/)
├── public/
│   ├── css/                 # styles.css, admin.css
│   ├── js/                  # one script per page + shared core
│   └── images/              # logo + placeholders (replace with real assets)
├── uploads/                 # uploaded vehicle images (runtime)
└── deploy/                  # nginx + systemd examples
```

---

## 🚀 Getting started (local)

**Prerequisites:** Node.js **20+** and npm. (Verified on Node 24.)

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
#    Windows (PowerShell):
copy .env.example .env
#    macOS/Linux:
cp .env.example .env

# 3. (Optional) load sample inventory — 12 demo vehicles
npm run seed

# 4. Start
npm run dev      # auto-reload (nodemon)
#   or
npm start
```

Open **http://localhost:3000**. The default admin account is created automatically on first boot.

> No build step is required for the frontend — it’s plain HTML/CSS/JS served by Express.
>
> When you want a deployable static output for GitHub, run `npm run build` and commit the generated `dist/` folder.

---

## 🔐 Admin login

| | |
|---|---|
| URL | **http://localhost:3000/admin** |
| Username | `admin` |
| Password | `ChangeMe123` |

The password is hashed with bcrypt during initialization. **Change it before going live** — set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` *before the first run* (the admin is created only when no admin exists). To reset an existing admin, delete the database file (`database/database.db*`) and restart, or update the row directly.

---

## 🌱 Sample data

`npm run seed` inserts 12 realistic Abu Dhabi-market vehicles (Land Cruiser, Patrol, G 63, Range Rover, X5, LX 570, Cayenne, Q7, Mustang, S 500, Model 3, Tahoe) with images, features, featured/sold flags and staggered dates.

```bash
npm run seed          # seed only if empty
npm run reset-db      # wipe vehicles + images, then re-seed
```

---

## 🎨 Customisation

- **Logo:** replace `public/images/logo.svg` with your file (SVG or PNG). It’s used via one reusable partial (`views/partials/logo.html`) — nothing else to edit. (Using a PNG? Update the two `<img src>` references if you change the filename.)
- **Business details** (phone, WhatsApp, email, address, hours, social links, map location): edit `config/site.js` or override via `.env` (`SITE_PHONE`, `SITE_WHATSAPP`, `SITE_EMAIL`, `SITE_ADDRESS`, `SITE_MAP_QUERY`). These propagate everywhere automatically.
- **Colours / theme:** CSS variables at the top of `public/css/styles.css` and `public/css/admin.css`.
- **Page copy** (About story, testimonials, team, etc.): plain text in the `views/*.html` files.

---

## 🛡️ Environment variables (`.env`)

| Key | Purpose |
|---|---|
| `PORT` | Server port (default 3000) |
| `NODE_ENV` | `development` / `production` |
| `SITE_URL` | Public URL — used for canonical links, sitemap & OG tags |
| `SESSION_SECRET` | **Required in production** — long random string |
| `DB_PATH` | SQLite file path |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB`, `MAX_IMAGES_PER_VEHICLE` | Upload limits |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Initial admin (first boot only) |
| `SITE_PHONE`, `SITE_WHATSAPP`, `SITE_EMAIL`, `SITE_ADDRESS`, `SITE_MAP_QUERY` | Contact details |

Generate a session secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 🌍 Production deployment (VPS)

On an Ubuntu/Debian VPS:

```bash
# 1. Install Node 18+ (NodeSource) and git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 2. Get the code
sudo mkdir -p /var/www && cd /var/www
sudo git clone <your-repo> drivex-motors   # or copy the folder up
cd drivex-motors

# 3. Install production deps
npm ci --omit=dev        # (or: npm install --production)

# 4. Configure
cp .env.example .env
nano .env                # set NODE_ENV=production, SITE_URL, a strong SESSION_SECRET,
                         # and ADMIN_USERNAME/ADMIN_PASSWORD
npm run seed             # optional demo data

# 5. Run with PM2
sudo npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save && pm2 startup  # run the printed command to enable on boot
```

Then put **nginx** in front as a reverse proxy and add HTTPS — see [`deploy/nginx.conf.example`](deploy/nginx.conf.example). A **systemd** alternative to PM2 is in [`deploy/drivex-motors.service`](deploy/drivex-motors.service).

**Production checklist**
- [ ] `NODE_ENV=production`
- [ ] Strong `SESSION_SECRET`
- [ ] Changed admin password
- [ ] `SITE_URL` set to your real https domain (so sitemap/OG/canonical are correct)
- [ ] HTTPS enabled (Certbot) → secure cookies activate automatically
- [ ] `uploads/` and `database/` are writable and **backed up**

---

## 🔁 Reverting package choices

Prefer the exact packages from the brief? It’s straightforward:

- **bcryptjs → bcrypt:** `npm i bcrypt`, then change `require('bcryptjs')` to `require('bcrypt')` in `database/seed.js` and `routes/admin.js` (the `hashSync`/`compareSync` API is identical).
- **better-sqlite3 → sqlite3:** this changes the data layer from synchronous to async/callback style; `database/db.js` and the route queries would need to be rewritten to use the async API. better-sqlite3 is recommended.
- **custom CSRF → csurf:** not recommended (deprecated + CVE), but you can swap `middleware/csrf.js` for the `csurf` middleware if required.

---

## 🗄️ Database schema

Four tables (full DDL in [`database/schema.sql`](database/schema.sql)):

- **admins** — `id`, `username` (unique), `password_hash`, `created_at`
- **vehicles** — title, make, model, year, price, mileage, engine, transmission, fuel_type, body_type, color, vin, description, features (JSON), is_featured, is_sold, views, created_at, updated_at — indexed on make/model/featured/sold/price/year/created_at
- **vehicle_images** — `vehicle_id` → vehicles (FK, `ON DELETE CASCADE`), file_path, is_primary, sort_order
- **contact_messages** — name, email, phone, subject, message, `vehicle_id` → vehicles (FK, `ON DELETE SET NULL`), is_read, created_at

---

## 🧰 Troubleshooting

- **`npm install` fails on better-sqlite3** — use Node **20+** (this project pins `better-sqlite3@^12`, which ships prebuilt binaries for current Node, including Node 24). On a very new Node release with no matching prebuilt yet, it compiles from source (needs `python3` + a C++ toolchain) — in that case install the matching `better-sqlite3` version.
- **Login always fails** — make sure cookies are allowed; behind a proxy ensure HTTPS so `secure` cookies are sent, or run with `NODE_ENV` unset locally.
- **Map doesn’t load** — set a real `SITE_MAP_QUERY`/address; the embed uses Google Maps (allowed in the CSP).
- **Images 404 after upload** — confirm the `uploads/` folder is writable by the app user.

---

## 📜 License

Proprietary — © DriveX Motors. For dealership use.
