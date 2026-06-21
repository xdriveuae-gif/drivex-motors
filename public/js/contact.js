/* Contact form — validation + submit to /api/contact */
(function () {
  'use strict';
  var form = document.getElementById('contactForm');
  if (!form) return;
  var btn = document.getElementById('contactSubmit');

  // Prefill from query (?vehicle=ID&subject=...) — e.g. arriving from a listing.
  var qs = new URLSearchParams(location.search);
  if (qs.get('vehicle')) {
    document.getElementById('vehicleId').value = qs.get('vehicle');
    DX.api.get('/api/vehicles/' + qs.get('vehicle')).then(function (v) {
      var subj = document.getElementById('cf-subject');
      if (subj && !subj.value) subj.value = 'Enquiry: ' + v.title + ' (' + v.year + ')';
    }).catch(function () {});
  }
  if (qs.get('subject')) {
    var s = document.getElementById('cf-subject'); if (s) s.value = qs.get('subject');
  }

  function clearErrors() {
    form.querySelectorAll('.field-error').forEach(function (e) { e.textContent = ''; });
    form.querySelectorAll('.form-field').forEach(function (f) { f.classList.remove('invalid'); });
  }
  function showErrors(errors) {
    (errors || []).forEach(function (er) {
      var el = form.querySelector('[data-error="' + er.field + '"]');
      if (el) { el.textContent = er.message; el.closest('.form-field').classList.add('invalid'); }
    });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();
    var payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      subject: form.subject.value.trim(),
      message: form.message.value.trim(),
      vehicle_id: document.getElementById('vehicleId').value || ''
    };
    btn.disabled = true; var label = btn.textContent; btn.textContent = 'Sending…';
    try {
      var res = await DX.api.send('/api/contact', 'POST', payload);
      DX.toast(res.message || 'Message sent!', 'success');
      form.reset();
    } catch (err) {
      if (err.data && err.data.errors) showErrors(err.data.errors);
      DX.toast(err.message || 'Could not send message.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });
})();
