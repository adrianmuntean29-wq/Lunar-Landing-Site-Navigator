/* Landing calendar, runs inside startApp() and shares its scope with the other files here (see tools/build_js.py):
   labels over the 3D map: site pins, Tudor's flat-terrain zones, the Sun and Earth markers. */
/* ---------- overlay labels ---------- */
var labelsEl = $('#labels'), pinEls = [], geoEls = [], sunEl, earthEl;
/* Site pins at the published coordinates, only on real LOLA terrain (none on the demo terrain).
   Sites outside the map block are pinned at the block edge in their direction, with the distance. */
function siteXZ(s){ var rho = 2*R_MOON*Math.tan(Math.PI/4 + s.lat*DEG/2), L = s.lon*DEG; return [rho*Math.sin(L), -rho*Math.cos(L)]; }
function buildPins(){
  pinEls.forEach(function(p){ p.el.remove(); }); pinEls = [];
  if (!TERR) return;
  sites.forEach(function(s, i){
    var el = document.createElement('div'); el.className = 'mk pin';
    el.innerHTML = '<span class="stem"></span><span class="dot"></span><button type="button" class="tag"></button>';
    var b = el.querySelector('.tag'), code = (s.name.match(/\(([^)]+)\)/) || [])[1] || s.name;
    b.addEventListener('click', function(){ select(i); });
    labelsEl.appendChild(el);
    var xz = siteXZ(s);
    pinEls.push({el: el, b: b, x: xz[0], z: xz[1], i: i, label: String.fromCharCode(65 + i) + ' · ' + code});
  });
}
function buildGeo(){
  var rl = function(c){ return 2*R_MOON*Math.tan(c*DEG/2); };
  (MAPKEY === 'pole' ? [[0, 0, 'South Pole'], [0, rl(0.5), '89.5° S']]
    : [[0, 0, 'South Pole']].concat([1, 2, 3, 4, 5].map(function(k){ return [0.8*rl(k), -0.6*rl(k), (90 - k) + '° S']; }))).forEach(function(g){
    var el = document.createElement('div'); el.className = 'mk geo';
    el.innerHTML = '<i></i><span></span>'; el.querySelector('span').textContent = g[2];
    labelsEl.appendChild(el); geoEls.push({el: el, x: g[0], z: g[1]});
  });
  sunEl = document.createElement('div'); sunEl.className = 'mk sky sun'; sunEl.innerHTML = '<i></i><span></span>';
  earthEl = document.createElement('div'); earthEl.className = 'mk sky earth'; earthEl.innerHTML = '<i></i><span></span>';
  labelsEl.appendChild(sunEl); labelsEl.appendChild(earthEl);
}
function place(el, p){ if (!p || p[0] < -60 || p[0] > W + 60 || p[1] < -60 || p[1] > Hh + 60){ el.hidden = true; return; } el.hidden = false; el.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)'; }
/* Tudor's 16 flat, smooth terrain zones (data/zones.json, polar stereographic metres: x = rho sin(lon), y = rho cos(lon);
   this map uses z = -y in km). Drawn as outlines over the terrain; parts outside the map block are left out. */
