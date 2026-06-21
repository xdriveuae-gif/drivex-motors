/* Contact form (STATIC build) — validates client-side, then sends the
   enquiry to the dealership via WhatsApp (no server/database needed). */
(function () {
  'use strict';
  var form = document.getElementById('contactForm');
  if (!form) return;
  var btn = document.getElementById('contactSubmit');
  var WHATSAPP = (document.body.dataset.whatsapp || '').replace(/[^\d]/g, '');
  var EMAIL = document.body.dataset.email || '';

  // Prefill subject from query (?vehicle=ID / ?subject=...)
  var qs = new URLSearchParams(location.search);
  if (qs.get('subject')) {
    var sEl = document.getElementById('cf-subject'); if (sEl) sEl.value = qs.get('subject');
  }
  if (qs.get('vehicle')) {
    var hid = document.getElementById('vehicleId'); if (hid) hid.value = qs.get('vehicle');
    try {
      var v = (window.DX_VEHICLES || []).filter(function (x) { return String(x.id) === qs.get('vehicle'); })[0];
      var sub = document.getElementById('cf-subject');
      if (v && sub && !sub.value) sub.value = 'Enquiry: ' + v.title + ' (' + v.year + ')';
    } catch (e) { /* ignore */ }
  }

  function clearErrors() {
    form.querySelectorAll('.field-error').forEach(function (e) { e.textContent = ''; });
    form.querySelectorAll('.form-field').forEach(function (f) { f.classList.remove('invalid'); });
  }
  function showErrors(list) {
    list.forEach(function (er) {
      var el = form.querySelector('[data-error="' + er[0] + '"]');
      if (el) { el.textContent = er[1]; var ff = el.closest('.form-field'); if (ff) ff.classList.add('invalid'); }
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var phone = form.phone.value.trim();
    var subject = form.subject.value.trim();
    var message = form.message.value.trim();

    var errs = [];
    if (!name) errs.push(['name', 'Please enter your name.']);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.push(['email', 'Please enter a valid email address.']);
    if (message.length < 5) errs.push(['message', 'Please enter a message (at least 5 characters).']);
    if (errs.length) { showErrors(errs); return; }

    var lines = ['Hello DriveX Motors,', '', 'Name: ' + name, 'Email: ' + email];
    if (phone) lines.push('Phone: ' + phone);
    if (subject) lines.push('Subject: ' + subject);
    lines.push('', message);
    var body = lines.join('\n');

    if (WHATSAPP) {
      window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(body), '_blank', 'noopener');
      if (window.DX) DX.toast('Opening WhatsApp to send your message…', 'success');
    } else if (EMAIL) {
      window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject || 'Website enquiry') + '&body=' + encodeURIComponent(body);
    }
    form.reset();
  });
})();
