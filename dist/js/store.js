/* ============================================================
   DriveX Motors — STATIC data engine
   Replaces the server JSON API. Reads window.DX_VEHICLES (js/data.js)
   and overrides DX.api.get() so the existing page scripts work unchanged.
   ============================================================ */
(function () {
  'use strict';

  function all() { return (window.DX_VEHICLES || []).slice(); }
  function num(x) { var n = parseInt(x, 10); return isNaN(n) ? null : n; }
  function primaryImage(v) { return (v.images && v.images[0]) || '/images/placeholders/car-a.svg'; }
  function withCard(v) { var o = {}; for (var k in v) o[k] = v[k]; o.primary_image = primaryImage(v); return o; }

  function byNewest(a, b) {
    var ka = a.created_at || '', kb = b.created_at || '';
    if (ka !== kb) return ka < kb ? 1 : -1;
    return b.id - a.id;
  }
  var SORTERS = {
    newest: byNewest,
    oldest: function (a, b) { return -byNewest(a, b); },
    price_asc: function (a, b) { return a.price - b.price; },
    price_desc: function (a, b) { return b.price - a.price; },
    mileage_asc: function (a, b) { return a.mileage - b.mileage; },
    year_desc: function (a, b) { return b.year - a.year; }
  };

  function query(p) {
    var list = all();
    if (p.include_sold !== '1') list = list.filter(function (v) { return !v.is_sold; });
    if (p.featured === '1') list = list.filter(function (v) { return v.is_featured; });

    var q = (p.q || '').toLowerCase().trim();
    if (q) {
      list = list.filter(function (v) {
        return [v.title, v.make, v.model, v.description, v.color].join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    ['make', 'model', 'fuel_type', 'body_type', 'transmission'].forEach(function (k) {
      if (p[k]) list = list.filter(function (v) { return String(v[k]) === String(p[k]); });
    });
    if (num(p.year_min) !== null) list = list.filter(function (v) { return v.year >= num(p.year_min); });
    if (num(p.year_max) !== null) list = list.filter(function (v) { return v.year <= num(p.year_max); });
    if (num(p.price_min) !== null) list = list.filter(function (v) { return v.price >= num(p.price_min); });
    if (num(p.price_max) !== null) list = list.filter(function (v) { return v.price <= num(p.price_max); });
    if (num(p.mileage_max) !== null) list = list.filter(function (v) { return v.mileage <= num(p.mileage_max); });

    list.sort(SORTERS[p.sort] || SORTERS.newest);

    var total = list.length;
    var page = Math.max(1, num(p.page) || 1);
    var limit = Math.min(48, Math.max(1, num(p.limit) || 12));
    var data = list.slice((page - 1) * limit, page * limit).map(withCard);
    return { data: data, pagination: { page: page, limit: limit, total: total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  function getOne(id) {
    id = Number(id);
    var v = all().filter(function (x) { return x.id === id; })[0];
    if (!v) { var e = new Error('Vehicle not found.'); e.status = 404; throw e; }
    var imgs = (v.images && v.images.length ? v.images : ['/images/placeholders/car-a.svg']);
    var out = {}; for (var k in v) out[k] = v[k];
    out.images = imgs.map(function (p, i) { return { id: i, file_path: p, is_primary: i === 0 ? 1 : 0, sort_order: i }; });
    out.features = v.features || [];
    return out;
  }

  function filters() {
    var list = all().filter(function (v) { return !v.is_sold; });
    function distinct(key) {
      var seen = {}; list.forEach(function (v) { if (v[key]) seen[v[key]] = 1; });
      return Object.keys(seen).sort();
    }
    var modelsByMake = {};
    list.forEach(function (v) {
      if (!modelsByMake[v.make]) modelsByMake[v.make] = [];
      if (modelsByMake[v.make].indexOf(v.model) < 0) modelsByMake[v.make].push(v.model);
    });
    Object.keys(modelsByMake).forEach(function (k) { modelsByMake[k].sort(); });
    var years = list.map(function (v) { return v.year; });
    var prices = list.map(function (v) { return v.price; });
    var miles = list.map(function (v) { return v.mileage; });
    return {
      makes: distinct('make'), modelsByMake: modelsByMake,
      bodyTypes: distinct('body_type'), fuelTypes: distinct('fuel_type'), transmissions: distinct('transmission'),
      yearMin: years.length ? Math.min.apply(null, years) : 1990,
      yearMax: years.length ? Math.max.apply(null, years) : new Date().getFullYear(),
      priceMin: prices.length ? Math.min.apply(null, prices) : 0,
      priceMax: prices.length ? Math.max.apply(null, prices) : 0,
      mileageMax: miles.length ? Math.max.apply(null, miles) : 0
    };
  }

  function route(url) {
    var parts = String(url).split('?');
    var path = parts[0];
    var qp = {};
    new URLSearchParams(parts[1] || '').forEach(function (val, key) { qp[key] = val; });
    var detail = path.match(/^\/api\/vehicles\/(\d+)$/);
    if (detail) return getOne(detail[1]);
    if (path === '/api/vehicles') return query(qp);
    if (path === '/api/filters') return filters();
    var e = new Error('Not found'); e.status = 404; throw e;
  }

  function install() {
    if (!window.DX) return;
    window.DX.api.get = function (url) {
      return new Promise(function (resolve, reject) {
        try { resolve(route(url)); } catch (err) { reject(err); }
      });
    };
    window.DXStore = { query: query, getOne: getOne, filters: filters };
  }

  if (window.DX) install();
  else document.addEventListener('DOMContentLoaded', install);
})();
