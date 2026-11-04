/* Admin add / edit vehicle form (with image management). */
(function () {
  'use strict';
  var form = document.getElementById('vehicleForm');
  if (!form) return;

  var m = location.pathname.match(/\/vehicles\/(\d+)\/edit/);
  var editId = m ? m[1] : null;
  var selectedFiles = [];
  var existing = [];
  var saveChain = Promise.resolve();

  var heading = document.getElementById('formHeading');
  var saveBtn = document.getElementById('saveBtn');
  var statusEl = document.getElementById('formStatus');
  var existingWrap = document.getElementById('existingImages');
  var imageInput = document.getElementById('imageInput');
  var uploadZone = document.getElementById('uploadZone');
  var previewWrap = document.getElementById('imagePreview');

  var FIELDS = ['title', 'make', 'model', 'year', 'price', 'mileage', 'engine',
    'transmission', 'fuel_type', 'body_type', 'color', 'description'];

  /* ---------- errors ---------- */
  function clearErrors() {
    form.querySelectorAll('.field-error').forEach(function (e) { e.textContent = ''; });
    form.querySelectorAll('.form-field').forEach(function (f) { f.classList.remove('invalid'); });
  }
  function showErrors(errors) {
    (errors || []).forEach(function (er) {
      var el = form.querySelector('[data-error="' + er.field + '"]');
      if (el) { el.textContent = er.message; var ff = el.closest('.form-field'); if (ff) ff.classList.add('invalid'); }
    });
  }

  /* ---------- photo order (drag, or arrows on touch screens) ---------- */
  function moveItem(list, from, to) {
    if (to < 0 || to >= list.length || from === to) return false;
    list.splice(to, 0, list.splice(from, 1)[0]);
    return true;
  }

  function moveControls(i, total) {
    return '<div class="tile-move">' +
      '<button type="button" class="tile-arrow" data-to="' + (i - 1) + '" aria-label="Move earlier"' + (i === 0 ? ' disabled' : '') + '>‹</button>' +
      '<button type="button" class="tile-arrow" data-to="' + (i + 1) + '" aria-label="Move later"' + (i === total - 1 ? ' disabled' : '') + '>›</button>' +
    '</div>';
  }

  function bindReorder(wrap, onMove) {
    var dragFrom = null;
    wrap.querySelectorAll('.img-tile').forEach(function (tile) {
      var i = Number(tile.getAttribute('data-i'));
      tile.addEventListener('dragstart', function (e) {
        dragFrom = i;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
        tile.classList.add('dragging');
      });
      tile.addEventListener('dragend', function () { tile.classList.remove('dragging'); });
      tile.addEventListener('dragover', function (e) {
        if (dragFrom === null) return;
        e.preventDefault();
        tile.classList.add('drag-over');
      });
      tile.addEventListener('dragleave', function () { tile.classList.remove('drag-over'); });
      tile.addEventListener('drop', function (e) {
        e.preventDefault();
        tile.classList.remove('drag-over');
        if (dragFrom !== null) onMove(dragFrom, i);
        dragFrom = null;
      });
      tile.querySelectorAll('[data-to]').forEach(function (b) {
        b.addEventListener('click', function () { onMove(i, Number(b.getAttribute('data-to'))); });
      });
    });
  }

  function updateToolbar() {
    document.getElementById('imagesToolbar').hidden = !(existing.length + selectedFiles.length);
  }

  /* ---------- previews (new uploads) ---------- */
  function renderPreviews() {
    previewWrap.innerHTML = selectedFiles.map(function (f, i) {
      var isMain = !existing.length && i === 0;
      return '<div class="img-tile ' + (isMain ? 'primary' : '') + '" draggable="true" data-i="' + i + '">' +
        (isMain ? '<span class="primary-flag">Main</span>' : '') +
        '<span class="tile-num">' + (existing.length + i + 1) + '</span>' +
        '<img src="' + URL.createObjectURL(f) + '" alt="preview" draggable="false">' +
        moveControls(i, selectedFiles.length) +
        '<div class="tile-actions"><button type="button" class="tile-btn del" data-rm="' + i + '">Remove</button></div></div>';
    }).join('');
    previewWrap.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () { selectedFiles.splice(Number(b.getAttribute('data-rm')), 1); renderPreviews(); });
    });
    bindReorder(previewWrap, function (from, to) {
      if (moveItem(selectedFiles, from, to)) renderPreviews();
    });
    updateToolbar();
  }
  function addFiles(fileList) {
    Array.prototype.forEach.call(fileList, function (f) { if (f.type.indexOf('image/') === 0) selectedFiles.push(f); });
    renderPreviews();
  }

  uploadZone.addEventListener('click', function () { imageInput.click(); });
  imageInput.addEventListener('change', function () { addFiles(imageInput.files); imageInput.value = ''; });
  ['dragover', 'dragenter'].forEach(function (ev) {
    uploadZone.addEventListener(ev, function (e) { e.preventDefault(); uploadZone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    uploadZone.addEventListener(ev, function (e) { e.preventDefault(); uploadZone.classList.remove('dragover'); });
  });
  uploadZone.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

  /* ---------- existing images (edit mode) ---------- */
  function saveOrder() {
    var ids = existing.map(function (img) { return img.id; });
    saveChain = saveChain.then(function () {
      return DXA.api.send('/admin/api/vehicles/' + editId + '/images/order', 'PUT', { ids: ids });
    }).catch(function (e) {
      DXA.toast(e.message, 'error');
      return refreshImages();
    });
  }

  function renderExisting(images) {
    existing = images || [];
    renderPreviews();
    if (!editId) { existingWrap.hidden = true; return; }
    existingWrap.hidden = false;
    if (!existing.length) { existingWrap.innerHTML = '<p class="muted">No images yet — upload some below.</p>'; return; }
    existingWrap.innerHTML = existing.map(function (img, i) {
      return '<div class="img-tile ' + (img.is_primary ? 'primary' : '') + '" draggable="true" data-i="' + i + '">' +
        (img.is_primary ? '<span class="primary-flag">Main</span>' : '') +
        '<span class="tile-num">' + (i + 1) + '</span>' +
        '<img src="' + img.file_path + '" alt="vehicle image" draggable="false">' +
        moveControls(i, existing.length) +
        '<div class="tile-actions">' +
          (img.is_primary ? '' : '<button type="button" class="tile-btn" data-primary="' + img.id + '">Set main</button>') +
          '<button type="button" class="tile-btn del" data-delimg="' + img.id + '">Delete</button>' +
        '</div></div>';
    }).join('');
    bindReorder(existingWrap, function (from, to) {
      if (!moveItem(existing, from, to)) return;
      existing.forEach(function (img, i) { img.is_primary = i === 0 ? 1 : 0; });
      renderExisting(existing);
      saveOrder();
    });
    existingWrap.querySelectorAll('[data-primary]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await DXA.api.send('/admin/api/vehicles/' + editId + '/images/' + b.getAttribute('data-primary') + '/primary', 'PATCH'); refreshImages(); }
        catch (e) { DXA.toast(e.message, 'error'); }
      });
    });
    existingWrap.querySelectorAll('[data-delimg]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!(await DXA.confirm('Delete this image?'))) return;
        try { await DXA.api.send('/admin/api/vehicles/' + editId + '/images/' + b.getAttribute('data-delimg'), 'DELETE'); refreshImages(); DXA.toast('Image deleted', 'success'); }
        catch (e) { DXA.toast(e.message, 'error'); }
      });
    });
  }
  async function refreshImages() {
    var v = await DXA.api.get('/admin/api/vehicles/' + editId);
    renderExisting(v.images);
  }

  document.getElementById('deleteAllImages').addEventListener('click', async function () {
    var total = existing.length + selectedFiles.length;
    var msg = existing.length
      ? 'Delete all ' + total + ' photos? Saved photos are removed from the ad straight away and cannot be recovered.'
      : 'Remove all ' + total + ' photos?';
    if (!(await DXA.confirm(msg))) return;
    try {
      if (existing.length) {
        await saveChain;
        await DXA.api.send('/admin/api/vehicles/' + editId + '/images', 'DELETE');
        renderExisting([]);
      }
      selectedFiles = [];
      renderPreviews();
      DXA.toast('All photos deleted', 'success');
    } catch (e) { DXA.toast(e.message, 'error'); }
  });

  /* ---------- load (edit) ---------- */
  async function loadVehicle() {
    heading.textContent = 'Edit Vehicle';
    saveBtn.textContent = 'Save Changes';
    try {
      var v = await DXA.api.get('/admin/api/vehicles/' + editId);
      FIELDS.forEach(function (k) { if (form[k] != null && v[k] != null) form[k].value = v[k]; });
      form.is_sold.checked = !!v.is_sold;
      form.is_reserved.checked = !!v.is_reserved;
      form.is_coming_soon.checked = !!v.is_coming_soon;
      var soldAtHint = document.getElementById('soldAtHint');
      if (soldAtHint) {
        if (v.sold_at) {
          var d = new Date(String(v.sold_at).replace(' ', 'T') + 'Z');
          soldAtHint.textContent = isNaN(d) ? '' :
            'Marked sold on ' + d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
            ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          soldAtHint.hidden = isNaN(d);
        } else {
          soldAtHint.hidden = true;
        }
      }
      form.features.value = (v.features || []).join('\n');
      renderExisting(v.images);
    } catch (e) { DXA.toast('Could not load vehicle.', 'error'); }
  }

  /* ---------- submit ---------- */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();
    saveBtn.disabled = true; statusEl.textContent = 'Saving…';
    try {
      if (editId) {
        var payload = {};
        FIELDS.forEach(function (k) { payload[k] = form[k].value; });
        payload.features = form.features.value;
        payload.is_sold = form.is_sold.checked ? 1 : 0;
        payload.is_reserved = form.is_reserved.checked ? 1 : 0;
        payload.is_coming_soon = form.is_coming_soon.checked ? 1 : 0;
        await DXA.api.send('/admin/api/vehicles/' + editId, 'PUT', payload);
        if (selectedFiles.length) {
          var fd = new FormData();
          selectedFiles.forEach(function (f) { fd.append('images', f); });
          await DXA.api.send('/admin/api/vehicles/' + editId + '/images', 'POST', fd, true);
          selectedFiles = []; renderPreviews(); refreshImages();
        }
        statusEl.textContent = ''; DXA.toast('Vehicle saved', 'success');
      } else {
        var form2 = new FormData();
        FIELDS.forEach(function (k) { form2.append(k, form[k].value); });
        form2.append('features', form.features.value);
        form2.append('is_sold', form.is_sold.checked ? '1' : '');
        form2.append('is_reserved', form.is_reserved.checked ? '1' : '');
        form2.append('is_coming_soon', form.is_coming_soon.checked ? '1' : '');
        selectedFiles.forEach(function (f) { form2.append('images', f); });
        var res = await DXA.api.send('/admin/api/vehicles', 'POST', form2, true);
        statusEl.textContent = '';
        location.href = res.redirect || '/admin/vehicles';
      }
    } catch (err) {
      statusEl.textContent = '';
      if (err.data && err.data.errors) { showErrors(err.data.errors); DXA.toast('Please fix the highlighted fields.', 'error'); }
      else DXA.toast(err.message || 'Save failed.', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  if (editId) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadVehicle);
    else loadVehicle();
  }
})();
