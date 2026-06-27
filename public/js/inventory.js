/* Inventory — search, filters, sort, pagination (data from /api). */
(function () {
  'use strict';
  var PER_PAGE = 9;
  var modelsByMake = {};
  var state = { page: 1 };

  var $ = function (id) { return document.getElementById(id); };
  var grid = $('vehicleGrid'), countEl = $('resultsCount'), emptyEl = $('emptyState'),
    pager = $('pagination'), chipsEl = $('activeChips');
  var searchInput = $('searchInput'), sortSelect = $('sortSelect'), form = $('filterForm');
  var makeSel = $('f-make'), modelSel = $('f-model'), bodySel = $('f-body'),
    fuelSel = $('f-fuel'), transSel = $('f-trans'),
    yMin = $('f-year-min'), yMax = $('f-year-max'),
    pMin = $('f-price-min'), pMax = $('f-price-max'), mMax = $('f-mileage');

  function controls() {
    return {
      q: searchInput.value.trim(),
      sort: sortSelect.value,
      make: makeSel.value, model: modelSel.value, body_type: bodySel.value,
      fuel_type: fuelSel.value, transmission: transSel.value,
      year_min: yMin.value, year_max: yMax.value,
      price_min: pMin.value, price_max: pMax.value, mileage_max: mMax.value
    };
  }

  function apiQS(c, page, limit) {
    var p = new URLSearchParams();
    ['q', 'make', 'model', 'body_type', 'fuel_type', 'transmission',
      'year_min', 'year_max', 'price_min', 'price_max', 'mileage_max'].forEach(function (k) {
      if (c[k]) p.set(k, c[k]);
    });
    p.set('sort', c.sort || 'newest');
    p.set('page', page); p.set('limit', limit);
    return p.toString();
  }

  function syncUrl(c) {
    var p = new URLSearchParams();
    Object.keys(c).forEach(function (k) {
      if (c[k] && !(k === 'sort' && c[k] === 'newest')) p.set(k, c[k]);
    });
    if (state.page > 1) p.set('page', state.page);
    var qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function showSkeletons() { grid.innerHTML = DX.skeletons(PER_PAGE); emptyEl.hidden = true; pager.innerHTML = ''; }

  function render(items, pagination) {
    if (!items.length) {
      grid.innerHTML = ''; emptyEl.hidden = false;
      countEl.innerHTML = '<strong>0</strong> vehicles found';
      pager.innerHTML = ''; return;
    }
    emptyEl.hidden = true;
    grid.innerHTML = items.map(DX.vehicleCard).join('');
    DX.revealScan(grid);
    countEl.innerHTML = '<strong>' + pagination.total + '</strong> vehicle' + (pagination.total === 1 ? '' : 's') + ' found';
    renderPager(pagination);
  }

  function renderPager(p) {
    if (p.totalPages <= 1) { pager.innerHTML = ''; return; }
    var html = '<button data-page="' + (p.page - 1) + '" ' + (p.page <= 1 ? 'disabled' : '') + '>‹ Prev</button>';
    var from = Math.max(1, p.page - 2), to = Math.min(p.totalPages, p.page + 2);
    if (from > 1) html += '<button data-page="1">1</button>' + (from > 2 ? '<span class="muted">…</span>' : '');
    for (var i = from; i <= to; i++) html += '<button data-page="' + i + '" class="' + (i === p.page ? 'active' : '') + '">' + i + '</button>';
    if (to < p.totalPages) html += (to < p.totalPages - 1 ? '<span class="muted">…</span>' : '') + '<button data-page="' + p.totalPages + '">' + p.totalPages + '</button>';
    html += '<button data-page="' + (p.page + 1) + '" ' + (p.page >= p.totalPages ? 'disabled' : '') + '>Next ›</button>';
    pager.innerHTML = html;
    pager.querySelectorAll('button[data-page]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        state.page = Number(b.getAttribute('data-page'));
        load();
        document.querySelector('.inventory-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function chip(label, key) {
    return '<span class="chip">' + DX.escapeHtml(label) + '<button data-clear="' + key + '" aria-label="Remove filter">×</button></span>';
  }
  function updateChips(c) {
    var chips = [];
    if (c.q) chips.push(chip('“' + c.q + '”', 'q'));
    if (c.make) chips.push(chip(c.make, 'make'));
    if (c.model) chips.push(chip(c.model, 'model'));
    if (c.body_type) chips.push(chip(c.body_type, 'body_type'));
    if (c.fuel_type) chips.push(chip(c.fuel_type, 'fuel_type'));
    if (c.transmission) chips.push(chip(c.transmission, 'transmission'));
    if (c.year_min || c.year_max) chips.push(chip('Year ' + (c.year_min || '…') + '–' + (c.year_max || '…'), 'year'));
    if (c.price_min || c.price_max) chips.push(chip('AED ' + (c.price_min || '0') + '–' + (c.price_max || '∞'), 'price'));
    if (c.mileage_max) chips.push(chip('≤ ' + Number(c.mileage_max).toLocaleString() + ' km', 'mileage_max'));
    chipsEl.innerHTML = chips.join('');
    chipsEl.querySelectorAll('[data-clear]').forEach(function (b) {
      b.addEventListener('click', function () { clearControl(b.getAttribute('data-clear')); });
    });
  }

  function clearControl(key) {
    var map = { q: searchInput, make: makeSel, model: modelSel, body_type: bodySel, fuel_type: fuelSel, transmission: transSel, mileage_max: mMax };
    if (key === 'year') { yMin.value = ''; yMax.value = ''; }
    else if (key === 'price') { pMin.value = ''; pMax.value = ''; }
    else if (map[key]) { map[key].value = ''; if (key === 'make') populateModels(''); }
    state.page = 1; load();
  }

  async function load() {
    showSkeletons();
    var c = controls();
    try {
      var res = await DX.api.get('/api/vehicles?' + apiQS(c, state.page, PER_PAGE));
      render(res.data, res.pagination);
    } catch (e) {
      grid.innerHTML = '<p class="muted ta-center" style="grid-column:1/-1">Unable to load inventory. Please retry.</p>';
    }
    updateChips(c); syncUrl(c);
  }

  function fillSelect(sel, values, current) {
    var first = sel.options[0] ? sel.options[0].outerHTML : '<option value="">All</option>';
    sel.innerHTML = first + values.map(function (v) {
      return '<option value="' + DX.escapeHtml(v) + '"' + (v === current ? ' selected' : '') + '>' + DX.escapeHtml(v) + '</option>';
    }).join('');
  }

  function populateModels(make, current) {
    var models = modelsByMake[make] || [];
    if (!make || !models.length) {
      modelSel.innerHTML = '<option value="">All models</option>';
      modelSel.disabled = true; return;
    }
    modelSel.disabled = false;
    modelSel.innerHTML = '<option value="">All models</option>' + models.map(function (m) {
      return '<option value="' + DX.escapeHtml(m) + '"' + (m === current ? ' selected' : '') + '>' + DX.escapeHtml(m) + '</option>';
    }).join('');
  }

  async function init() {
    var url = new URLSearchParams(location.search);
    // load filter metadata
    try {
      var f = await DX.api.get('/api/filters');
      modelsByMake = f.modelsByMake || {};
      fillSelect(makeSel, f.makes, url.get('make') || '');
      fillSelect(bodySel, f.bodyTypes, url.get('body_type') || '');
      fillSelect(fuelSel, f.fuelTypes, url.get('fuel_type') || '');
      fillSelect(transSel, f.transmissions, url.get('transmission') || '');
      yMin.placeholder = f.yearMin || 'From'; yMax.placeholder = f.yearMax || 'To';
      pMin.placeholder = 'Min'; pMax.placeholder = 'Max';
    } catch (e) { /* selects keep their defaults */ }

    // hydrate controls from URL
    if (url.get('q')) searchInput.value = url.get('q');
    if (url.get('sort')) sortSelect.value = url.get('sort');
    if (url.get('make')) populateModels(url.get('make'), url.get('model') || '');
    yMin.value = url.get('year_min') || ''; yMax.value = url.get('year_max') || '';
    pMin.value = url.get('price_min') || ''; pMax.value = url.get('price_max') || '';
    mMax.value = url.get('mileage_max') || '';
    state.page = Math.max(1, Number(url.get('page')) || 1);

    bindEvents();
    load();
  }

  function bindEvents() {
    searchInput.addEventListener('input', DX.debounce(function () { state.page = 1; load(); }, 350));
    sortSelect.addEventListener('change', function () { state.page = 1; load(); });
    makeSel.addEventListener('change', function () { populateModels(makeSel.value); state.page = 1; load(); });
    [modelSel, bodySel, fuelSel, transSel, yMin, yMax, pMin, pMax, mMax].forEach(function (el) {
      el.addEventListener('change', function () { state.page = 1; load(); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); state.page = 1; load(); closeFilters();
    });
    var reset = function () {
      form.reset(); searchInput.value = ''; sortSelect.value = 'newest';
      populateModels(''); state.page = 1; load();
    };
    $('resetFilters').addEventListener('click', reset);
    var er = $('emptyReset'); if (er) er.addEventListener('click', reset);

    var toggle = $('filtersToggle'), panel = $('filtersPanel');
    if (toggle && panel) {
      toggle.addEventListener('click', function () {
        var open = panel.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
      });
    }
    function closeFilters() {
      if (panel) panel.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    var closeBtn = $('closeFilters');
    if (closeBtn) closeBtn.addEventListener('click', closeFilters);
    // close filters when clicking a result on mobile handled by reload; expose
    window.__closeFilters = closeFilters;
  }
  function closeFilters() { if (window.__closeFilters) window.__closeFilters(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
