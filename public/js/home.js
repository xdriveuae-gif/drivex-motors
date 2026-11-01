/* Home page — latest vehicles + hero search bar (uses the existing /api endpoints). */
(function () {
  'use strict';

  async function fillGrid(gridId, url) {
    var grid = document.getElementById(gridId);
    if (!grid) return;
    try {
      var res = await DX.api.get(url);
      var items = res.data || [];
      if (!items.length) {
        grid.innerHTML = '<p class="muted ta-center" style="grid-column:1/-1">No vehicles available yet. Please check back soon.</p>';
        return;
      }
      grid.innerHTML = items.map(DX.vehicleCard).join('');
      DX.revealScan(grid);
    } catch (e) {
      grid.innerHTML = '<p class="muted ta-center" style="grid-column:1/-1">Unable to load vehicles right now.</p>';
    }
  }

  function option(value, label) {
    var o = document.createElement('option');
    o.value = value; o.textContent = label;
    return o;
  }

  // Round price steps up to the highest listed price, e.g. 100k, 150k, 200k...
  function priceSteps(max) {
    var steps = [50000, 100000, 150000, 200000, 300000, 400000, 500000, 750000, 1000000];
    var out = steps.filter(function (s) { return s < max; });
    var next = steps.find(function (s) { return s >= max; });
    if (next) out.push(next);
    return out;
  }

  async function initSearch() {
    var form = document.getElementById('heroSearch');
    if (!form) return;
    var makeSel = document.getElementById('hsMake');
    var modelSel = document.getElementById('hsModel');
    var priceSel = document.getElementById('hsPrice');
    var modelsByMake = {};

    try {
      var f = await DX.api.get('/api/filters');
      modelsByMake = f.modelsByMake || {};
      (f.makes || []).forEach(function (m) { makeSel.appendChild(option(m, m)); });
      if (f.priceMax) {
        priceSteps(f.priceMax).forEach(function (p) {
          priceSel.appendChild(option(String(p), 'Up to ' + DX.fmtPrice(p)));
        });
      }
    } catch (e) { /* the form still works with "any" values */ }

    makeSel.addEventListener('change', function () {
      var models = modelsByMake[makeSel.value] || [];
      modelSel.innerHTML = '';
      modelSel.appendChild(option('', 'All models'));
      models.forEach(function (m) { modelSel.appendChild(option(m, m)); });
      modelSel.disabled = !makeSel.value || !models.length;
    });

    // Keep the URL clean: only send the filters the visitor actually chose.
    form.addEventListener('submit', function () {
      [makeSel, modelSel, priceSel].forEach(function (sel) { if (!sel.value) sel.disabled = true; });
    });
    window.addEventListener('pageshow', function () {
      makeSel.disabled = false; priceSel.disabled = false;
      modelSel.disabled = !makeSel.value || modelSel.options.length < 2;
    });
  }

  /* ---------- Hero: logo intro (once per visit) -> featured-car slider ---------- */
  var INTRO_KEY = 'dx-intro-seen';
  function seen() { try { return sessionStorage.getItem(INTRO_KEY); } catch (e) { return null; } }
  function markSeen() { try { sessionStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* private mode */ } }
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(v) { return DX.escapeHtml(v); }

  function buildSlides(cars) {
    var wa = document.body.getAttribute('data-whatsapp') || '';
    var html = cars.map(function (v, i) {
      var img = v.primary_image || '/images/placeholders/car-a.svg';
      var tag = v.is_coming_soon ? 'Coming Soon' : (v.is_reserved ? 'Reserved' : 'Just arrived');
      var meta = [v.year, DX.fmtMileage(v.mileage), v.fuel_type].filter(Boolean).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');
      var msg = "Hi, I'm interested in the " + v.title + ' (' + v.year + ')';
      return '<div class="hs-slide' + (i === 0 ? ' is-active' : '') + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + cars.length + '">' +
        '<img src="' + esc(img) + '" alt="' + esc(v.title) + '"' + (i === 0 ? '' : ' loading="lazy"') + '>' +
        '<div class="hs-cap">' +
          '<span class="hs-tag">' + tag + '</span>' +
          '<h2 class="hs-title">' + esc(v.title) + '</h2>' +
          '<p class="hs-meta">' + meta + '</p>' +
          '<div class="hs-price">' + DX.fmtPrice(v.price) + '</div>' +
          '<div class="hs-actions">' +
            '<a class="btn btn-gold" href="/vehicle/' + v.id + '">View Details</a>' +
            '<a class="btn btn-whatsapp" href="https://wa.me/' + esc(wa) + '?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">WhatsApp</a>' +
          '</div>' +
        '</div></div>';
    }).join('');
    if (cars.length < 2) return html;
    var dots = cars.map(function (_, i) {
      return '<button type="button" class="hs-dot' + (i === 0 ? ' is-active' : '') + '" data-i="' + i + '" aria-label="Slide ' + (i + 1) + '"></button>';
    }).join('');
    return html +
      '<button type="button" class="hs-nav prev" aria-label="Previous"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<button type="button" class="hs-nav next" aria-label="Next"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
      '<div class="hs-ctrl"><div class="hs-dots">' + dots + '</div>' +
      '<button type="button" class="hs-pause" aria-label="Pause"><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg></button></div>';
  }

  function initSlider(slider, cars) {
    slider.innerHTML = buildSlides(cars);
    var slides = slider.querySelectorAll('.hs-slide');
    var dots = slider.querySelectorAll('.hs-dot');
    var idx = 0, timer = null, paused = !!reduced, hover = false;
    var pauseBtn = slider.querySelector('.hs-pause');

    function show(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === idx); });
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === idx); });
    }
    function stop() { clearInterval(timer); timer = null; }
    function start() {
      stop();
      if (paused || hover || slides.length < 2 || document.hidden) return;
      timer = setInterval(function () { show(idx + 1); }, 6000);
    }
    function setPaused(p) {
      paused = p; slider.classList.toggle('is-paused', p);
      if (pauseBtn) pauseBtn.setAttribute('aria-label', p ? 'Play' : 'Pause');
      start();
    }
    setPaused(paused);

    slider.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('prev')) show(idx - 1);
      else if (b.classList.contains('next')) show(idx + 1);
      else if (b.classList.contains('hs-dot')) show(Number(b.getAttribute('data-i')));
      else if (b.classList.contains('hs-pause')) { setPaused(!paused); return; }
      start();
    });
    slider.addEventListener('mouseenter', function () { hover = true; stop(); });
    slider.addEventListener('mouseleave', function () { hover = false; start(); });
    slider.addEventListener('focusin', function () { hover = true; stop(); });
    slider.addEventListener('focusout', function () { hover = false; start(); });
    document.addEventListener('visibilitychange', start);

    var x0 = null;
    slider.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 45) return;
      var rtl = document.documentElement.dir === 'rtl';
      show(idx + ((dx < 0) !== rtl ? 1 : -1)); start();
    }, { passive: true });
  }

  async function initHero() {
    var stage = document.getElementById('heroStage');
    var v = document.getElementById('heroVideo');
    var slider = document.getElementById('heroSlider');
    var skip = document.getElementById('heroSkip');
    if (!stage || !slider) return;

    var cars = [];
    try {
      var res = await DX.api.get('/api/vehicles?limit=5&sort=newest');
      cars = (res.data || []).filter(function (c) { return !c.is_sold; });
    } catch (e) { /* no slider: the video's last frame stays */ }

    var done = false, instant = false;
    function showSlider() {
      if (done) return; done = true;
      markSeen();
      if (v) { try { v.pause(); } catch (e) { /* ignore */ } }
      if (skip) skip.hidden = true;
      if (cars.length) { initSlider(slider, cars); if (instant) stage.classList.add('instant'); stage.classList.add('is-slider'); }
    }

    var playIntro = v && !reduced && !seen() && cars.length;
    if (!playIntro) {
      instant = true;
      if (v && reduced) { v.removeAttribute('autoplay'); v.pause(); }
      if (cars.length) showSlider(); else if (skip) skip.hidden = true;
      return;
    }
    v.addEventListener('ended', showSlider);
    v.addEventListener('error', showSlider);
    if (skip) skip.addEventListener('click', showSlider);
    setTimeout(showSlider, 9000); // safety net
    var p = v.play && v.play();
    if (p && p.catch) p.catch(showSlider); // autoplay blocked -> straight to the slider
  }

  function init() {
    initHero();
    fillGrid('showcaseGrid', '/api/vehicles?limit=6&sort=newest');
    initSearch();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
