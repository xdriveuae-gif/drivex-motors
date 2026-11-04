/* Admin: Users Settings — list, create, delete, change privilege and password. */
(function () {
  'use strict';
  var esc = function (v) { return (v === null || v === undefined) ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var fmtDate = function (s) {
    var d = new Date(String(s).replace(' ', 'T') + 'Z');
    return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  var tbody = document.getElementById('usersTbody');
  var countEl = document.getElementById('usersCount');
  var notice = document.getElementById('lockedNotice');
  var form = document.getElementById('userForm');
  var dialog = document.getElementById('pwDialog');
  var pwForm = document.getElementById('pwForm');
  var pwNew = document.getElementById('pw-new');
  var pwShow = document.getElementById('pwShow');
  var pwUserId = null;

  async function load() {
    try {
      var res = await DXA.api.get('/admin/api/users');
      render(res.data, res.builtInPasswordLocked);
      document.getElementById('resetNotice').hidden = !res.twoFactorResetOn;
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted ta-center">Failed to load users.</td></tr>';
    }
  }

  function render(users, locked) {
    countEl.textContent = users.length + (users.length === 1 ? ' user' : ' users');
    notice.hidden = !locked;
    tbody.innerHTML = users.map(function (u) {
      var roleLocked = u.isSelf || u.isBuiltIn;
      var pwLocked = u.isBuiltIn && locked;
      var canDelete = !u.isSelf && !u.isBuiltIn;
      return '<tr data-id="' + u.id + '" data-name="' + esc(u.username) + '" data-role="' + esc(u.role) + '">' +
        '<td><strong>' + esc(u.username) + '</strong>' + (u.isSelf ? '<span class="users-you">(you)</span>' : '') + '</td>' +
        '<td><select class="users-role" aria-label="Privilege for ' + esc(u.username) + '"' + (roleLocked ? ' disabled' : '') + '>' +
          '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Admin</option>' +
          '<option value="viewer"' + (u.role === 'viewer' ? ' selected' : '') + '>Viewer</option>' +
        '</select></td>' +
        '<td>' + (u.twoFactor ? '<span class="badge-live">On</span>' : '<span class="muted">' + (u.role === 'admin' ? 'Pending' : 'Off') + '</span>') + '</td>' +
        '<td class="muted">' + esc(fmtDate(u.created_at)) + '</td>' +
        '<td><div class="users-actions">' +
          '<button class="btn btn-outline btn-sm" data-pw' + (pwLocked ? ' disabled' : '') + '>Change Password</button>' +
          (u.twoFactor && !u.isSelf ? '<button class="btn btn-outline btn-sm" data-reset2fa>Reset Two-Factor</button>' : '') +
          (canDelete ? '<button class="btn btn-danger btn-sm" data-remove>Delete</button>' : '') +
        '</div></td></tr>';
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(function (tr) {
      var id = tr.getAttribute('data-id');
      var name = tr.getAttribute('data-name');
      tr.querySelector('.users-role').addEventListener('change', async function () {
        try {
          await DXA.api.send('/admin/api/users/' + id + '/role', 'PATCH', { role: this.value });
          DXA.toast(name + ' is now ' + (this.value === 'admin' ? 'an admin' : 'a viewer'), 'success');
        } catch (e) { DXA.toast(e.message, 'error'); }
        load();
      });
      tr.querySelector('[data-pw]').addEventListener('click', function () { openPw(id, name); });
      var reset = tr.querySelector('[data-reset2fa]');
      if (reset) reset.addEventListener('click', async function () {
        if (!(await DXA.confirm('Reset two-factor login for "' + name + '"? They will be signed out and must set it up again.'))) return;
        try { await DXA.api.send('/admin/api/users/' + id + '/two-factor', 'DELETE'); DXA.toast('Two-factor login reset', 'success'); }
        catch (e) { DXA.toast(e.message, 'error'); }
        load();
      });
      var del = tr.querySelector('[data-remove]');
      if (del) del.addEventListener('click', async function () {
        if (!(await DXA.confirm('Delete the user "' + name + '"? They will be signed out immediately.'))) return;
        try { await DXA.api.send('/admin/api/users/' + id, 'DELETE'); DXA.toast('User deleted', 'success'); }
        catch (e) { DXA.toast(e.message, 'error'); }
        load();
      });
    });
  }

  function openPw(id, name) {
    pwUserId = id;
    document.getElementById('pwUser').textContent = name;
    pwNew.value = ''; pwNew.type = 'password'; pwShow.checked = false;
    dialog.showModal();
    pwNew.focus();
  }

  pwShow.addEventListener('change', function () { pwNew.type = pwShow.checked ? 'text' : 'password'; });
  document.getElementById('pwCancel').addEventListener('click', function () { dialog.close(); });

  pwForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = document.getElementById('pwSave');
    btn.disabled = true;
    try {
      await DXA.api.send('/admin/api/users/' + pwUserId + '/password', 'PATCH', { password: pwNew.value });
      dialog.close();
      DXA.toast('Password changed', 'success');
    } catch (err) { DXA.toast(err.message, 'error'); }
    btn.disabled = false;
    pwNew.value = '';
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = document.getElementById('userCreate');
    btn.disabled = true;
    try {
      await DXA.api.send('/admin/api/users', 'POST', {
        username: document.getElementById('u-name').value.trim(),
        password: document.getElementById('u-pass').value,
        role: document.getElementById('u-role').value
      });
      form.reset();
      DXA.toast('User created', 'success');
      load();
    } catch (err) { DXA.toast(err.message, 'error'); }
    btn.disabled = false;
  });

  load();
})();
