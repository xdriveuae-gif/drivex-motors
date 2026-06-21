/* Home page — load featured + latest vehicles from the API. */
(function () {
  'use strict';

  async function fill(gridId, url, fallbackUrl) {
    var grid = document.getElementById(gridId);
    if (!grid) return;
    try {
      var res = await DX.api.get(url);
      var items = res.data || [];
      if (!items.length && fallbackUrl) {
        res = await DX.api.get(fallbackUrl);
        items = res.data || [];
      }
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

  function init() {
    fill('featuredGrid', '/api/vehicles?featured=1&limit=6', '/api/vehicles?limit=6&sort=newest');
    fill('latestGrid', '/api/vehicles?sort=newest&limit=3');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
