/* Home page — latest vehicles + hero search bar (uses the existing /api endpoints). */
(function () {
  'use strict';

  var DEAL_COUNT = 8, STOCK_COUNT = 6;

  function dealCard(v) {
    var est = DX.financeEstimate(v.price, v.year);
    return '' +
      '<a class="deal-card" href="/vehicle/' + v.id + '">' +
        '<div class="deal-media">' +
          '<img src="' + DX.escapeHtml(v.primary_image) + '" alt="' + DX.escapeHtml(v.title) + '" loading="lazy">' +
          '<span class="vc-badge gold">Featured</span>' +
        '</div>' +
        '<div class="deal-body">' +
          '<div class="deal-row deal-top"><h3 class="deal-name">' + DX.escapeHtml(v.title) + '</h3><span class="deal-year">' + DX.escapeHtml(v.year) + '</span></div>' +
          '<div class="deal-row">' +
            '<div>' + (est ? '<span class="deal-lbl">Starts from</span><span class="deal-monthly"><span>' + DX.fmtPrice(est.monthly) + '</span><span>/month</span></span>' : '') + '</div>' +
            '<div class="deal-end"><span class="deal-lbl">Full Price</span><span class="deal-price">' + DX.fmtPrice(v.price) + '</span></div>' +
          '</div>' +
          '<div class="deal-row deal-odo"><span class="deal-lbl">Mileage</span><span>' + DX.fmtMileage(v.mileage) + '</span></div>' +
        '</div>' +
      '</a>';
  }

  function isDeal(v) { return !v.is_sold && !v.is_reserved && !v.is_coming_soon && v.primary_image; }

  // One list feeds both sections, so the same car never appears twice on the page.
  async function initCars() {
    var section = document.getElementById('deals');
    var track = document.getElementById('dealsTrack');
    var grid = document.getElementById('showcaseGrid');
    var note = function (t) { grid.innerHTML = '<p class="muted ta-center" style="grid-column:1/-1">' + t + '</p>'; };
    track.innerHTML = DX.skeletons(3);
    try {
      var res = await DX.api.get('/api/vehicles?limit=' + (DEAL_COUNT + STOCK_COUNT) + '&sort=newest');
      var items = res.data || [];
      var deals = items.filter(isDeal).slice(0, DEAL_COUNT);
      var rest = items.filter(function (v) { return deals.indexOf(v) < 0; }).slice(0, STOCK_COUNT);
      if (deals.length) track.innerHTML = deals.map(dealCard).join('');
      else section.hidden = true;
      if (rest.length) { grid.innerHTML = rest.map(DX.vehicleCard).join(''); DX.revealScan(grid); }
      else if (deals.length) document.getElementById('showcase').hidden = true;
      else note('No vehicles available yet. Please check back soon.');
    } catch (e) {
      section.hidden = true;
      note('Unable to load vehicles right now.');
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

  /* ---------- Hero: featured car on the right (newest available car) ---------- */
  async function initFeature() {
    var img = document.getElementById('hfImg');
    var cap = document.getElementById('hfCap');
    if (!img || !cap) return;
    try {
      var res = await DX.api.get('/api/vehicles?limit=5&sort=newest');
      var cars = (res.data || []).filter(function (c) { return !c.is_sold; });
      var v = cars.find(function (c) { return !c.is_coming_soon; }) || cars[0];
      if (!v) return; // no cars yet: keep the brand image
      img.src = v.primary_image || '/images/placeholders/car-a.svg';
      img.alt = v.title;
      document.getElementById('hfTag').textContent = v.is_reserved ? 'Reserved' : (v.is_coming_soon ? 'Coming Soon' : 'Just arrived');
      document.getElementById('hfTitle').textContent = v.title;
      var meta = document.getElementById('hfMeta');
      meta.innerHTML = [v.year, DX.fmtMileage(v.mileage), v.fuel_type].filter(Boolean).map(function (m) {
        return '<span>' + DX.escapeHtml(m) + '</span>';
      }).join('');
      document.getElementById('hfPrice').textContent = DX.fmtPrice(v.price);
      document.getElementById('hfLink').href = '/vehicle/' + v.id;
      cap.hidden = false;
    } catch (e) { /* keep the brand image */ }
  }

  // On phones the WhatsApp button would sit on the hero search button: hide it until the visitor scrolls.
  function initFabGuard() {
    var on = function () { document.body.classList.toggle('home-top', window.scrollY < 160); };
    on(); window.addEventListener('scroll', on, { passive: true });
  }

  function init() {
    initFabGuard();
    initFeature();
    initCars();
    initSearch();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
