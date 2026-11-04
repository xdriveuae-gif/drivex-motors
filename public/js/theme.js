/* Theme + language bootstrap. Loaded in <head> WITHOUT defer so the right
   theme/direction is on <html> before first paint (no white flash, no LTR flash).
   Preferences live in localStorage ("dx-theme": light|dark, "dx-lang": en|ar).
   With no saved choice the site is white (light); dark only if the visitor taps the toggle. */
(function () {
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  var theme = get('dx-theme');
  if (theme !== 'light' && theme !== 'dark') theme = 'light'; // always white by default, even if the phone is in dark mode
  var lang = new URLSearchParams(location.search).get('lang');
  if (lang === 'ar' || lang === 'en') set('dx-lang', lang); else lang = get('dx-lang');
  if (lang !== 'ar') lang = 'en';

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0e1014' : '#ffffff');
  }
  applyTheme(theme);
  if (lang === 'ar') {
    root.setAttribute('lang', 'ar');
    root.setAttribute('dir', 'rtl');
    root.classList.add('i18n-pending'); // removed by i18n.js after the first translation pass
    setTimeout(function () { root.classList.remove('i18n-pending'); }, 1500); // safety net
  }

  window.DXPrefs = {
    theme: function () { return root.getAttribute('data-theme'); },
    lang: function () { return root.getAttribute('lang') === 'ar' ? 'ar' : 'en'; },
    toggleTheme: function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      set('dx-theme', next); applyTheme(next); return next;
    },
    setLang: function (l) { set('dx-lang', l); },
    applyTheme: applyTheme
  };

  document.addEventListener('DOMContentLoaded', function () {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#0e1014' : '#ffffff');
    // Phones: show the theme + language buttons in the header bar next to the menu button.
    var tools = document.querySelector('.nav-tools');
    var nav = document.getElementById('mainNav');
    var burger = document.getElementById('navToggle');
    if (tools && nav && burger && window.matchMedia) {
      var mq = window.matchMedia('(max-width: 860px)');
      var place = function () {
        if (mq.matches) burger.parentNode.insertBefore(tools, burger);
        else nav.insertBefore(tools, nav.querySelector('.nav-cta'));
      };
      place();
      if (mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);
    }
    var tb = document.getElementById('themeToggle');
    if (tb) {
      var label = function () {
        var dark = root.getAttribute('data-theme') === 'dark';
        tb.setAttribute('aria-pressed', dark ? 'true' : 'false');
        tb.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        tb.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
        if (window.DXi18n) window.DXi18n.refresh();
      };
      label();
      tb.addEventListener('click', function () { window.DXPrefs.toggleTheme(); label(); });
    }
  });
})();
