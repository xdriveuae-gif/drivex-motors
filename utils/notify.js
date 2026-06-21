'use strict';

/**
 * Email notifications (best-effort).
 * ----------------------------------
 * Sends an email to the dealership when a customer submits a vehicle via
 * "Sell Your Car". Uses nodemailer IF SMTP_* env vars are configured; if not,
 * it silently no-ops (the submission is always saved + visible in the admin
 * panel regardless). It never throws — a mail failure must not break the form.
 *
 * Configure in .env:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 *   ADMIN_NOTIFY_EMAIL  (recipient; defaults to SMTP_USER)
 *   MAIL_FROM           (From header; defaults to "DriveX Motors <SMTP_USER>")
 */

const site = require('../config/site');

let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_e) { /* dependency optional */ }

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!nodemailer || !smtpConfigured()) return null;
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true' || port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function row(label, value) {
  if (value == null || value === '') return '';
  return `<tr><td style="padding:4px 12px 4px 0;color:#888;">${esc(label)}</td><td style="padding:4px 0;font-weight:600;">${esc(value)}</td></tr>`;
}

/**
 * notifyNewSubmission(sub, imageCount) -> Promise<{sent, reason?}>
 * Always resolves; never rejects.
 */
async function notifyNewSubmission(sub, imageCount) {
  try {
    const t = getTransporter();
    if (!t) return { sent: false, reason: 'smtp-not-configured' };

    const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.SMTP_USER;
    const from = process.env.MAIL_FROM || `"${site.name}" <${process.env.SMTP_USER}>`;
    const subject = `New Vehicle Submission - ${sub.make} ${sub.model} ${sub.year}`;

    const adminUrl = `${site.url}/admin/leads/${sub.id}`;
    const text = [
      `New vehicle submission (${sub.submission_number || '#' + sub.id})`,
      '',
      `Vehicle:   ${sub.year} ${sub.make} ${sub.model} ${sub.trim || ''}`.trim(),
      `Mileage:   ${sub.mileage != null ? sub.mileage + ' km' : '—'}`,
      `Asking:    ${sub.asking_price != null ? site.currency + ' ' + Number(sub.asking_price).toLocaleString('en-US') : '—'}`,
      `Photos:    ${imageCount || 0}`,
      '',
      `Name:      ${sub.full_name}`,
      `Phone:     ${sub.phone}`,
      `WhatsApp:  ${sub.whatsapp || '—'}`,
      `Email:     ${sub.email}`,
      `City:      ${sub.city || '—'}`,
      '',
      `Open in admin: ${adminUrl}`
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#0A0A0A;border-bottom:3px solid #D4AF37;padding-bottom:8px;">New Vehicle Submission</h2>
        <p style="color:#555;">Reference: <strong>${esc(sub.submission_number || '#' + sub.id)}</strong> · ${esc(imageCount || 0)} photo(s)</p>
        <h3 style="margin:18px 0 6px;">Vehicle</h3>
        <table style="font-size:14px;border-collapse:collapse;">
          ${row('Make / Model', `${sub.make} ${sub.model}`)}
          ${row('Year', sub.year)}
          ${row('Trim', sub.trim)}
          ${row('Mileage', sub.mileage != null ? `${Number(sub.mileage).toLocaleString('en-US')} km` : '')}
          ${row('Engine', sub.engine_size)}
          ${row('Fuel', sub.fuel_type)}
          ${row('Transmission', sub.transmission)}
          ${row('Colour', sub.color)}
          ${row('Asking price', sub.asking_price != null ? `${site.currency} ${Number(sub.asking_price).toLocaleString('en-US')}${sub.negotiable === 'Yes' ? ' (negotiable)' : ''}` : '')}
        </table>
        <h3 style="margin:18px 0 6px;">Customer</h3>
        <table style="font-size:14px;border-collapse:collapse;">
          ${row('Name', sub.full_name)}
          ${row('Phone', sub.phone)}
          ${row('WhatsApp', sub.whatsapp)}
          ${row('Email', sub.email)}
          ${row('City', sub.city)}
        </table>
        <p style="margin-top:22px;">
          <a href="${esc(adminUrl)}" style="background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:10px 22px;border-radius:6px;font-weight:700;">Open in Admin Panel</a>
        </p>
      </div>`;

    await t.sendMail({ from, to, subject, text, html });
    return { sent: true };
  } catch (e) {
    console.warn('✗ Submission email failed:', e.message);
    return { sent: false, reason: e.message };
  }
}

module.exports = { notifyNewSubmission, smtpConfigured };
