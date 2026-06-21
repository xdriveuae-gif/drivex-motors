/* "Sell Your Car" multi-step form. */
(function () {
  'use strict';
  var form = document.getElementById('sellForm');
  if (!form) return;

  var TOTAL = 6;
  var MIN_PHOTOS = 4;
  var MAX_PHOTOS = 20;
  var MAX_BYTES = 10 * 1024 * 1024;
  var OK_TYPES = { 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1 };
  var CSRF = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

  var current = 1;
  var files = [];

  var stepsEl = document.getElementById('wizardSteps');
  var bar = document.getElementById('wizardBar');
  var prevBtn = document.getElementById('wizPrev');
  var nextBtn = document.getElementById('wizNext');
  var submitBtn = document.getElementById('wizSubmit');
  var photoInput = document.getElementById('photoInput');
  var photoGrid = document.getElementById('photoGrid');
  var summaryBox = document.getElementById('reviewSummary');

  var FIELD_STEP = {
    make: 1, model: 1, year: 1, trim: 1, mileage: 1, engine_size: 1, fuel_type: 1, transmission: 1, color: 1, vin: 1,
    owners_count: 2, service_history: 2, accident_history: 2, paintwork: 2, mechanical_issues: 2, additional_notes: 2,
    full_name: 3, phone: 3, whatsapp: 3, email: 3, city: 3,
    images: 4,
    asking_price: 5, negotiable: 5
  };

  function esc(v) { return (v == null ? '' : String(v)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toast(msg, type) { if (window.DX && DX.toast) DX.toast(msg, type); }

  function val(name) { var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; }

  function clearErrors() {
    form.querySelectorAll('.field-error').forEach(function (e) { e.textContent = ''; });
    form.querySelectorAll('.form-field.invalid').forEach(function (f) { f.classList.remove('invalid'); });
  }
  function setError(field, msg) {
    var el = form.querySelector('.field-error[data-error="' + field + '"]');
    if (el) { el.textContent = msg; var ff = el.closest('.form-field'); if (ff) ff.classList.add('invalid'); }
  }

  function validateStep(step) {
    var errs = [];
    if (step === 1) {
      if (!val('make')) errs.push(['make', 'Make is required.']);
      if (!val('model')) errs.push(['model', 'Model is required.']);
      var y = parseInt(val('year'), 10);
      if (!val('year')) errs.push(['year', 'Year is required.']);
      else if (isNaN(y) || y < 1950 || y > 2027) errs.push(['year', 'Enter a valid year.']);
    } else if (step === 3) {
      if (!val('full_name')) errs.push(['full_name', 'Please enter your full name.']);
      if (!val('phone')) errs.push(['phone', 'Please enter your phone number.']);
      var email = val('email');
      if (!email) errs.push(['email', 'Please enter your email.']);
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.push(['email', 'Enter a valid email address.']);
    } else if (step === 4) {
      if (files.length < MIN_PHOTOS) errs.push(['images', 'Please add at least ' + MIN_PHOTOS + ' photos of your car.']);
    }
    if (errs.length) { errs.forEach(function (e) { setError(e[0], e[1]); }); return false; }
    return true;
  }

  function show(step) {
    current = step;
    form.querySelectorAll('.wizard-step').forEach(function (fs) {
      fs.classList.toggle('active', Number(fs.getAttribute('data-step')) === step);
    });
    stepsEl.querySelectorAll('li').forEach(function (li) {
      var n = Number(li.getAttribute('data-step'));
      li.classList.toggle('active', n === step);
      li.classList.toggle('done', n < step);
    });
    bar.style.width = Math.round((step / TOTAL) * 100) + '%';
    prevBtn.hidden = step === 1;
    nextBtn.hidden = step === TOTAL;
    submitBtn.hidden = step !== TOTAL;
    if (step === TOTAL) buildSummary();
    var top = document.querySelector('.sell-wrap');
    if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---- photos ---- */
  function renderPhotos() {
    photoGrid.innerHTML = files.map(function (f, i) {
      return '<div class="photo-thumb"><img src="' + URL.createObjectURL(f) + '" alt="">' +
        '<button type="button" class="pt-remove" data-i="' + i + '" aria-label="Remove">&times;</button></div>';
    }).join('') + (files.length ? '<div class="photo-count">' + files.length + ' / ' + MAX_PHOTOS + ' photos</div>' : '');
    photoGrid.querySelectorAll('.pt-remove').forEach(function (b) {
      b.addEventListener('click', function () { files.splice(Number(b.getAttribute('data-i')), 1); renderPhotos(); });
    });
  }
  function addFiles(list) {
    var rejected = 0;
    Array.prototype.forEach.call(list, function (f) {
      if (files.length >= MAX_PHOTOS) { rejected++; return; }
      if (!OK_TYPES[f.type]) { rejected++; return; }
      if (f.size > MAX_BYTES) { rejected++; return; }
      files.push(f);
    });
    if (rejected) toast(rejected + ' file(s) skipped (wrong type, too large, or over the 20 limit).', 'error');
    renderPhotos();
    if (files.length >= MIN_PHOTOS) setError('images', '');
  }
  photoInput.addEventListener('change', function () { addFiles(photoInput.files); photoInput.value = ''; });

  /* ---- review summary ---- */
  function row(label, value) {
    if (!value) return '';
    return '<div class="rs-row"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
  }
  function buildSummary() {
    var highlights = [];
    form.querySelectorAll('input[name="highlights"]:checked').forEach(function (c) { highlights.push(c.value); });
    var html = '';
    html += '<div class="rs-group"><h3>Vehicle</h3>' +
      row('Make / Model', (val('make') + ' ' + val('model')).trim()) +
      row('Year', val('year')) + row('Trim', val('trim')) +
      row('Mileage', val('mileage') ? Number(val('mileage')).toLocaleString('en-US') + ' km' : '') +
      row('Engine', val('engine_size')) + row('Fuel', val('fuel_type')) +
      row('Transmission', val('transmission')) + row('Colour', val('color')) + row('VIN', val('vin')) + '</div>';
    html += '<div class="rs-group"><h3>Condition</h3>' +
      row('Owners', val('owners_count')) + row('Service history', val('service_history')) +
      row('Accident history', val('accident_history')) + row('Paintwork done', val('paintwork')) +
      row('Mechanical issues', val('mechanical_issues')) + row('Notes', val('additional_notes')) +
      (highlights.length ? row('Highlights', highlights.join(', ')) : '') + '</div>';
    html += '<div class="rs-group"><h3>Your Details</h3>' +
      row('Name', val('full_name')) + row('Phone', val('phone')) + row('WhatsApp', val('whatsapp')) +
      row('Email', val('email')) + row('City', val('city')) + '</div>';
    html += '<div class="rs-group"><h3>Pricing &amp; Photos</h3>' +
      row('Asking price', val('asking_price') ? 'AED ' + Number(val('asking_price')).toLocaleString('en-US') : 'Free valuation requested') +
      row('Negotiable', val('negotiable')) + row('Photos', files.length + ' uploaded') + '</div>';
    summaryBox.innerHTML = html;
  }

  /* ---- navigation ---- */
  nextBtn.addEventListener('click', function () { clearErrors(); if (validateStep(current)) show(Math.min(TOTAL, current + 1)); });
  prevBtn.addEventListener('click', function () { clearErrors(); show(Math.max(1, current - 1)); });
  stepsEl.querySelectorAll('li').forEach(function (li) {
    li.addEventListener('click', function () {
      var target = Number(li.getAttribute('data-step'));
      if (target < current) { clearErrors(); show(target); }
    });
  });

  /* ---- submit ---- */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();
    // validate the gated steps
    var bad = 0;
    [1, 3, 4].forEach(function (s) { if (!validateStep(s)) bad++; });
    if (bad) {
      var firstErr = form.querySelector('.form-field.invalid, .field-error:not(:empty)');
      var stepEl = firstErr && firstErr.closest('.wizard-step');
      if (stepEl) show(Number(stepEl.getAttribute('data-step')));
      toast('Please complete the required fields.', 'error');
      return;
    }

    var fd = new FormData(form);          // text/select/textarea + checked highlights
    files.forEach(function (f) { fd.append('images', f); });

    submitBtn.disabled = true; var label = submitBtn.textContent; submitBtn.textContent = 'Submitting…';
    try {
      var r = await fetch('/api/sell-your-car', { method: 'POST', headers: { 'X-CSRF-Token': CSRF, Accept: 'application/json' }, body: fd });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok) {
        if (d.errors && d.errors.length) {
          d.errors.forEach(function (er) { setError(er.field, er.message); });
          var s = FIELD_STEP[d.errors[0].field] || 1;
          show(s);
        }
        toast(d.error || 'Submission failed. Please try again.', 'error');
        return;
      }
      // success
      document.getElementById('sellForm').hidden = true;
      stepsEl.hidden = true;
      document.querySelector('.wizard-progress').hidden = true;
      var ref = document.getElementById('successRef');
      if (ref && d.submission_number) ref.textContent = 'Reference: ' + d.submission_number;
      var ok = document.getElementById('sellSuccess');
      ok.hidden = false;
      ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      toast('Network error. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false; submitBtn.textContent = label;
    }
  });

  show(1);
})();
