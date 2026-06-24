/* Vehicle details — hydrate the page from /api/vehicles/:id */
(function () {
  'use strict';
  var root = document.getElementById('vehicleDetail');
  if (!root) return;
  var data = document.body.dataset;
  var images = [], idx = 0, vehicle = null;

  var m = location.pathname.match(/\/vehicle\/(\d+)/);
  var id = m ? m[1] : null;

  function esc(v) { return DX.escapeHtml(v); }
  function row(label, val) { return '<tr><th>' + label + '</th><td>' + esc(val || '—') + '</td></tr>'; }

  function waLink() {
    var msg = "Hi, I'm interested in the " + vehicle.title + ' (' + vehicle.year + ') listed for ' +
      DX.fmtPrice(vehicle.price) + '. ' + data.url + '/vehicle/' + vehicle.id;
    return 'https://wa.me/' + (data.whatsapp || '') + '?text=' + encodeURIComponent(msg);
  }
  function mailLink() {
    var subject = 'Enquiry: ' + vehicle.title + ' (' + vehicle.year + ')';
    var bd = 'Hello,%0D%0A%0D%0AI would like more information about the ' +
      encodeURIComponent(vehicle.title) + ' priced at ' + encodeURIComponent(DX.fmtPrice(vehicle.price)) +
      '.%0D%0A%0D%0ALink: ' + data.url + '/vehicle/' + vehicle.id;
    return 'mailto:' + (data.email || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + bd;
  }

  function render() {
    images = (vehicle.images && vehicle.images.length) ? vehicle.images.map(function (i) { return i.file_path; })
      : ['/images/placeholders/car-a.svg'];
    var fav = DXFav.has(vehicle.id);
    var badges = '';
    if (vehicle.is_featured) badges += '<span class="vc-badge gold">Featured</span> ';
    if (vehicle.is_sold) badges += '<span class="vc-badge sold">Sold</span>';

    var features = (vehicle.features || []);
    var featuresHtml = features.length
      ? '<div class="vd-section"><h2>Features</h2><ul class="features-list">' +
        features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>'
      : '';

    root.innerHTML =
      '<div class="vd-layout">' +
        '<div class="vd-gallery">' +
          '<div class="vd-main">' + (vehicle.is_sold ? '<span class="vc-badge sold">Sold</span>' : '') +
            '<img id="vdMain" src="' + esc(images[0]) + '" alt="' + esc(vehicle.title) + '"></div>' +
          '<div class="vd-thumbs" id="vdThumbs">' + images.map(function (src, i) {
            return '<button class="vd-thumb ' + (i === 0 ? 'active' : '') + '" data-i="' + i + '">' +
              '<img src="' + esc(src) + '" alt="' + esc(vehicle.title) + ' photo ' + (i + 1) + '"></button>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="vd-info">' +
          '<h1>' + esc(vehicle.title) + '</h1>' +
          '<p class="vd-sub">' + esc(vehicle.year) + ' · ' + DX.fmtMileage(vehicle.mileage) + ' · ' + esc(vehicle.body_type || '—') + '</p>' +
          '<div class="vd-price">' + DX.fmtPrice(vehicle.price) + '</div>' +
          '<div class="vd-badges">' + badges + '</div>' +
          '<ul class="vd-key">' +
            '<li><span class="k">Year</span><span class="v">' + esc(vehicle.year) + '</span></li>' +
            '<li><span class="k">Mileage</span><span class="v">' + DX.fmtMileage(vehicle.mileage) + '</span></li>' +
            '<li><span class="k">Fuel</span><span class="v">' + esc(vehicle.fuel_type || '—') + '</span></li>' +
            '<li><span class="k">Transmission</span><span class="v">' + esc(vehicle.transmission || '—') + '</span></li>' +
          '</ul>' +
          '<div class="vd-actions">' +
            '<a class="btn btn-whatsapp full" href="' + waLink() + '" target="_blank" rel="noopener">WhatsApp Inquiry</a>' +
            '<a class="btn btn-gold" href="tel:' + esc(data.phone) + '">Call Dealer</a>' +
            '<a class="btn btn-outline" href="' + mailLink() + '">Email Inquiry</a>' +
            '<button class="btn btn-outline" id="favBtn">' + (fav ? '♥ Saved' : '♡ Save') + '</button>' +
            '<button class="btn btn-ghost" id="shareBtn">Share</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      (vehicle.description ? '<div class="vd-section"><h2>Description</h2><p class="vd-desc">' + esc(vehicle.description) + '</p></div>' : '') +
      '<div class="vd-section"><h2>Specifications</h2><table class="specs-table"><tbody>' +
        row('Make', vehicle.make) + row('Model', vehicle.model) + row('Year', vehicle.year) +
        row('Mileage', DX.fmtMileage(vehicle.mileage)) + row('Price', DX.fmtPrice(vehicle.price)) +
        row('Engine', vehicle.engine) + row('Fuel Type', vehicle.fuel_type) +
        row('Transmission', vehicle.transmission) + row('Body Type', vehicle.body_type) + row('Color', vehicle.color) +
      '</tbody></table></div>' +
      featuresHtml;

    document.getElementById('bcTitle').textContent = vehicle.title;
    bindGallery(); bindActions();
    DX.revealScan(root);
  }

  function setMain(i) {
    idx = (i + images.length) % images.length;
    document.getElementById('vdMain').src = images[idx];
    root.querySelectorAll('.vd-thumb').forEach(function (t, k) { t.classList.toggle('active', k === idx); });
  }

  function bindGallery() {
    root.querySelectorAll('.vd-thumb').forEach(function (t) {
      t.addEventListener('click', function () { setMain(Number(t.getAttribute('data-i'))); });
    });
    document.getElementById('vdMain').addEventListener('click', openLightbox);
  }

  function bindActions() {
    var favBtn = document.getElementById('favBtn');
    favBtn.addEventListener('click', function () {
      var on = DXFav.toggle(vehicle.id);
      favBtn.textContent = on ? '♥ Saved' : '♡ Save';
      DX.toast(on ? 'Added to favourites' : 'Removed from favourites', on ? 'success' : 'info');
    });
    document.getElementById('shareBtn').addEventListener('click', function () {
      var url = data.url + '/vehicle/' + vehicle.id;
      if (navigator.share) {
        navigator.share({ title: vehicle.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { DX.toast('Link copied to clipboard', 'success'); });
      } else { DX.toast(url, 'info'); }
    });
  }

  /* Lightbox */
  var lb = document.getElementById('lightbox'), lbImg = document.getElementById('lightboxImg');
  function openLightbox() {
    if (!lb) return;
    lbImg.src = images[idx]; lb.hidden = false; document.body.style.overflow = 'hidden';
  }
  function closeLightbox() { lb.hidden = true; document.body.style.overflow = ''; }
  if (lb) {
    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', function () { setMain(idx - 1); lbImg.src = images[idx]; });
    document.getElementById('lightboxNext').addEventListener('click', function () { setMain(idx + 1); lbImg.src = images[idx]; });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') { setMain(idx - 1); lbImg.src = images[idx]; }
      if (e.key === 'ArrowRight') { setMain(idx + 1); lbImg.src = images[idx]; }
    });
  }

  async function loadRelated() {
    try {
      var res = await DX.api.get('/api/vehicles?make=' + encodeURIComponent(vehicle.make) + '&limit=4');
      var items = (res.data || []).filter(function (v) { return v.id !== vehicle.id; }).slice(0, 3);
      if (!items.length) return;
      var wrap = document.getElementById('relatedWrap');
      document.getElementById('relatedGrid').innerHTML = items.map(DX.vehicleCard).join('');
      wrap.hidden = false;
      DX.revealScan(wrap);
    } catch (e) { /* ignore */ }
  }

  async function init() {
    if (!id) { root.innerHTML = '<p class="muted ta-center">Vehicle not found.</p>'; return; }
    try {
      vehicle = await DX.api.get('/api/vehicles/' + id);
      render();
      loadRelated();
    } catch (e) {
      root.innerHTML = '<div class="ta-center" style="padding:50px 0"><h2 class="section-title">Vehicle unavailable</h2>' +
        '<p class="muted">This vehicle could not be found or is no longer listed.</p>' +
        '<a class="btn btn-gold" href="/inventory" style="margin-top:18px">Back to Inventory</a></div>';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
