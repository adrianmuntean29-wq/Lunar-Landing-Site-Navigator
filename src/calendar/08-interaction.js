/* Landing calendar, runs inside startApp() and shares its scope with the other files here (see tools/build_js.py):
   mouse, touch and keys on the 3D map, the map buttons, adding a site by coordinates. */
/* ---------- interaction ---------- */
var tInput = $('#t'), tOut = $('#tOut'), playBtn = $('#play'), playIcon = $('#playIcon');
function setT(t){ state.t = t > DAYS ? 0 : clamp(t, 0, DAYS); tInput.value = state.t.toFixed(2); dirty.light = true; dirty.charts = true; dirty.view = true; }
tInput.addEventListener('input', function(){ setT(parseFloat(tInput.value)); });
playBtn.addEventListener('click', function(){
  state.playing = !state.playing;
  playIcon.setAttribute('d', state.playing ? 'M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z' : 'M4 2.5v11l9-5.5z');
  playBtn.setAttribute('aria-label', state.playing ? 'Pause the simulation' : 'Start the simulation');
  last = performance.now();
});
$('#speed').addEventListener('change', function(e){ state.speed = parseFloat(e.target.value); });
$('#exag').addEventListener('input', function(e){ state.exag = parseFloat(e.target.value); $('#exagOut').textContent = '×' + num(state.exag, 1); dirty.geo = true; dirty.view = true; });
var segBtns = Array.prototype.slice.call(document.querySelectorAll('.seg:not(.mapsize) button'));
Array.prototype.forEach.call(document.querySelectorAll('#mapSize button'), function(b){
  var k = b.getAttribute('data-map');
  b.setAttribute('aria-pressed', String(k === MAPKEY));
  if (k === 'sites' && !REGION){ b.disabled = true; b.title = 'The regional terrain file (data/region_heights.bin) did not load.'; }
  b.addEventListener('click', function(){
    if (k === MAPKEY) return;
    var h = location.hash.replace(/(^#|&)map=[^&]*/, '').replace(/^#?&?/, '');
    location.hash = (h ? h + '&' : '') + 'map=' + k; location.reload();
  });
});
(function(){
  var zb = $('#zonesBtn'); if (!zb) return;
  if (!ZONES.length || !TERR){ zb.parentNode.hidden = true; return; }
  zb.addEventListener('click', function(){
    zonesOn = !zonesOn; zb.setAttribute('aria-pressed', String(zonesOn));
    dirty.view = true; renderLegend();
  });
})();
segBtns.forEach(function(btn){
  btn.addEventListener('click', function(){
    state.mode = parseInt(btn.getAttribute('data-mode'), 10);
    segBtns.forEach(function(o){ o.setAttribute('aria-pressed', o === btn ? 'true' : 'false'); });
    dirty.layer = true; dirty.view = true; renderLegend();
  });
});

var pointers = new Map(), downInfo = null, pinch = null;
function pdist(){ var p = Array.from(pointers.values()); return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1; }
canvas.addEventListener('pointerdown', function(e){
  canvas.focus({preventScroll: true});
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (pointers.size === 1) downInfo = {x: e.clientX, y: e.clientY, t: performance.now(), moved: 0};
  else { downInfo = null; if (pointers.size === 2) pinch = {d: pdist(), dist: cam.dist}; }
});
canvas.addEventListener('pointermove', function(e){
  var p = pointers.get(e.pointerId); if (!p) return;
  var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1){
    cam.yaw -= dx*0.006; cam.pitch = clamp(cam.pitch + dy*0.005, 0.12, 1.45);
    if (downInfo) downInfo.moved += Math.abs(dx) + Math.abs(dy);
  } else if (pointers.size === 2 && pinch){ cam.dist = clamp(pinch.dist*pinch.d/pdist(), DMIN, DMAX); }
  dirty.view = true;
});
function endPointer(e){
  pointers.delete(e.pointerId); downInfo = null; if (pointers.size < 2) pinch = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', function(e){ e.preventDefault(); cam.dist = clamp(cam.dist*Math.exp(e.deltaY*0.0012), DMIN, DMAX); dirty.view = true; }, {passive: false});
canvas.addEventListener('keydown', function(e){
  var used = true;
  if (e.key === 'ArrowLeft') cam.yaw += 0.08; else if (e.key === 'ArrowRight') cam.yaw -= 0.08;
  else if (e.key === 'ArrowUp') cam.pitch = clamp(cam.pitch + 0.06, 0.12, 1.45); else if (e.key === 'ArrowDown') cam.pitch = clamp(cam.pitch - 0.06, 0.12, 1.45);
  else if (e.key === '+' || e.key === '=') cam.dist = clamp(cam.dist*0.9, DMIN, DMAX); else if (e.key === '-') cam.dist = clamp(cam.dist*1.1, DMIN, DMAX);
  else used = false;
  if (used){ e.preventDefault(); dirty.view = true; }
});
/* ---------- add a site by coordinates ---------- */
$('#addsite').addEventListener('submit', function(e){
  e.preventDefault();
  var lat = parseFloat($('#aLat').value), lon = parseFloat($('#aLon').value);
  if (!(lat >= -90 && lat <= -80) || !(lon >= 0 && lon <= 360)) return;
  custom = {id: 'X', name: 'Your site', lat: lat, lon: ((lon % 360) + 360) % 360, note: 'Entered by you'};
  var s = makeSite(custom);
  if (sites.length > SITE_LIST.length) sites[SITE_LIST.length] = s; else sites.push(s);
  select(SITE_LIST.length);
});

