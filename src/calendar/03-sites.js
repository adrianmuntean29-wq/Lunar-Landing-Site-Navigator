/* Landing calendar, runs inside startApp() and shares its scope with the other files here (see tools/build_js.py):
   planner state, the sites and their LOLA horizon masks, hourly Sun and Earth series, the landing-day rule and its
   test hook. */
/* ---------- state ---------- */
var today = new Date(); today = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
var state = {jd0: jdFromDate(today), t: 0, playing: false, speed: 3, exag: 2.5, mode: 0, mast: '2'};

/* ---------- candidate sites (real coordinates, MOON_ME, east longitude) ----------
   Horizon masks come from the Python LOLA engine (data/sites.json): per site and mast height,
   360 values, bin k = true azimuth [k, k+1) deg clockwise from north, looked up between bin centres.
   Until that file exists, each site uses a flat 0 deg horizon and says so.
   Rules (same as the engine): Sun "up" = disc centre above the horizon; sunlight % = average visible
   fraction of the disc; Earth visible = any part of its 0.95 deg disc above the horizon. */
var SITE_LIST = [
  {id: 'A', name: 'Connecting Ridge (C1)', lat: -89.4505, lon: 222.84, note: 'Gläser et al. 2018, site C1', studied: true},
  {id: 'B', name: 'Shackleton rim (S)', lat: -89.7849, lon: 203.97, note: 'Gläser et al. 2018, site S', studied: true},
  {id: 'C', name: 'de Gerlache rim (GR1)', lat: -88.6952, lon: 291.7154, note: 'De Rosa et al. 2012, GR1', studied: true},
  {id: 'D', name: 'Malapert massif (MP1)', lat: -85.9756, lon: 357.8876, note: 'De Rosa et al. 2012, MP1', studied: true}
];
var SITEDATA = window.__siteData || null;   // {id: {masks: {"0": [...], "2": [...], "10": [...]}, err_m, effres_m, psr_km, ...}}
/* every other site in data/sites.json (ten since the evening of 14 Nov: the best-lit point in six NASA site boxes, and the IM-2 target) */
if (SITEDATA) Object.keys(SITEDATA).sort().forEach(function(id){
  if (SITE_LIST.some(function(s){ return s.id === id; })) return;
  var o = SITEDATA[id], code = (o.name.match(/\(([^)]+)\)/) || [])[1], box = /site box/.test(o.kind || ''), hist = /^historic/.test(o.kind || '');
  var team = /team/.test(o.kind || ''), zn = (o.name.match(/zone (\d+)/) || [])[1];
  SITE_LIST.push({id: id, name: o.name, lat: o.lat, lon: o.lon_e, studied: false,
    note: box ? 'Best-lit point in NASA site box ' + code + ' (our engine, 2 m mast, 2027–2031)' : hist ? 'IM-2 Athena landing target (LROC), for comparison'
      : team ? (zn ? 'Best-lit flat point in Tudor\'s terrain zone ' + zn + ' (our engine, 2 m mast, 2027–2031)' : 'Team proposed site, inside Tudor\'s terrain zone 1')
      : (o.source || '')});
});
if (SITEDATA) $('#horizonNote').textContent = 'Horizon: LOLA terrain masks';
var sites = [];
function maskFor(id){
  var d = SITEDATA && SITEDATA[id]; if (!d || !d.masks) return null;
  return d.masks[state.mast] || null;
}
function makeSite(o){
  var s = {id: o.id, name: o.name, lat: o.lat, lon: o.lon, note: o.note, studied: !!o.studied, meta: (SITEDATA && SITEDATA[o.id]) || null};
  var m = maskFor(o.id);
  s.flat = !m; s.prof = m ? Float64Array.from(m) : new Float64Array(360);   // full precision, as the engine
  var lo = 1e9, hi = -1e9; for (var a = 0; a < 360; a++){ if (s.prof[a] < lo) lo = s.prof[a]; if (s.prof[a] > hi) hi = s.prof[a]; }
  s.pmin = lo; s.pmax = hi;
  computeSite(s);
  return s;
}
/* One hourly series over the whole span: what the calendar and the ranking read. */
function computeSite(s){
  var H = DAYS*24, hs = new Float32Array(H), he = new Uint8Array(H), hel = new Float32Array(H);
  var daySun = new Float32Array(DAYS), dayEarth = new Float32Array(DAYS), ps = [], pe = [];
  var sumS = 0, sumE = 0, sumB = 0, runs = [], runStart = -1;
  for (var h = 0; h < H; h++){
    var t = h/24, st = siteState(s, t);   // whole hours from 00:00 UTC, as the engine
    if (h % 6 === 0 && h < 365*24){ ps.push(st.sunAz, st.sunEl); pe.push(st.earthAz, st.earthEl); }   // first-year path for the chart
    var lit = st.sunLit, ev = st.earthVis > 0 ? 1 : 0;
    hs[h] = lit; he[h] = ev; hel[h] = st.sunEl - st.sunHz;
    sumS += lit; sumE += ev; if (lit >= 0.5 && ev) sumB += 1;
    if (lit < 0.5){ if (runStart < 0) runStart = h; } else if (runStart >= 0){ runs.push(runStart, h); runStart = -1; }
    var d = Math.floor(h/24); daySun[d] += lit/24; dayEarth[d] += ev/24;
  }
  if (runStart >= 0) runs.push(runStart, H);
  // prefix sums so any mission window is O(1) for sun % and Earth %
  var cs = new Float64Array(H + 1), ce = new Float64Array(H + 1);
  for (h = 0; h < H; h++){ cs[h + 1] = cs[h] + hs[h]; ce[h + 1] = ce[h] + he[h]; }
  s.hSun = hs; s.hEarth = he; s.hSunEl = hel; s.cs = cs; s.ce = ce; s.darkRuns = runs;
  s.daySun = daySun; s.dayEarth = dayEarth; s.pathSun = ps; s.pathEarth = pe;
  var longest = 0, clipped = false;
  for (var r = 0; r < runs.length; r += 2){ var len = runs[r + 1] - runs[r]; if (len > longest){ longest = len; clipped = runs[r] === 0 || runs[r + 1] === H; } }
  s.pSun = sumS/H; s.pEarth = sumE/H; s.pBoth = sumB/H; s.night = longest/24; s.nightClipped = clipped;
}
function profAt(s, az){ return Sky.horizon(s.prof, az); }
function siteState(s, t){
  var ep = ephAt(state.jd0 + t), su = azel(s.lat, s.lon, ep.sun, true), ea = azel(s.lat, s.lon, ep.earth);
  var sHz = profAt(s, su.az), eHz = profAt(s, ea.az);
  return {sunAz: su.az, sunEl: su.el, sunHz: sHz, sunLit: Sky.sunFrac(su.el - sHz),   /* chord area of the visible disc, as the engine */
          earthAz: ea.az, earthEl: ea.el, earthHz: eHz, earthVis: clamp((ea.el - eHz + EARTH_R)/(2*EARTH_R), 0, 1)};
}
/* Time until the Sun centre (or any part of Earth) crosses the terrain horizon, up to 60 days ahead:
   1 h steps, then 12 bisections. Returns {up, hours}; hours is null when nothing changes. */
