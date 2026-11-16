/* Mission view, global, after the app: loads the two data files, then calls __boot(). */
(function(){
  if (document.getElementById('data-subpoints')){ __boot(); return; }
  function get(u){ return fetch(u).then(function(r){ if (!r.ok) throw new Error(u + ': HTTP ' + r.status); return r.text(); }); }
  Promise.all([get('data/subpoints.json'), get('data/sites.json')]).then(function(t){
    [['data-subpoints', t[0]], ['data-sites', t[1]]].forEach(function(x){ var e = document.createElement('script'); e.type = 'application/json'; e.id = x[0]; e.textContent = x[1]; document.head.appendChild(e); });
    __boot();
  }).catch(function(err){
    var p = document.createElement('p'); p.className = 'fromcal';
    p.textContent = 'Could not load data/subpoints.json and data/sites.json (' + err.message + '). Open the page through a web server (for example python -m http.server), not as a local file. Showing the simplified model with flat horizons.';
    document.querySelector('.app').insertBefore(p, document.querySelector('.app').children[1]);
    __boot();
  });
})();
