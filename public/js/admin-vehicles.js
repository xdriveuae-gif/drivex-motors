/* Admin vehicle list — search, filter, paginate, toggle, delete. */
(function () {
  'use strict';
  var esc = function (v) { return (v === null || v === undefined) ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var aed = function (n) { return 'AED ' + (Number(n) || 0).toLocaleString('en-US'); };
  var km = function (n) { return (Number(n) || 0).toLocaleString('en-US') + ' km'; };

  var tbody = document.getElementById('vehiclesTbody');
  var pager = document.getElementById('adminPagination');
  var search = document.getElementById('adminSearch');
  var statusSel = document.getElementById('statusFilter');
  var state = { page: 1, q: '', status: '' };

  var EDIT = '<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"/></svg>';
  var DEL = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13"/></svg>';

  async function load() {
    tbody.innerHTML = '<tr><td colspan="8" class="muted ta-center">Loading…</td></tr>';
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.status) p.set('status', state.status);
    p.set('page', state.page); p.set('limit', 12);
    try {
      var res = await DXA.api.get('/admin/api/vehicles?' + p.toString());
      render(res.data, res.pagination);
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted ta-center">Failed to load.</td></tr>';
    }
  }

  function render(rows, pagination) {
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted ta-center" style="padding:30px">No vehicles found. <a class="link-btn" href="/admin/vehicles/new">Add one →</a></td></tr>';
      pager.innerHTML = ''; return;
    }
    tbody.innerHTML = rows.map(function (v) {
      var img = v.primary_image || '/images/placeholders/car-a.svg';
      return '<tr data-id="' + v.id + '">' +
        '<td><div class="cell-vehicle"><img src="' + esc(img) + '" alt="' + esc(v.title) + '">' +
          '<div><div class="cv-title">' + esc(v.title) + '</div><div class="cv-sub">' + esc(v.make) + ' ' + esc(v.model) + ' · ' + (v.image_count || 0) + ' photos</div></div></div></td>' +
        '<td>' + esc(v.year) + '</td>' +
        '<td class="price-cell">' + aed(v.price) + '</td>' +
        '<td>' + km(v.mileage) + '</td>' +
        '<td><label class="switch"><input type="checkbox" data-feature ' + (v.is_featured ? 'checked' : '') + '></label></td>' +
        '<td><label class="switch"><input type="checkbox" data-sold ' + (v.is_sold ? 'checked' : '') + '></label></td>' +
        '<td><label class="switch"><input type="checkbox" data-published ' + (v.is_published ? 'checked' : '') + '></label></td>' +
        '<td><div class="row-actions">' +
          '<a class="icon-btn" href="/admin/vehicles/' + v.id + '/edit" title="Edit">' + EDIT + '</a>' +
          '<button class="icon-btn danger" data-del="' + v.id + '" title="Delete">' + DEL + '</button>' +
        '</div></td></tr>';
    }).join('');
    bindRows();
    renderPager(pagination);
  }

  function bindRows() {
    tbody.querySelectorAll('tr[data-id]').forEach(function (tr) {
      var id = tr.getAttribute('data-id');
      tr.querySelector('[data-feature]').addEventListener('change', function () {
        patch(id, { is_featured: this.checked ? 1 : 0 }, this.checked ? 'Marked as featured' : 'Removed from featured');
      });
      tr.querySelector('[data-sold]').addEventListener('change', function () {
        patch(id, { is_sold: this.checked ? 1 : 0 }, this.checked ? 'Marked as sold' : 'Marked as available');
      });
      tr.querySelector('[data-published]').addEventListener('change', function () {
        patch(id, { is_published: this.checked ? 1 : 0 }, this.checked ? 'Published to inventory' : 'Hidden from inventory');
      });
      tr.querySelector('[data-del]').addEventListener('click', async function () {
        if (!(await DXA.confirm('Delete this vehicle and all its images? This cannot be undone.'))) return;
        try { await DXA.api.send('/admin/api/vehicles/' + id, 'DELETE'); DXA.toast('Vehicle deleted', 'success'); load(); }
        catch (e) { DXA.toast(e.message, 'error'); }
      });
    });
  }

  async function patch(id, body, msg) {
    try { await DXA.api.send('/admin/api/vehicles/' + id, 'PATCH', body); DXA.toast(msg, 'success'); }
    catch (e) { DXA.toast(e.message, 'error'); load(); }
  }

  function renderPager(p) {
    if (!p || p.totalPages <= 1) { pager.innerHTML = ''; return; }
    var html = '<button data-page="' + (p.page - 1) + '" ' + (p.page <= 1 ? 'disabled' : '') + '>‹</button>';
    for (var i = 1; i <= p.totalPages; i++) html += '<button data-page="' + i + '" class="' + (i === p.page ? 'active' : '') + '">' + i + '</button>';
    html += '<button data-page="' + (p.page + 1) + '" ' + (p.page >= p.totalPages ? 'disabled' : '') + '>›</button>';
    pager.innerHTML = html;
    pager.querySelectorAll('button[data-page]').forEach(function (b) {
      b.addEventListener('click', function () { if (!b.disabled) { state.page = Number(b.getAttribute('data-page')); load(); } });
    });
  }

  var debounce = function (fn, w) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, w); }; };
  search.addEventListener('input', debounce(function () { state.q = search.value.trim(); state.page = 1; load(); }, 350));
  statusSel.addEventListener('change', function () { state.status = statusSel.value; state.page = 1; load(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
