/* Admin add / edit vehicle form (with image management). */
(function () {
  'use strict';
  var form = document.getElementById('vehicleForm');
  if (!form) return;

  var m = location.pathname.match(/\/vehicles\/(\d+)\/edit/);
  var editId = m ? m[1] : null;
  var selectedFiles = [];

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

  /* ---------- previews (new uploads) ---------- */
  function renderPreviews() {
    previewWrap.innerHTML = selectedFiles.map(function (f, i) {
      return '<div class="img-tile"><img src="' + URL.createObjectURL(f) + '" alt="preview">' +
        '<div class="tile-actions"><button type="button" class="tile-btn del" data-rm="' + i + '">Remove</button></div></div>';
    }).join('');
    previewWrap.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () { selectedFiles.splice(Number(b.getAttribute('data-rm')), 1); renderPreviews(); });
    });
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
  function renderExisting(images) {
    if (!editId) { existingWrap.hidden = true; return; }
    existingWrap.hidden = false;
    if (!images || !images.length) { existingWrap.innerHTML = '<p class="muted">No images yet — upload some below.</p>'; return; }
    existingWrap.innerHTML = images.map(function (img) {
      return '<div class="img-tile ' + (img.is_primary ? 'primary' : '') + '">' +
        (img.is_primary ? '<span class="primary-flag">Primary</span>' : '') +
        '<img src="' + img.file_path + '" alt="vehicle image">' +
        '<div class="tile-actions">' +
          (img.is_primary ? '' : '<button type="button" class="tile-btn" data-primary="' + img.id + '">Set primary</button>') +
          '<button type="button" class="tile-btn del" data-delimg="' + img.id + '">Delete</button>' +
        '</div></div>';
    }).join('');
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

  /* ---------- load (edit) ---------- */
  async function loadVehicle() {
    heading.textContent = 'Edit Vehicle';
    saveBtn.textContent = 'Save Changes';
    try {
      var v = await DXA.api.get('/admin/api/vehicles/' + editId);
      FIELDS.forEach(function (k) { if (form[k] != null && v[k] != null) form[k].value = v[k]; });
      form.is_featured.checked = !!v.is_featured;
      form.is_sold.checked = !!v.is_sold;
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
        payload.is_featured = form.is_featured.checked ? 1 : 0;
        payload.is_sold = form.is_sold.checked ? 1 : 0;
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
        form2.append('is_featured', form.is_featured.checked ? '1' : '');
        form2.append('is_sold', form.is_sold.checked ? '1' : '');
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
