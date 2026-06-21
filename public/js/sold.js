/* Sold vehicles page — lists cars marked as sold, paginated. */
(function () {
  'use strict';
  var grid = document.getElementById('soldGrid');
  if (!grid) return;
  var countEl = document.getElementById('soldCount');
  var emptyEl = document.getElementById('soldEmpty');
  var pager = document.getElementById('soldPagination');
  var state = { page: 1 };

  async function load() {
    grid.innerHTML = DX.skeletons(6);
    if (emptyEl) emptyEl.hidden = true;
    try {
      var res = await DX.api.get('/api/vehicles?sold=1&sort=newest&page=' + state.page + '&limit=12');
      render(res.data, res.pagination);
    } catch (e) {
      grid.innerHTML = '';
      if (countEl) countEl.textContent = 'Could not load sold vehicles.';
    }
  }

  function render(rows, p) {
    if (!rows.length) {
      grid.innerHTML = '';
      pager.innerHTML = '';
      if (countEl) countEl.textContent = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (countEl) countEl.textContent = p.total + ' sold vehicle' + (p.total === 1 ? '' : 's');
    grid.innerHTML = rows.map(DX.vehicleCard).join('');
    DX.revealScan(grid);
    renderPager(p);
  }

  function renderPager(p) {
    if (!p || p.totalPages <= 1) { pager.innerHTML = ''; return; }
    var html = '<button data-page="' + (p.page - 1) + '" ' + (p.page <= 1 ? 'disabled' : '') + '>‹</button>';
    for (var i = 1; i <= p.totalPages; i++) {
      html += '<button data-page="' + i + '" class="' + (i === p.page ? 'active' : '') + '">' + i + '</button>';
    }
    html += '<button data-page="' + (p.page + 1) + '" ' + (p.page >= p.totalPages ? 'disabled' : '') + '>›</button>';
    pager.innerHTML = html;
    pager.querySelectorAll('button[data-page]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        state.page = Number(b.getAttribute('data-page'));
        load();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
