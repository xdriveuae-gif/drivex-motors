/* Finance request — opens WhatsApp with the filled-in details (no new backend). */
(function () {
  'use strict';
  var form = document.getElementById('financeForm');
  if (!form) return;
  var data = document.body.dataset;

  // Coming from a car page: prefill the preferred car.
  var preCar = new URLSearchParams(location.search).get('car');
  if (preCar && form.car && !form.car.value) form.car.value = preCar.slice(0, 160);

  function setError(field, msg) {
    var el = form.querySelector('[data-error="' + field + '"]');
    if (!el) return;
    el.textContent = msg || '';
    var wrap = el.closest('.form-field');
    if (wrap) wrap.classList.toggle('invalid', !!msg);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.name.value.trim();
    var phone = form.phone.value.trim();
    setError('name', name ? '' : 'Please enter your name.');
    setError('phone', phone ? '' : 'Please enter your phone number.');
    if (!name || !phone) return;

    var lines = [
      'Hello ' + (data.site || 'DriveX Motors') + ', I would like to check my finance eligibility.',
      'Name: ' + name,
      'Phone: ' + phone
    ];
    if (form.salary.value) lines.push('Monthly salary range: ' + form.salary.value);
    if (form.car.value.trim()) lines.push('Preferred car: ' + form.car.value.trim());

    var url = 'https://wa.me/' + (data.whatsapp || '') + '?text=' + encodeURIComponent(lines.join('\n'));
    var win = window.open(url, '_blank', 'noopener');
    if (!win) window.location.href = url;
    DX.toast('Opening WhatsApp…', 'success');
  });
})();
