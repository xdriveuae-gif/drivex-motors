/* ============================================================
   DriveX Motors — core front-end script (loaded on every page)
   Exposes window.DX = { toast, api, fmtPrice, fmtMileage, ... }
   ============================================================ */
(function () {
  'use strict';

  var body = document.body;
  var data = body.dataset;
  var CURRENCY = data.currency || 'AED';
  var CSRF = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

  /* ---------- helpers ---------- */
  function escapeHtml(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtPrice(n) { return CURRENCY + ' ' + (Number(n) || 0).toLocaleString('en-US'); }
  function fmtMileage(n) { return (Number(n) || 0).toLocaleString('en-US') + ' km'; }
  function debounce(fn, wait) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, wait); };
  }

  /* ---------- fetch wrappers ---------- */
  async function apiGet(url) {
    var r = await fetch(url, { headers: { Accept: 'application/json' } });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(d.error || 'Request failed (' + r.status + ')');
    return d;
  }
  async function apiSend(url, method, payload, isForm) {
    var headers = { Accept: 'application/json', 'X-CSRF-Token': CSRF };
    var body;
    if (isForm) { body = payload; }
    else if (payload !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(payload); }
    var r = await fetch(url, { method: method, headers: headers, body: body });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(d.error || 'Request failed'); e.status = r.status; e.data = d; throw e; }
    return d;
  }

  /* ---------- toast ---------- */
  function toast(message, type) {
    var c = document.getElementById('toastContainer');
    if (!c) { return; }
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.textContent = message;
    c.appendChild(el);
    setTimeout(function () {
      el.classList.add('hide');
      setTimeout(function () { el.remove(); }, 300);
    }, 3600);
  }

  /* ---------- icons ---------- */
  var ICON = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.6-9.3-9C1 8.5 2.7 5 6.2 5c2 0 3.3 1.1 4 2.2C10.8 6.1 12.1 5 14 5c3.5 0 5.2 3.5 3.5 7-2.3 4.4-9.3 9-9.3 9z"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><path d="M7 2v3m10-3v3M3 9h18M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    road: '<svg viewBox="0 0 24 24"><path d="M4 21l3-18h2l-1 18H4zm12 0l-1-18h2l3 18h-4zm-5 0v-4h2v4h-2zm0-7v-4h2v4h-2zm0-7V3h2v4h-2z"/></svg>',
    fuel: '<svg viewBox="0 0 24 24"><path d="M6 3h7a1 1 0 011 1v16H5V4a1 1 0 011-1zm1 4v4h5V7H7zm9 1l3 3v6a2 2 0 01-4 0v-4h1V8z"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 4l-2-1.5.3-2.5-2.4-.8L15 5l-2.3 1L10.4 5 9 7.2l-2.4.8.3 2.5L5 12l2 1.5-.3 2.5 2.4.8L11 19l1-1 1 1 1.6-1.4 2.4-.8-.3-2.5L19 12z"/></svg>'
  };

  /* ---------- vehicle card (shared by home + inventory) ---------- */
  function vehicleCard(v) {
    var img = v.primary_image || '/images/placeholders/car-a.svg';
    var badges = '';
    if (v.is_featured) badges += '<span class="vc-badge gold">Featured</span>';
    if (v.is_sold) badges += '<span class="vc-badge sold">Sold</span>';
    return '' +
      '<article class="vehicle-card" data-reveal>' +
        '<div class="vc-media">' +
          '<a href="/vehicle/' + v.id + '" aria-label="' + escapeHtml(v.title) + '">' +
            '<img class="vc-img" src="' + escapeHtml(img) + '" alt="' + escapeHtml(v.title) + '" loading="lazy">' +
          '</a>' +
          '<div class="vc-badges">' + badges + '</div>' +
        '</div>' +
        '<div class="vc-body">' +
          '<h3 class="vc-title"><a href="/vehicle/' + v.id + '">' + escapeHtml(v.title) + '</a></h3>' +
          '<div class="vc-price">' + fmtPrice(v.price) + '</div>' +
          '<ul class="vc-meta">' +
            '<li>' + ICON.cal + '<span>' + escapeHtml(v.year) + '</span></li>' +
            '<li>' + ICON.road + '<span>' + fmtMileage(v.mileage) + '</span></li>' +
            '<li>' + ICON.fuel + '<span>' + escapeHtml(v.fuel_type || '—') + '</span></li>' +
            '<li>' + ICON.gear + '<span>' + escapeHtml(v.transmission || '—') + '</span></li>' +
          '</ul>' +
          '<a href="/vehicle/' + v.id + '" class="btn btn-outline btn-sm btn-block vc-link">View Details</a>' +
        '</div>' +
      '</article>';
  }

  function skeletons(count) {
    var s = '';
    for (var i = 0; i < count; i++) {
      s += '<div class="skeleton-card"><div class="sk-media shimmer"></div><div class="sk-body">' +
        '<div class="sk-line lg shimmer"></div><div class="sk-line shimmer"></div>' +
        '<div class="sk-line sm shimmer"></div></div></div>';
    }
    return s;
  }

  /* ---------- reveal-on-scroll ---------- */
  var revealObserver = null;
  function ensureRevealObserver() {
    if (revealObserver || !('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in-view'); revealObserver.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
  }
  function revealScan(root) {
    ensureRevealObserver();
    var nodes = (root || document).querySelectorAll('[data-reveal]:not(.in-view):not([data-observed])');
    nodes.forEach(function (n) {
      n.setAttribute('data-observed', '1');
      if (revealObserver) revealObserver.observe(n); else n.classList.add('in-view');
    });
  }

  /* ---------- counters ---------- */
  function initCounters() {
    var nums = document.querySelectorAll('[data-count]');
    if (!nums.length || !('IntersectionObserver' in window)) {
      nums.forEach(function (n) { n.textContent = n.getAttribute('data-count') + (n.getAttribute('data-suffix') || ''); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, target = Number(el.getAttribute('data-count')) || 0,
          suffix = el.getAttribute('data-suffix') || '', start = null, dur = 1600;
        function step(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.floor(eased * target).toLocaleString('en-US') + suffix;
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        obs.unobserve(el);
      });
    }, { threshold: 0.4 });
    nums.forEach(function (n) { obs.observe(n); });
  }

  /* ---------- navigation ---------- */
  function initNav() {
    var header = document.getElementById('siteHeader');
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('mainNav');
    function onScroll() { if (header) header.classList.toggle('scrolled', window.scrollY > 24); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }
    // active link
    var path = location.pathname;
    document.querySelectorAll('.nav-link[data-nav]').forEach(function (a) {
      var href = a.getAttribute('data-nav');
      if (href === '/' ? path === '/' : path.indexOf(href) === 0) a.classList.add('active');
    });
  }

  /* ---------- back to top ---------- */
  function initBackToTop() {
    var btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', function () { btn.classList.toggle('show', window.scrollY > 600); }, { passive: true });
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ---------- favourite delegation ---------- */
  function initActions() {
    document.addEventListener('click', function (e) {
      var favBtn = e.target.closest('[data-fav]');
      if (favBtn) {
        e.preventDefault();
        if (!window.DXFav) return;
        var on = window.DXFav.toggle(favBtn.getAttribute('data-fav'));
        favBtn.classList.toggle('active', on);
        toast(on ? 'Added to favourites' : 'Removed from favourites', on ? 'success' : 'info');
      }
    });
  }

  /* ---------- expose + init ---------- */
  window.DX = {
    escapeHtml: escapeHtml, fmtPrice: fmtPrice, fmtMileage: fmtMileage, debounce: debounce,
    toast: toast, api: { get: apiGet, send: apiSend }, csrf: CSRF,
    vehicleCard: vehicleCard, skeletons: skeletons, revealScan: revealScan, ICON: ICON
  };

  function init() {
    // instant skeletons for any grid that declares a loading count
    document.querySelectorAll('[data-loading]').forEach(function (g) {
      g.innerHTML = skeletons(Number(g.getAttribute('data-loading')) || 3);
    });
    initNav(); initBackToTop(); initActions(); initCounters(); revealScan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
