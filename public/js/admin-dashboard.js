/* Admin dashboard — stats, latest listings, messages. */
(function () {
  'use strict';
  var esc = function (v) { return (v === null || v === undefined) ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var aed = function (n) { return 'AED ' + (Number(n) || 0).toLocaleString('en-US'); };
  function when(s) {
    if (!s) return '';
    var d = new Date(String(s).replace(' ', 'T') + 'Z');
    return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

  async function loadStats() {
    try {
      var s = await DXA.api.get('/admin/api/stats');
      set('sTotal', s.totalVehicles); set('sFeatured', s.featured);
      set('sSold', s.sold); set('sMessages', s.messages);
      set('sSubmissions', s.submissions || 0);
      set('sViews', (s.totalViews || 0).toLocaleString('en-US'));
      var unread = document.getElementById('sUnread');
      if (unread) { if (s.unreadMessages > 0) { unread.textContent = s.unreadMessages + ' new'; unread.hidden = false; } else unread.hidden = true; }
      var newSub = document.getElementById('sNewSub');
      if (newSub) { if (s.newSubmissions > 0) { newSub.textContent = s.newSubmissions + ' new'; newSub.hidden = false; } else newSub.hidden = true; }

      var list = document.getElementById('latestList');
      if (!s.latest || !s.latest.length) { list.innerHTML = '<p class="muted">No vehicles yet. <a class="link-btn" href="/admin/vehicles/new">Add one →</a></p>'; return; }
      list.innerHTML = s.latest.map(function (v) {
        var img = v.primary_image || '/images/placeholders/car-a.svg';
        return '<a class="latest-item" href="/admin/vehicles/' + v.id + '/edit">' +
          '<img src="' + esc(img) + '" alt="' + esc(v.title) + '">' +
          '<div class="li-body"><div class="li-title">' + esc(v.title) + '</div>' +
          '<div class="li-meta">' + esc(v.year) + ' · ' + esc(v.make) + (v.is_sold ? ' · Sold' : '') + (v.is_featured ? ' · ★' : '') + '</div></div>' +
          '<span class="li-price">' + aed(v.price) + '</span></a>';
      }).join('');
    } catch (e) { /* handled by DXA (401 redirect) */ }
  }

  async function loadMessages() {
    var box = document.getElementById('messagesList');
    try {
      var res = await DXA.api.get('/admin/api/messages');
      var msgs = res.data || [];
      set('msgCount', msgs.length + ' total');
      if (!msgs.length) { box.innerHTML = '<p class="muted">No messages yet.</p>'; return; }
      box.innerHTML = msgs.map(renderMessage).join('');
      bindMessages(box);
    } catch (e) { box.innerHTML = '<p class="muted">Could not load messages.</p>'; }
  }

  function renderMessage(m) {
    return '<div class="message-item ' + (m.is_read ? '' : 'unread') + '" data-id="' + m.id + '">' +
      '<div class="message-head"><strong>' + esc(m.name) + '</strong><span class="message-meta">' + when(m.created_at) + '</span></div>' +
      '<div class="message-contact"><a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a>' +
        (m.phone ? '<a href="tel:' + esc(m.phone) + '">' + esc(m.phone) + '</a>' : '') + '</div>' +
      (m.subject ? '<div class="message-meta"><strong>Subject:</strong> ' + esc(m.subject) + '</div>' : '') +
      '<p class="message-body">' + esc(m.message) + '</p>' +
      (m.vehicle_title ? '<a class="message-vehicle" href="/vehicle/' + m.vehicle_id + '" target="_blank">↗ ' + esc(m.vehicle_title) + '</a>' : '') +
      '<div class="message-actions">' +
        '<button class="btn btn-outline btn-sm" data-read="' + m.id + '" data-state="' + (m.is_read ? 1 : 0) + '">' + (m.is_read ? 'Mark unread' : 'Mark read') + '</button>' +
        '<button class="btn btn-danger btn-sm" data-del="' + m.id + '">Delete</button>' +
      '</div></div>';
  }

  function bindMessages(box) {
    box.querySelectorAll('[data-read]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.getAttribute('data-read'), cur = b.getAttribute('data-state') === '1';
        try {
          await DXA.api.send('/admin/api/messages/' + id, 'PATCH', { is_read: cur ? 0 : 1 });
          loadMessages(); loadStats();
        } catch (e) { DXA.toast(e.message, 'error'); }
      });
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!(await DXA.confirm('Delete this message permanently?'))) return;
        try {
          await DXA.api.send('/admin/api/messages/' + b.getAttribute('data-del'), 'DELETE');
          DXA.toast('Message deleted', 'success'); loadMessages(); loadStats();
        } catch (e) { DXA.toast(e.message, 'error'); }
      });
    });
  }

  function init() { loadStats(); loadMessages(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
