/* Admin shared utilities — window.DXA (loaded on all admin shell pages). */
(function () {
  'use strict';
  var CSRF = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

  async function apiGet(url) {
    var r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (r.status === 401) { location.href = '/admin/login'; throw new Error('Unauthorized'); }
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(d.error || 'Request failed');
    return d;
  }
  async function apiSend(url, method, payload, isForm) {
    var headers = { Accept: 'application/json', 'X-CSRF-Token': CSRF };
    var body;
    if (isForm) body = payload;
    else if (payload !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(payload); }
    var r = await fetch(url, { method: method, headers: headers, body: body });
    if (r.status === 401) { location.href = '/admin/login'; throw new Error('Unauthorized'); }
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(d.error || 'Request failed'); e.status = r.status; e.data = d; throw e; }
    return d;
  }

  function toast(message, type) {
    var c = document.getElementById('toastContainer');
    if (!c) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.textContent = message;
    c.appendChild(el);
    setTimeout(function () { el.classList.add('hide'); setTimeout(function () { el.remove(); }, 300); }, 3600);
  }

  window.DXA = {
    api: { get: apiGet, send: apiSend },
    toast: toast,
    csrf: CSRF,
    confirm: function (msg) { return Promise.resolve(window.confirm(msg)); }
  };

  function init() {
    // active sidebar link (longest matching prefix)
    var path = location.pathname, best = null, bestLen = -1;
    document.querySelectorAll('.admin-nav a[data-anav]').forEach(function (a) {
      var v = a.getAttribute('data-anav');
      if (v === '__messages') return;
      if (path === v || path.indexOf(v) === 0) { if (v.length > bestLen) { best = a; bestLen = v.length; } }
    });
    if (best) best.classList.add('active');

    // mobile sidebar
    var toggle = document.getElementById('adminMenuToggle');
    var sidebar = document.getElementById('adminSidebar');
    var overlay = document.getElementById('adminOverlay');
    function close() { if (sidebar) sidebar.classList.remove('open'); if (overlay) overlay.hidden = true; }
    if (toggle && sidebar) {
      toggle.addEventListener('click', function () {
        var open = sidebar.classList.toggle('open');
        if (overlay) overlay.hidden = !open;
      });
    }
    if (overlay) overlay.addEventListener('click', close);

    // who am I
    apiGet('/admin/api/me').then(function (d) {
      var u = document.getElementById('adminUser');
      if (u && d.user) u.textContent = d.user;
    }).catch(function () {});

    // logout
    var lo = document.getElementById('logoutBtn');
    if (lo) lo.addEventListener('click', async function () {
      try { var d = await apiSend('/admin/logout', 'POST'); location.href = d.redirect || '/admin/login'; }
      catch (e) { location.href = '/admin/login'; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
