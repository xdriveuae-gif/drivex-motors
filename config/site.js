'use strict';

/**
 * Central business / brand configuration for DriveX Motors.
 * ----------------------------------------------------------
 * Edit the values below (or override them via .env) to change the
 * dealership details EVERYWHERE on the site — header, footer, contact
 * page, WhatsApp buttons, structured data, etc. Nothing is hard-coded
 * in the templates.
 */

require('dotenv').config();

const phoneDisplay = process.env.SITE_PHONE || '+971 50 673 0006';

const site = {
  // Brand
  name: 'DriveX Motors',
  legalName: 'DriveX Motors LLC',
  tagline: 'Premium Pre-Owned Vehicles · Abu Dhabi',
  shortDescription:
    'DriveX Motors is Abu Dhabi’s destination for premium, fully-inspected pre-owned vehicles — luxury SUVs, sedans and sports cars with transparent pricing and flexible finance.',

  // Where the site lives (used for canonical URLs, sitemap and Open Graph)
  url: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),

  // Contact
  phoneDisplay,
  phone: phoneDisplay.replace(/[^\d+]/g, ''), // tel: friendly, e.g. +97125550199
  whatsapp: (process.env.SITE_WHATSAPP || '971506730006').replace(/[^\d]/g, ''), // intl, no "+"
  email: process.env.SITE_EMAIL || 'info@drivex-motors.com',
  addressLine: process.env.SITE_ADDRESS || 'Industrial City - ICAD V - Abu Dhabi, Abu Dhabi, United Arab Emirates',
  mapQuery: process.env.SITE_MAP_QUERY || '24.2542396,54.4713298',
  hours: 'Sat – Thu: 9:00 AM – 9:00 PM  ·  Fri: 2:00 PM – 9:00 PM',
  currency: 'AED',

  // Social links (replace with the dealership's real profiles)
  social: {
    facebook: 'https://facebook.com/',
    instagram: 'https://www.instagram.com/drivex_motors.ae/',
    x: 'https://x.com/',
    youtube: 'https://youtube.com/',
    tiktok: 'https://tiktok.com/'
  }
};

/** Pre-filled WhatsApp deep link. */
site.whatsappLink = function whatsappLink(message) {
  const base = `https://wa.me/${site.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};

/** Google Maps embed URL (no API key required). */
site.mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&output=embed`;

/** Google Maps "open in maps" link. */
site.mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.mapQuery)}`;

module.exports = site;