function nextChange(s, t, body){
  var on = function(tt){ var st = siteState(s, tt); return body === 'sun' ? st.sunLit >= 0.5 : st.earthVis > 0; };
  var now = on(t), step = 1/24, a = t, b = null;
  for (var k = 1; k <= 60*24; k++){ var tt = t + k*step; if (on(tt) !== now){ b = tt; break; } a = tt; }
  if (b === null) return {up: now, hours: null};
  for (var it = 0; it < 12; it++){ var mid = (a + b)/2; if (on(mid) === now) a = mid; else b = mid; }
  return {up: now, hours: (b - t)*24};
}

/* ---------- landing-window evaluation ----------
   For a landing at 00:00 UTC on day d and a mission of L days: sunlight %, Earth contact %,
   longest night (hours; ">=" when the dark spell runs past the mission window) and the Sun's height
   above the terrain horizon at touchdown. Each limit that fails is listed, in a fixed order. */
var LIM = {len: 13, sun: 70, earth: 25, night: 48, td: 0, relay: false};
function evalWindow(s, d){
  var h0 = d*24, h1 = h0 + LIM.len*24, H = s.hSun.length;
  if (h1 > H) return null;
  var sun = (s.cs[h1] - s.cs[h0])/(h1 - h0)*100, earth = (s.ce[h1] - s.ce[h0])/(h1 - h0)*100;
  var night = 0, clipped = false, runs = s.darkRuns;
  for (var r = 0; r < runs.length; r += 2){
    var a = runs[r], b = runs[r + 1]; if (b <= h0) continue; if (a >= h1) break;
    var len = Math.min(b, h1) - Math.max(a, h0);
    if (len > night){ night = len; clipped = a < h0 || b > h1; }
  }
  var td = s.hSunEl[h0], fail = [];
  if (sun < LIM.sun) fail.push('sun');
  if (!LIM.relay && earth < LIM.earth) fail.push('earth');
  if (night > LIM.night) fail.push('night');
  if (td < LIM.td) fail.push('td');
  return {d: d, sun: sun, earth: earth, night: night, clipped: clipped, td: td, fail: fail};
}
function evalSite(s){
  var out = [], n = DAYS - LIM.len + 1;
  for (var d = 0; d < n; d++) out.push(evalWindow(s, d));
  return out;
}

/* Test hook (pipeline/validation/pages_vs_engine.py): the calendar's own verdicts for one engine site, mast height and
   set of limits, over nDays landings from an ISO start date. Restores the planner state afterwards. */
window.__planner = {
  evaluate: function(id, mastM, lim, startIso, nDays, withSeries){
    var keep = {jd0: state.jd0, mast: state.mast, days: DAYS, lim: Object.assign({}, LIM)};
    try {
      state.jd0 = jdFromDate(new Date(startIso + 'T00:00:00Z')); state.mast = String(mastM);
      Object.assign(LIM, lim); DAYS = nDays + LIM.len;
      var o = SITE_LIST.filter(function(x){ return x.id === id; })[0]; if (!o) return null;
      var s = makeSite(o), out = [];
      for (var d = 0; d < nDays; d++){ var w = evalWindow(s, d); out.push(w && {pass: !w.fail.length, fails: w.fail, sun: w.sun, earth: w.earth, night: w.night, td: w.td}); }
      if (withSeries) return {days: out, sun: Array.from(s.hSun), earth: Array.from(s.hEarth), sunAlt: Array.from(s.hSunEl)};
      return out;
    } finally { state.jd0 = keep.jd0; state.mast = keep.mast; DAYS = keep.days; Object.assign(LIM, keep.lim); }
  }
};
function buildSites(){ sites = SITE_LIST.map(makeSite); if (custom) sites.push(makeSite(custom)); }
var custom = null;
buildSites();
var sel = 0;

var cam = {yaw: 0.55, pitch: 0.58, dist: 66*SC};
var DMIN = MAPKEY === 'pole' ? 24 : 20, DMAX = 150*SC;
var dirty = {geo: true, light: true, layer: true, view: true, charts: true, sites: true};

