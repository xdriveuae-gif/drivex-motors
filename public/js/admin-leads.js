/* Admin — vehicle purchase leads list (search, filter, paginate, delete). */
(function () {
  'use strict';
  var esc = function (v) { return (v === null || v === undefined) ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var aed = function (n) { return n == null || n === '' ? '—' : 'AED ' + (Number(n) || 0).toLocaleString('en-US'); };
  function when(s) { if (!s) return ''; var d = new Date(String(s).replace(' ', 'T') + 'Z'); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  var ST_CLASS = { 'New': 'st-new', 'Under Review': 'st-review', 'Contacted': 'st-contacted', 'Offer Sent': 'st-offer', 'Purchased': 'st-purchased', 'Rejected': 'st-rejected' };
  function badge(s) { return '<span class="lead-status ' + (ST_CLASS[s] || 'st-new') + '">' + esc(s) + '</span>'; }

  var tbody = document.getElementById('leadsTbody');
  var pager = document.getElementById('adminPagination');
  var search = document.getElementById('adminSearch');
  var statusSel = document.getElementById('statusFilter');
  var countEl = document.getElementById('leadsCount');
  var state = { page: 1, q: '', status: '' };

  var DEL = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13"/></svg>';
  var WA = '<svg viewBox="0 0 32 32"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.6c1.8.9 3.7 1.4 5.8 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-4.3.8.8-4.2-.2-.4A9.8 9.8 0 016.2 15c0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.8-9.8 9.8zm5.4-7.3c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.1 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4z"/></svg>';

  var SHOWROOM = ((document.querySelector('meta[name="showroom-whatsapp"]') || {}).content || '').replace(/[^\d]/g, '');
  function waLink(s) {
    if (!SHOWROOM) return '';
    var lines = [
      'New car submission — ' + (s.submission_number || ('#' + s.id)),
      s.year + ' ' + s.make + ' ' + s.model,
      'Asking: ' + (s.asking_price ? 'AED ' + Number(s.asking_price).toLocaleString('en-US') : '—'),
      '',
      'Customer: ' + s.full_name,
      'Phone: ' + s.phone,
      (s.whatsapp ? 'WhatsApp: ' + s.whatsapp : ''),
      'Email: ' + s.email,
      (s.city ? 'City: ' + s.city : '')
    ].filter(Boolean);
    // wa.me can't attach images — add tappable photo links instead.
    var origin = location.origin;
    (s.image_paths ? String(s.image_paths).split('|') : []).forEach(function (p, i) {
      if (p) lines.push('Photo ' + (i + 1) + ': ' + origin + p);
    });
    return 'https://wa.me/' + SHOWROOM + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  async function load() {
    tbody.innerHTML = '<tr><td colspan="7" class="muted ta-center">Loading…</td></tr>';
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.status) p.set('status', state.status);
    p.set('page', state.page); p.set('limit', 12);
    try {
      var res = await DXA.api.get('/admin/api/submissions?' + p.toString());
      render(res.data, res.pagination);
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7" class="muted ta-center">Failed to load.</td></tr>'; }
  }

  function render(rows, pagination) {
    if (countEl) countEl.textContent = pagination.total + ' total';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted ta-center" style="padding:30px">No submissions found.</td></tr>';
      pager.innerHTML = ''; return;
    }
    tbody.innerHTML = rows.map(function (s) {
      var thumb = s.thumb || '/images/placeholders/car-a.svg';
      return '<tr data-id="' + s.id + '">' +
        '<td><a class="link-btn" href="/admin/leads/' + s.id + '">' + esc(s.submission_number || ('#' + s.id)) + '</a></td>' +
        '<td><div class="cell-vehicle"><img src="' + esc(thumb) + '" alt="">' +
          '<div><div class="cv-title">' + esc(s.make) + ' ' + esc(s.model) + '</div><div class="cv-sub">' + esc(s.year) + ' · ' + (s.image_count || 0) + ' photos</div></div></div></td>' +
        '<td><div class="cv-title">' + esc(s.full_name) + '</div><div class="cv-sub">' + esc(s.phone) + '</div></td>' +
        '<td class="price-cell">' + aed(s.asking_price) + '</td>' +
        '<td>' + badge(s.status) + '</td>' +
        '<td>' + when(s.created_at) + '</td>' +
        '<td><div class="row-actions">' +
          (waLink(s) ? '<a class="icon-btn wa" href="' + esc(waLink(s)) + '" target="_blank" rel="noopener" title="Send lead to showroom WhatsApp">' + WA + '</a>' : '') +
          '<a class="btn btn-outline btn-sm" href="/admin/leads/' + s.id + '">View</a>' +
          '<button class="icon-btn danger" data-del="' + s.id + '" title="Delete">' + DEL + '</button>' +
        '</div></td></tr>';
    }).join('');
    tbody.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!(await DXA.confirm('Delete this submission and its photos? This cannot be undone.'))) return;
        try { await DXA.api.send('/admin/api/submissions/' + b.getAttribute('data-del'), 'DELETE'); DXA.toast('Submission deleted', 'success'); load(); }
        catch (e) { DXA.toast(e.message, 'error'); }
      });
    });
    renderPager(pagination);
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
