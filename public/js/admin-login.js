/* Admin login (standalone — does not depend on admin-common). */
(function () {
  'use strict';
  var form = document.getElementById('loginForm');
  if (!form) return;
  var btn = document.getElementById('loginBtn');
  var errBox = document.getElementById('loginError');
  var CSRF = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
  var next = new URLSearchParams(location.search).get('next') || '/admin/dashboard';

  function showError(msg) { errBox.textContent = msg; errBox.hidden = false; }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errBox.hidden = true;
    btn.disabled = true; var label = btn.textContent; btn.textContent = 'Signing in…';
    try {
      var r = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': CSRF },
        body: JSON.stringify({
          username: form.username.value.trim(),
          password: form.password.value,
          next: next
        })
      });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok) { showError(d.error || 'Login failed.'); return; }
      location.href = d.redirect || '/admin/dashboard';
    } catch (err) {
      showError('Network error. Please try again.');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });
})();
