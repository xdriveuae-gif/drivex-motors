'use strict';

/** Multer configuration for vehicle image uploads. */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads')
);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 8);
const MAX_IMAGES = Number(process.env.MAX_IMAGES_PER_VEHICLE || 12);

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    let ext = (path.extname(file.originalname) || '').toLowerCase();
    if (!/^\.[a-z0-9]{1,5}$/.test(ext)) ext = '.jpg';
    const id = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${id}${ext}`);
  }
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  return cb(new Error('Only image files (JPG, PNG, WEBP, GIF, AVIF) are allowed.'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_IMAGES }
});

/* ── "Sell Your Car" submission uploads (separate folder + limits) ── */
const SUBMISSION_DIR = path.join(UPLOAD_DIR, 'submissions');
fs.mkdirSync(SUBMISSION_DIR, { recursive: true });

const SUBMISSION_MAX_MB = Number(process.env.SUBMISSION_MAX_MB || 10);
const SUBMISSION_MAX_IMAGES = Number(process.env.SUBMISSION_MAX_IMAGES || 20);

const SUBMISSION_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const submissionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SUBMISSION_DIR),
  filename: (_req, file, cb) => {
    let ext = (path.extname(file.originalname) || '').toLowerCase();
    if (!/^\.(jpg|jpeg|png|webp)$/.test(ext)) ext = '.jpg';
    const id = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${id}${ext}`);
  }
});

const submissionUpload = multer({
  storage: submissionStorage,
  fileFilter: (_req, file, cb) =>
    SUBMISSION_MIME.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only JPG, PNG or WEBP images are allowed.')),
  limits: { fileSize: SUBMISSION_MAX_MB * 1024 * 1024, files: SUBMISSION_MAX_IMAGES }
});

/** Web path for an uploaded submission filename. */
function submissionWebPath(filename) {
  return `/uploads/submissions/${path.basename(filename)}`;
}

/** Web path for an uploaded filename. */
function webPath(filename) {
  return `/uploads/${path.basename(filename)}`;
}

/**
 * Remove an uploaded file from disk given its stored web path.
 * Safety: only ever deletes files inside the uploads folder, so bundled
 * placeholder images (/images/...) used by seed data are never touched.
 */
function deleteUploadByWebPath(webpath) {
  if (!webpath || !webpath.startsWith('/uploads/')) return;
  const full = path.join(UPLOAD_DIR, path.basename(webpath));
  fs.promises.unlink(full).catch(() => {});
}

/** Remove a submission image (lives in the /uploads/submissions/ subfolder). */
function deleteSubmissionByWebPath(webpath) {
  if (!webpath || !webpath.startsWith('/uploads/submissions/')) return;
  const full = path.join(SUBMISSION_DIR, path.basename(webpath));
  fs.promises.unlink(full).catch(() => {});
}

module.exports = {
  upload,
  UPLOAD_DIR,
  MAX_IMAGES,
  MAX_MB,
  webPath,
  deleteUploadByWebPath,
  submissionUpload,
  SUBMISSION_DIR,
  SUBMISSION_MAX_IMAGES,
  SUBMISSION_MAX_MB,
  submissionWebPath,
  deleteSubmissionByWebPath
};
