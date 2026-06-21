/* Admin — single submission detail: view, status workflow, notes, delete. */
(function () {
  'use strict';
  var root = document.getElementById('leadDetail');
  if (!root) return;
  var m = location.pathname.match(/\/admin\/leads\/(\d+)/);
  var id = m ? m[1] : null;
  var SHOWROOM = ((document.querySelector('meta[name="showroom-whatsapp"]') || {}).content || '').replace(/[^\d]/g, '');

  var esc = function (v) { return (v === null || v === undefined || v === '') ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var aed = function (n) { return n == null || n === '' ? '—' : 'AED ' + (Number(n) || 0).toLocaleString('en-US'); };
  function when(s) { if (!s) return '—'; var d = new Date(String(s).replace(' ', 'T') + 'Z'); return isNaN(d) ? s : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  var ST_CLASS = { 'New': 'st-new', 'Under Review': 'st-review', 'Contacted': 'st-contacted', 'Offer Sent': 'st-offer', 'Purchased': 'st-purchased', 'Rejected': 'st-rejected' };
  var STATUSES = ['New', 'Under Review', 'Contacted', 'Offer Sent', 'Purchased', 'Rejected'];

  function row(label, value, isHtml) {
    if (value === null || value === undefined || value === '') return '';
    return '<div class="dl-row"><span>' + esc(label) + '</span><strong>' + (isHtml ? value : esc(value)) + '</strong></div>';
  }

  function waLink(sub) {
    if (!SHOWROOM) return '';
    var lines = [
      'New car submission — ' + (sub.submission_number || ('#' + sub.id)),
      sub.year + ' ' + sub.make + ' ' + sub.model + (sub.trim ? ' ' + sub.trim : ''),
      (sub.mileage != null ? 'Mileage: ' + Number(sub.mileage).toLocaleString('en-US') + ' km' : ''),
      (sub.engine_size ? 'Engine: ' + sub.engine_size : ''),
      (sub.fuel_type ? 'Fuel: ' + sub.fuel_type : ''),
      (sub.transmission ? 'Transmission: ' + sub.transmission : ''),
      (sub.color ? 'Colour: ' + sub.color : ''),
      'Asking: ' + (sub.asking_price != null ? 'AED ' + Number(sub.asking_price).toLocaleString('en-US') + (sub.negotiable === 'Yes' ? ' (negotiable)' : '') : '—'),
      '',
      'Customer: ' + sub.full_name,
      'Phone: ' + sub.phone,
      (sub.whatsapp ? 'WhatsApp: ' + sub.whatsapp : ''),
      'Email: ' + sub.email,
      (sub.city ? 'City: ' + sub.city : ''),
      'Photos: ' + ((sub.images || []).length)
    ].filter(Boolean);
    // wa.me links can't attach images — include tappable links to each photo instead.
    var origin = location.origin;
    (sub.images || []).forEach(function (im, i) { lines.push('Photo ' + (i + 1) + ': ' + origin + im.image_path); });
    return 'https://wa.me/' + SHOWROOM + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  async function loadAndRender() {
    if (!id) { root.innerHTML = '<section class="admin-panel"><p class="muted">Invalid submission.</p></section>'; return; }
    var sub;
    try { sub = await DXA.api.get('/admin/api/submissions/' + id); }
    catch (e) { root.innerHTML = '<section class="admin-panel"><p class="muted">Could not load this submission.</p></section>'; return; }

    var photos = (sub.images || []).map(function (im) {
      return '<a class="lead-photo" href="' + esc(im.image_path) + '" target="_blank" rel="noopener"><img src="' + esc(im.image_path) + '" alt=""></a>';
    }).join('') || '<p class="muted">No photos uploaded.</p>';

    var highlights = (sub.highlights || []).map(function (h) { return '<span class="hl-tag">' + esc(h) + '</span>'; }).join(' ');
    var wa = waLink(sub);

    var statusBtns = STATUSES.map(function (s) {
      return '<button class="status-btn ' + ST_CLASS[s] + (s === sub.status ? ' active' : '') + '" data-status="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('');

    root.innerHTML =
      '<div class="lead-head">' +
        '<div><h2>' + esc(sub.make) + ' ' + esc(sub.model) + ' <span class="muted">' + esc(sub.year) + '</span></h2>' +
        '<p class="muted">Ref ' + esc(sub.submission_number || ('#' + sub.id)) + ' · submitted ' + when(sub.created_at) + '</p></div>' +
        '<span class="lead-status ' + (ST_CLASS[sub.status] || 'st-new') + '" id="curStatus">' + esc(sub.status) + '</span>' +
      '</div>' +

      '<div class="lead-grid">' +
        '<section class="admin-panel">' +
          '<div class="panel-head"><h2>Vehicle</h2></div>' +
          row('Make / Model', sub.make + ' ' + sub.model) + row('Year', sub.year) + row('Trim', sub.trim) +
          row('Mileage', sub.mileage != null ? Number(sub.mileage).toLocaleString('en-US') + ' km' : '') +
          row('Engine', sub.engine_size) + row('Fuel', sub.fuel_type) + row('Transmission', sub.transmission) +
          row('Colour', sub.color) + row('VIN', sub.vin) +
        '</section>' +

        '<section class="admin-panel">' +
          '<div class="panel-head"><h2>Customer</h2></div>' +
          row('Name', sub.full_name) +
          row('Phone', '<a href="tel:' + esc(sub.phone) + '">' + esc(sub.phone) + '</a>', true) +
          row('WhatsApp', sub.whatsapp ? '<a href="https://wa.me/' + esc(String(sub.whatsapp).replace(/[^\d]/g, '')) + '" target="_blank" rel="noopener">' + esc(sub.whatsapp) + '</a>' : '', true) +
          row('Email', '<a href="mailto:' + esc(sub.email) + '">' + esc(sub.email) + '</a>', true) +
          row('City', sub.city) +
          (wa ? '<a class="btn btn-gold btn-sm lead-wa" href="' + esc(wa) + '" target="_blank" rel="noopener">Send this lead to showroom WhatsApp</a>' : '') +
        '</section>' +

        '<section class="admin-panel">' +
          '<div class="panel-head"><h2>Condition &amp; Pricing</h2></div>' +
          row('Owners', sub.owners_count) + row('Service history', sub.service_history) +
          row('Accident history', sub.accident_history) + row('Paintwork done', sub.paintwork) +
          row('Asking price', aed(sub.asking_price)) + row('Negotiable', sub.negotiable) +
          (highlights ? row('Highlights', highlights, true) : '') +
          (sub.mechanical_issues ? row('Mechanical issues', sub.mechanical_issues) : '') +
          (sub.additional_notes ? row('Notes', sub.additional_notes) : '') +
        '</section>' +

        '<section class="admin-panel">' +
          '<div class="panel-head"><h2>Workflow</h2></div>' +
          '<p class="muted" style="margin-bottom:10px">Update status</p>' +
          '<div class="status-actions">' + statusBtns + '</div>' +
          '<label class="field-group-label" for="leadNotes">Internal notes</label>' +
          '<textarea id="leadNotes" rows="4" placeholder="Notes for your team (not shown to the customer)">' + esc(sub.internal_notes || '') + '</textarea>' +
          '<button class="btn btn-outline btn-sm" id="saveNotes" style="margin-top:10px">Save notes</button>' +
          '<div class="lead-history">Last updated: ' + when(sub.updated_at) + '</div>' +
          '<button class="btn btn-danger btn-sm" id="deleteLead" style="margin-top:14px">Delete submission</button>' +
        '</section>' +
      '</div>' +

      '<section class="admin-panel">' +
        '<div class="panel-head"><h2>Photos <span class="muted">(' + (sub.images || []).length + ')</span></h2></div>' +
        '<div class="lead-photos">' + photos + '</div>' +
      '</section>';

    bind(sub);
  }

  function bind(sub) {
    root.querySelectorAll('.status-btn').forEach(function (b) {
      b.addEventListener('click', async function () {
        var status = b.getAttribute('data-status');
        if (status === sub.status) return;
        try {
          await DXA.api.send('/admin/api/submissions/' + id, 'PATCH', { status: status });
          sub.status = status;
          root.querySelectorAll('.status-btn').forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          var cur = document.getElementById('curStatus');
          if (cur) { cur.textContent = status; cur.className = 'lead-status ' + (ST_CLASS[status] || 'st-new'); }
          DXA.toast('Status updated to ' + status, 'success');
        } catch (e) { DXA.toast(e.message, 'error'); }
      });
    });

    var saveBtn = document.getElementById('saveNotes');
    if (saveBtn) saveBtn.addEventListener('click', async function () {
      var notes = document.getElementById('leadNotes').value;
      try { await DXA.api.send('/admin/api/submissions/' + id, 'PATCH', { internal_notes: notes }); DXA.toast('Notes saved', 'success'); }
      catch (e) { DXA.toast(e.message, 'error'); }
    });

    var delBtn = document.getElementById('deleteLead');
    if (delBtn) delBtn.addEventListener('click', async function () {
      if (!(await DXA.confirm('Delete this submission and its photos permanently?'))) return;
      try { await DXA.api.send('/admin/api/submissions/' + id, 'DELETE'); DXA.toast('Deleted', 'success'); location.href = '/admin/leads'; }
      catch (e) { DXA.toast(e.message, 'error'); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAndRender);
  else loadAndRender();
})();
