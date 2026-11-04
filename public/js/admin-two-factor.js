/* Admin: set up and manage the authenticator app for the signed-in user. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var panels = ['tfLoading', 'tfOff', 'tfSetup', 'tfCodes', 'tfOn'];
  var status = null;

  function show(id) { panels.forEach(function (p) { $(p).hidden = p !== id; }); }

  async function load() {
    try {
      status = await DXA.api.get('/admin/api/two-factor');
    } catch (e) { DXA.toast(e.message, 'error'); return; }
    $('tfRequired').hidden = !(status.required && !status.enabled);
    if (status.enabled) {
      $('tfBackupLeft').textContent = status.backupLeft + ' backup codes left.';
      $('tfDisable').textContent = status.required ? 'Replace Authenticator' : 'Turn Off';
      $('tfManageCode').value = '';
      show('tfOn');
    } else {
      show('tfOff');
    }
  }

  function showCodes(codes) {
    $('tfRequired').hidden = true;
    $('tfCodeList').innerHTML = '';
    codes.forEach(function (c) {
      var li = document.createElement('li');
      li.textContent = c;
      $('tfCodeList').appendChild(li);
    });
    $('tfCodes').dataset.codes = codes.join('\n');
    show('tfCodes');
  }

  $('tfStart').addEventListener('click', async function () {
    try {
      var d = await DXA.api.send('/admin/api/two-factor/setup', 'POST', {});
      $('tfQr').src = d.qr;
      $('tfSecret').textContent = d.secret.match(/.{1,4}/g).join(' ');
      $('tfConfirmCode').value = '';
      show('tfSetup');
      $('tfConfirmCode').focus();
    } catch (e) { DXA.toast(e.message, 'error'); }
  });

  $('tfConfirmForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = $('tfConfirm');
    btn.disabled = true;
    try {
      var d = await DXA.api.send('/admin/api/two-factor/confirm', 'POST', { code: $('tfConfirmCode').value.trim() });
      DXA.toast('Authenticator turned on', 'success');
      showCodes(d.backupCodes);
    } catch (err) { DXA.toast(err.message, 'error'); }
    btn.disabled = false;
  });

  $('tfCopy').addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText($('tfCodes').dataset.codes);
      DXA.toast('Codes copied', 'success');
    } catch (e) { DXA.toast('Could not copy. Please write them down.', 'error'); }
  });

  $('tfDone').addEventListener('click', function () {
    delete $('tfCodes').dataset.codes;
    location.href = '/admin/dashboard';
  });

  $('tfManageForm').addEventListener('submit', function (e) { e.preventDefault(); });

  $('tfNewCodes').addEventListener('click', async function () {
    try {
      var d = await DXA.api.send('/admin/api/two-factor/backup-codes', 'POST', { code: $('tfManageCode').value.trim() });
      showCodes(d.backupCodes);
    } catch (e) { DXA.toast(e.message, 'error'); }
  });

  $('tfDisable').addEventListener('click', async function () {
    var msg = status.required
      ? 'Remove this authenticator and set up a new one now?'
      : 'Turn off the authenticator for your account?';
    if (!(await DXA.confirm(msg))) return;
    try {
      await DXA.api.send('/admin/api/two-factor/disable', 'POST', { code: $('tfManageCode').value.trim() });
      DXA.toast('Authenticator removed', 'success');
      load();
    } catch (e) { DXA.toast(e.message, 'error'); }
  });

  load();
})();
