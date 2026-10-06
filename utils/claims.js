'use strict';

/**
 * Template tokens built from the editable claims in config/site.js.
 * Anything still set to a [PLACEHOLDER] is treated as "not filled in" and
 * produces generic wording with no specific numbers or terms.
 */

const site = require('../config/site');
const { escapeHtml } = require('./helpers');

const filled = (v) => (v && !/^\[[A-Z_]+\]$/.test(String(v).trim()) ? String(v).trim() : '');
const esc = escapeHtml;

function claimTokens() {
  const b = site.business || {};
  const duration = filled(b.warrantyDuration);
  const km = filled(b.warrantyKmLimit);
  const coverage = filled(b.warrantyCoverage);
  const partners = filled(b.financePartners);
  const down = filled(b.downPaymentText);
  const tenure = filled(b.maxTenure);
  const timeframe = filled(b.sellTimeframe);

  const warrantyAny = duration || km || coverage;
  const warrantyText = 'Our cars come with a warranty.'
    + (duration ? ` Coverage period: ${duration}.` : '')
    + (km ? ` Limit: ${km}.` : '')
    + (coverage ? ` Covers: ${coverage}.` : '')
    + (warrantyAny ? '' : ' Ask our team for the full details.');

  const financeAny = partners || down || tenure;
  const financeText = 'Finance options are available on our cars.'
    + (partners ? ` Finance partners: ${partners}.` : '')
    + (down ? ` ${down}.`.replace(/\.\.$/, '.') : '')
    + (tenure ? ` Terms up to ${tenure}.` : '')
    + (financeAny ? '' : ' Contact us to check your eligibility.');

  const li = (label, v) => (v ? `<li><strong>${esc(label)}:</strong> ${esc(v)}</li>` : '');
  const financeDetails = [li('Finance partners', partners), li('Down payment', down), li('Maximum term', tenure)].join('');

  const sellText = 'Tell us about your car and our team will get back to you with an offer.'
    + (timeframe ? ` You will hear from us within ${timeframe}.` : '');

  const showTeam = site.show && site.show.team && Array.isArray(site.team) && site.team.length;
  const teamHtml = showTeam
    ? `<section class="section"><div class="container"><div class="section-head"><h2 class="section-title">Meet the Team</h2></div><div class="team-grid">${
      site.team.map((m) => `<div class="team-card"><div class="team-avatar">${esc((m.name || '?').charAt(0))}</div><strong>${esc(m.name)}</strong><span>${esc(m.role)}</span></div>`).join('')
    }</div></div></section>`
    : '';

  const showReviews = site.show && site.show.reviews && Array.isArray(site.reviews) && site.reviews.length;
  const reviewsHtml = showReviews
    ? `<section class="section section-alt"><div class="container"><div class="section-head"><h2 class="section-title">What Our Customers Say</h2></div><div class="testimonial-grid">${
      site.reviews.map((r) => `<figure class="testimonial"><div class="stars" aria-label="${esc(r.rating || 5)} out of 5 stars">${'★'.repeat(Math.max(1, Math.min(5, Number(r.rating) || 5)))}</div><blockquote>${esc(r.text)}</blockquote><figcaption><strong>${esc(r.name)}</strong></figcaption></figure>`).join('')
    }</div></div></section>`
    : '';

  return {
    WARRANTY_BADGE: esc(duration ? `${duration} warranty` : 'Warranty'),
    WARRANTY_TEXT: esc(warrantyText),
    FINANCE_TEXT: esc(financeText),
    FINANCE_DETAILS: financeDetails,
    SELL_TEXT: esc(sellText),
    TEAM_SECTION: teamHtml,
    REVIEWS_SECTION: reviewsHtml
  };
}

module.exports = { claimTokens };