var ZONES = (window.__zones && window.__zones.zones) || [], zonesOn = ZONES.length > 0, zonesSvg = null;
function drawZones(e){
  if (!zonesSvg){
    zonesSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    zonesSvg.setAttribute('class', 'zones'); zonesSvg.setAttribute('aria-hidden', 'true');
    labelsEl.insertBefore(zonesSvg, labelsEl.firstChild);
  }
  if (!zonesOn || !TERR){ zonesSvg.innerHTML = ''; return; }
  var d = '';
  ZONES.forEach(function(zn){ zn.rings.forEach(function(r){
    var on = false;
    for (var k = 0; k <= r.length; k++){
      var q = r[k % r.length], x = q[0]/1000, z = -q[1]/1000;
      var p = Math.abs(x - CX) <= HALF && Math.abs(z - CZ) <= HALF ? project(x, hAt(x, z)*e, z) : null;
      if (!p){ on = false; continue; }
      d += (on ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); on = true;
    }
  }); });
  zonesSvg.innerHTML = '<path d="' + d + '"/>';
}
function updateLabels(){
  var e = state.exag;
  drawZones(e);
  if (TERR && pinEls.length !== sites.length) buildPins();
  pinEls.forEach(function(p){
    var inside = Math.abs(p.x - CX) <= HALF && Math.abs(p.z - CZ) <= HALF, x = p.x, z = p.z;
    if (!inside){ var k = (HALF - 0.4*SC)/Math.max(Math.abs(p.x - CX), Math.abs(p.z - CZ)); x = CX + (p.x - CX)*k; z = CZ + (p.z - CZ)*k; }
    p.sp = project(x, hAt(x, z)*e, z); place(p.el, p.sp);
    p.el.classList.toggle('sel', p.i === sel); p.el.classList.toggle('out', !inside);
    p.b.textContent = p.label + (inside ? '' : ', ' + Math.round(Math.hypot(p.x, p.z)) + ' km out');
    p.b.setAttribute('aria-label', 'Pick site ' + p.label + (inside ? '' : ', ' + Math.round(Math.hypot(p.x, p.z)) + ' km from the pole, outside this map'));
  });
  /* tags that would overlap on screen: the pin farther back gets a taller stem */
  var shown = pinEls.filter(function(p){ return p.sp && !p.el.hidden; }).sort(function(a, b){ return b.sp[1] - a.sp[1]; }), boxes = [];
  shown.forEach(function(p){
    var wdt = p.b.offsetWidth || 60, lv = 0, H3 = [24, 52, 80, 108, 136];   // five stem heights: 14 sites since the team sites
    for (; lv < 5; lv++){
      var top = p.sp[1] - H3[lv], hit = boxes.some(function(q){ return Math.abs(q.x - p.sp[0]) < (q.w + wdt)/2 + 6 && Math.abs(q.y - top) < 24; });
      if (!hit) break;
    }
    lv = Math.min(lv, 4);
    p.el.classList.toggle('up', lv === 1); p.el.classList.toggle('up2', lv === 2); p.el.classList.toggle('up3', lv === 3); p.el.classList.toggle('up4', lv === 4); boxes.push({x: p.sp[0], y: p.sp[1] - H3[lv], w: wdt});
  });
  geoEls.forEach(function(g){ place(g.el, project(g.x, hAt(g.x, g.z)*e, g.z)); });
  var su = sunAt(state.t), ea = earthAt(state.t), top = HMAXr*e + 1.2*SC, R = MAPKEY === 'pole' ? 27 : 1.35*HALF;
  var st = {sunAz: su.az, sunEl: su.el, sunLit: su.el > 0 ? 1 : 0, earthAz: ea.az, earthEl: ea.el, earthVis: ea.el > 0 ? 1 : 0};
  var ps = project(CX + Math.sin(st.sunAz*DEG)*R, top + st.sunEl*1.4*SC, CZ - Math.cos(st.sunAz*DEG)*R);
  var pe = project(CX + Math.sin(st.earthAz*DEG)*R, top + 2*SC + st.earthEl*0.9*SC, CZ - Math.cos(st.earthAz*DEG)*R);
  [ps, pe].forEach(function(p){ if (p){ p[0] = clamp(p[0], 14, W - 14); p[1] = clamp(p[1], 22, Hh - 64); } });
  place(sunEl, ps); place(earthEl, pe);
  sunEl.classList.toggle('flip', !!ps && ps[0] > W - 130);
  earthEl.classList.toggle('flip', !!pe && pe[0] > W - 130);
  sunEl.classList.toggle('blocked', st.sunLit < 0.5);
  earthEl.classList.toggle('blocked', st.earthVis < 0.5);
  sunEl.querySelector('span').textContent = 'Sun at pole ' + sgn(st.sunEl, 1) + '°';
  earthEl.querySelector('span').textContent = 'Earth at pole ' + sgn(st.earthEl, 1) + '°';
}

