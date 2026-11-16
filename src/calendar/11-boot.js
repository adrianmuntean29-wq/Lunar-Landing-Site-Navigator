/* Landing calendar, global, after the app: loads the data files (Sun and Earth table, sites, Tudor's zones, terrain
   heights), then calls startApp(). */

/* ---------- real terrain for the 3D view: data/heights.bin from the engine (LOLA, 240 m, +/-60 km, Float32, row 0 = +y) ----------
   and data/region_heights.bin (LOLA, 640 m, x -108..219 km, y -101..226 km, Int16 metres, row 0 = +y, pipeline/make_region_heights.py) */
var LOLA = null, REGION = null;
function b64bytes(s){ var b = atob(s.trim()), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; }
function loadRegion(){
  var meta = {nx: 511, ny: 511, px: 640, xmin: -108160, ymax: 225920}, n = meta.nx*meta.ny;
  function take(ab){ if (ab.byteLength === n*2){ var s = new Int16Array(ab), h = new Float32Array(n); for (var i = 0; i < n; i++) h[i] = s[i]; REGION = {h: h, m: meta}; } }
  var el = document.getElementById('data-region');
  if (el){ try { take(b64bytes(el.textContent)); } catch (err) {} return Promise.resolve(); }
  return fetch('data/region_heights.bin').then(function(r){ if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(take).catch(function(){});
}
function loadHeights(){
  return Promise.all([loadPole(), loadRegion()]);
}
function loadPole(){
  var meta = {nx: 500, ny: 500, px: 240, xmin: -60000, ymax: 60000};
  var el = document.getElementById('data-heights');
  if (el){
    try { var b = atob(el.textContent.trim()), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); LOLA = {h: new Float32Array(u.buffer), m: meta}; } catch (err) {}
    return Promise.resolve();
  }
  return fetch('data/heights.bin').then(function(r){ if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(function(ab){ if (ab.byteLength === meta.nx*meta.ny*4) LOLA = {h: new Float32Array(ab), m: meta}; }).catch(function(){});
}
function terrainWording(){
  var real = (/(^|[#&])map=pole(&|$)/.test(location.hash) || !REGION) ? LOLA : REGION;
  document.getElementById('terrainBadge').textContent = 'Sun and Earth: real positions (JPL Horizons). 3D terrain: ' + (real ? 'real LOLA heights (NASA PGDA 90, ' + (real === LOLA ? '240 m' : '640 m') + ').' : 'generated demo (heights file not loaded).');
  document.getElementById('terrainCaption').textContent = 'Drag to rotate, pinch or scroll to zoom. The 3D view is lit by the real Sun as seen from the pole, on ' + (LOLA || REGION ? 'real LOLA terrain. Click a pin to pick that site.' : 'demo terrain.');
}
/* ---------- boot: load the ephemeris (required) and terrain masks (optional) ---------- */
fetch('data/subpoints.json').then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); }).then(function(d){
  EPH = d;
  return fetch('data/sites.json').then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}).then(function(sj){
  // Agreed format (vault log 2026-11-14-1245): per site "masks" keyed by mast height in m, 360 values each.
  if (sj && sj.sites){
    window.__siteData = {};
    window.__sitesMeta = {generated_utc: sj.generated_utc || sj.generated, versions: sj.versions, dem: sj.dem};
    sj.sites.forEach(function(o){
      if (!o.id || !o.masks) return;
      var ok = Object.keys(o.masks).every(function(k){ return o.masks[k] && o.masks[k].length === 360; });
      if (ok) window.__siteData[o.id] = o;
    });
  }
  // Tudor's flat, smooth terrain zones (optional file; missing = no layer, no error)
  return fetch('data/zones.json').then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }).then(function(zj){
    window.__zones = zj;
    return loadHeights();
  }).then(function(){ terrainWording(); startApp(); });
}).catch(function(err){
  document.getElementById('status').textContent = 'Could not load data/subpoints.json (' + err.message + '). Open the page through a web server, not as a local file.';
});
