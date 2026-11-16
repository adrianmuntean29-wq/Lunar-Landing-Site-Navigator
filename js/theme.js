/* Light / dark switch for both pages. The pages open dark; a visitor's choice is remembered in this browser
   (localStorage "pol-theme") and applied before the first paint by a short inline script in each page's <head>.
   Charts redraw on their own: each page watches the data-theme attribute. */
(function(){
  'use strict';
  var root = document.documentElement, btn = document.getElementById('themeBtn');
  if (!btn) return;
  var SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg>';
  var MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z"/></svg>';
  function dark(){ return root.getAttribute('data-theme') !== 'light'; }
  function paint(){
    var d = dark();
    btn.innerHTML = (d ? SUN : MOON) + '<span>' + (d ? 'Light' : 'Dark') + '</span>';
    btn.setAttribute('aria-label', d ? 'Switch to the light theme' : 'Switch to the dark theme');
  }
  btn.addEventListener('click', function(){
    var t = dark() ? 'light' : 'dark';
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('pol-theme', t); } catch (e) {}
    paint();
  });
  paint();
})();
