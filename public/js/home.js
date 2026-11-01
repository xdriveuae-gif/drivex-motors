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

  function init() {
    initFeature();
    fillGrid('showcaseGrid', '/api/vehicles?limit=6&sort=newest');
    initSearch();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
