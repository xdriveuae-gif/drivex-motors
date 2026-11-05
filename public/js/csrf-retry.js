/* Recovers from an out-of-date security token without bothering the visitor.
   A page keeps the token it was given when it opened. That token stops working
   if the session behind it ends: the tab sat open past the 8-hour limit, or the
   admin logged in or out in another tab. When the server refuses a request for
   that reason, fetch a current token and send the same request once more.
   Loaded before the other scripts, so every form and admin action is covered. */
(function () {
  'use strict';
  var realFetch = window.fetch;
  if (!realFetch) return;
  var HEADER = 'X-CSRF-Token';
  var current = null;

  function isSameSite(url) { return typeof url === 'string' && url.charAt(0) === '/' && url.charAt(1) !== '/'; }

  async function freshToken() {
    var r = await realFetch.call(window, '/api/csrf-token', { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    var d = await r.json();
    return d.token || null;
  }

  window.fetch = async function (url, init) {
    var hasToken = init && init.headers && HEADER in init.headers;
    if (!hasToken || !isSameSite(url)) return realFetch.call(window, url, init);

    if (current) init = Object.assign({}, init, { headers: Object.assign({}, init.headers, { 'X-CSRF-Token': current }) });
    var res = await realFetch.call(window, url, init);
    if (res.status !== 403) return res;

    var body = await res.clone().json().catch(function () { return null; });
    if (!body || body.code !== 'CSRF_INVALID') return res;

    var token = await freshToken().catch(function () { return null; });
    if (!token) return res;
    current = token;
    return realFetch.call(window, url, Object.assign({}, init, { headers: Object.assign({}, init.headers, { 'X-CSRF-Token': token }) }));
  };
})();
