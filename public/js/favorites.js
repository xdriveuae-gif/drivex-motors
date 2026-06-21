/* Favourites — persisted in localStorage. window.DXFav */
(function () {
  'use strict';
  var KEY = 'drivex_favorites';

  function read() {
    try { var a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function write(a) { localStorage.setItem(KEY, JSON.stringify(a)); emit(a.length); }
  function emit(count) {
    document.dispatchEvent(new CustomEvent('favorites:change', { detail: { count: count } }));
  }

  window.DXFav = {
    list: read,
    count: function () { return read().length; },
    has: function (id) { return read().indexOf(Number(id)) !== -1; },
    toggle: function (id) {
      id = Number(id);
      var a = read(), i = a.indexOf(id), added = i === -1;
      if (added) a.push(id); else a.splice(i, 1);
      write(a);
      return added;
    },
    remove: function (id) {
      var a = read(), i = a.indexOf(Number(id));
      if (i !== -1) { a.splice(i, 1); write(a); }
    },
    clear: function () { write([]); }
  };
})();
