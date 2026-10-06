'use strict';

// Local theme preview: http://localhost:3001 with its own throwaway database,
// sample cars, a test admin login, and email switched off. Never touches live data.
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '.preview');
fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true });

Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: '3001',
  SITE_URL: 'http://localhost:3001',
  DB_PATH: path.join(dir, 'preview.db'),
  UPLOAD_DIR: path.join(dir, 'uploads'),
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'preview123',
  ADMIN_RESET_PASSWORD: '1',
  SMTP_HOST: '',
  SMTP_USER: '',
  SMTP_PASS: ''
});

const { ensureDefaultAdmin, seedVehicles } = require('./database/seed');
ensureDefaultAdmin();
const db = require('./database/db');
if (db.prepare('SELECT COUNT(*) AS n FROM vehicles').get().n === 0) seedVehicles();

console.log('\n  THEME PREVIEW — open http://localhost:3001  (admin: admin / preview123)\n');
require('./server');
