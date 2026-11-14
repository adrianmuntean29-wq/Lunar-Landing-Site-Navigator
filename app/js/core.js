/* core.js: the shared contract. OWNER: coordinator (FRONTEND CODE). Other chats: read, never edit.
   Need something new here? Message the coordinator; it is added once, for everyone.

   What lives here and nowhere else:
   - data loading (sites.json, psr.json, subpoints.json)
   - the maths checked against the engine (0 of 1,460 landing days disagree): ephemeris, parallax, horizon lookup,
     chord-area Sun fraction, Earth "any part of the disc", landing-window rules
   - the shared state and the change events

   How areas talk:   App.set({...})  to change state;   App.on((keys, source) => ...)  to react.
   Never call another area's functions and never touch another area's DOM. */
window.App = (function(){
  'use strict';
  const R = 1737.4, D2R = Math.PI/180, DATA = 'data/';
  let EPH = null;

  /* ---------- ephemeris: Moon-centred Sun/Earth vectors (JPL Horizons table, 6 h, cubic interpolation) ---------- */
  function ephAt(jd){
    const f = (jd - EPH.jd0)/(EPH.step_hours/24), i = Math.max(1, Math.min(EPH.n - 3, Math.floor(f))), u = f - i;
    const w = [-u*(u - 1)*(u - 2)/6, (u + 1)*(u - 1)*(u - 2)/2, -(u + 1)*u*(u - 2)/2, (u + 1)*u*(u - 1)/6], e = [0, 0, 0], s = [0, 0, 0];
    for (let k = 0; k < 4; k++){ const r = (i - 1 + k)*3; for (let c = 0; c < 3; c++){ e[c] += w[k]*EPH.earth_km[r + c]; s[c] += w[k]*EPH.sun_1000km[r + c]*1000; } }
    return {earth: e, sun: s};
  }
  /* azimuth (clockwise from north) and elevation of vector v seen from a site; subtracting the site position = parallax */
  function azel(lat, lon, v){
    const la = lat*D2R, lo = lon*D2R, cla = Math.cos(la), sla = Math.sin(la), clo = Math.cos(lo), slo = Math.sin(lo);
    const dx = v[0] - R*cla*clo, dy = v[1] - R*cla*slo, dz = v[2] - R*sla;
    const up = dx*cla*clo + dy*cla*slo + dz*sla, east = -dx*slo + dy*clo, north = -dx*sla*clo - dy*sla*slo + dz*cla;
    return {az: (Math.atan2(east, north)/D2R + 360) % 360, el: Math.asin(up/Math.hypot(dx, dy, dz))/D2R};
  }
  const jd = d => d.getTime()/86400000 + 2440587.5;
  const date = j => new Date((j - 2440587.5)*86400000);

  /* ---------- horizon + visibility rules (same as the engine) ---------- */
  function profAt(m, az){ const a = ((az - 0.5) % 360 + 360) % 360, i = Math.floor(a), f = a - i; return m[i % 360]*(1 - f) + m[(i + 1) % 360]*f; }   // bin k centred on k + 0.5
  function sunFraction(el, hz){ const u = Math.max(-1, Math.min(1, (hz - el)/0.2666)); return (Math.acos(u) - u*Math.sqrt(1 - u*u))/Math.PI; }   // chord across a uniform disc
  const mask = site => site.masks[state.mast];
  function stateAt(site, j){
    const p = ephAt(j), su = azel(site.lat, site.lon, p.sun), ea = azel(site.lat, site.lon, p.earth), m = mask(site);
    const sunHz = profAt(m, su.az), earthHz = profAt(m, ea.az);
    return {su, ea, sunHz, earthHz, sunLit: sunFraction(su.el, sunHz), earthVis: ea.el - earthHz + 0.95 > 0};
  }
  /* hours until the Sun centre / any part of Earth crosses the horizon, searching 60 days; {now, h|null} */
  function next(site, j, body){
    const on = t => body === 'sun' ? stateAt(site, t).sunLit >= 0.5 : stateAt(site, t).earthVis;
    const now = on(j); for (let k = 1; k <= 60*24; k++) if (on(j + k/24) !== now) return {now, h: k}; return {now, h: null};
  }
  /* one landing per day at 00:00 UTC; fail order sun, earth, night (same as the engine's windows.py) */
  function windows(ser, days, lim){
    const out = [];
    for (let d = 0; d + lim.len <= days; d++){
      const h0 = d*24, h1 = h0 + lim.len*24; let s = 0, e = 0, run = 0, night = 0;
      for (let h = h0; h < h1; h++){ s += ser.sun[h]; e += ser.earth[h]; if (ser.sun[h] < 0.5){ run++; if (run > night) night = run; } else run = 0; }
      s = s/(h1 - h0)*100; e = e/(h1 - h0)*100;
      const fail = []; if (s < lim.sun) fail.push('sun'); if (!lim.relay && e < lim.earth) fail.push('earth'); if (night > lim.night) fail.push('night');
      out.push({d, sun: s, earth: e, night, fail});
    }
    return out;
  }

  /* Moon phase and Earth-Moon distance at jd (Orbit view numbers; asked by the Moon sim chat so scene + panel share one source) */
  function moonInfo(j){
    const p = ephAt(j), E = p.earth, S = p.sun;
    const a = Math.atan2(-E[1], -E[0]) - Math.atan2(S[1], S[0]) + Math.PI;   // Earth->Moon line vs Earth->Sun line + 180 deg (179.96 deg at the 2027-08-02 eclipse)
    const lit = (1 + Math.cos(a))/2, waxing = Math.sin(a) < 0;               // share of the Earth-facing side in sunlight
    const phase = lit < 0.03 ? 'New Moon' : lit > 0.97 ? 'Full Moon' : Math.abs(lit - 0.5) < 0.06 ? (waxing ? 'First quarter' : 'Last quarter') : (waxing ? 'Waxing ' : 'Waning ') + (lit < 0.5 ? 'crescent' : 'gibbous');
    let lo = null, hi = null;   // closest / farthest Earth-Moon distance within +/-15 days, 6 h steps
    for (let d = -15; d <= 15; d += 0.25){ const q = ephAt(j + d).earth, r = Math.hypot(q[0], q[1], q[2]); if (!lo || r < lo.km) lo = {jd: j + d, km: r}; if (!hi || r > hi.km) hi = {jd: j + d, km: r}; }
    return {phase, lit, waxing, earthKm: Math.hypot(E[0], E[1], E[2]), sunKm: Math.hypot(S[0], S[1], S[2]), closest: lo, farthest: hi};
  }

  /* ---------- shared state ---------- */
  const state = {
    jd0: jd(new Date(Date.UTC(2027, 0, 1))), days: 365,      // first landing date, span
    t: 0, playing: false, speed: 1,                           // time since jd0 in days
    site: 0, mast: '2', selDay: -1, psr: 0,                   // selected site, mast height, chosen landing day, PSR filter km (0 = off)
    lim: {len: 13, sun: 70, earth: 50, night: 48, relay: false},
    panelOpen: true, drawerOpen: true,
    view: 'system',   // scene view: 'system' (Orbit) | 'globe' (Moon) | 'region' (Landing Site) | 'ground' (Ground Level); scene sets it, panel follows
    // other-missions layer (missions.js): on/off, caution radius for large landers (km, OUR assumption, Eren 2026-11-14), show Chang'e rows.
    // Patch with a NEW object: App.set({missions: {...App.state.missions, caution: 10}})
    missions: {on: true, caution: 5, cn: true},
    // custom landing spot (App.addSpot): null, or {lat, lon, label, n}. A change of 'spot' means App.sites changed: rebuild per-site lists/pins.
    spot: null
  };
  const PRESETS = {robotic: {len: 13, sun: 70, earth: 50, night: 48}, crew: {len: 6, sun: 95, earth: 50, night: 0}};   // example values, not NASA's
  const listeners = [];
  let sites = [], ser = [], sj = null, psr = null, eph = null, cache = {};

  function seriesOf(site){
    const H = (state.days + 61)*24;   // +61 days: missions may end after the period (porkchop goes to 60 days)
    const sun = new Float32Array(H), earth = new Uint8Array(H);
    for (let h = 0; h < H; h++){ const x = stateAt(site, state.jd0 + h/24); sun[h] = x.sunLit; earth[h] = x.earthVis ? 1 : 0; }
    return {sun, earth};
  }
  function buildSeries(){ ser = sites.map(seriesOf); cache = {}; }
  function buildSeriesFor(site){ ser[site.i] = seriesOf(site); }
  function set(patch, source){
    const keys = new Set();
    for (const k in patch){
      if (k === 'lim'){ for (const q in patch.lim) if (state.lim[q] !== patch.lim[q]){ state.lim[q] = patch.lim[q]; keys.add('lim'); keys.add('lim.' + q); } }
      else if (state[k] !== patch[k]){ state[k] = patch[k]; keys.add(k); }
    }
    if (!keys.size) return;
    if (keys.has('jd0') || keys.has('days') || keys.has('mast')) buildSeries();
    if (keys.has('lim')) cache = {};
    if (keys.has('days')) state.t = Math.min(state.t, state.days - 0.01);
    listeners.forEach(fn => { try { fn(keys, source || ''); } catch (err) { console.error(err); } });
  }
  function on(fn){ listeners.push(fn); }

  /* landing windows for site i under the current limits (cached), or under a custom limits object */
  function wins(i, lim){
    if (lim) return windows(ser[i], state.days + (lim.len > state.lim.len ? 0 : 0), lim);
    const k = 'w' + i; if (!cache[k]) cache[k] = windows(ser[i], state.days, state.lim); return cache[k];
  }
  /* windows for any mission length, for missions that may run past the period (porkchop) */
  function winsLong(i, len){ const k = 'L' + i + '/' + len; if (!cache[k]) cache[k] = windows(ser[i], Math.floor(ser[i].sun.length/24), Object.assign({}, state.lim, {len})); return cache[k]; }

  /* ---------- custom landing spot: approximate horizon from the engine's coarse grids ----------
     Same method as the engine's pipeline/horizon.py (ported from integration-sandbox/js/lunar-data.js, engine session):
     360 bins, max of 4 rays per bin, exact spherical elevation, automatic stop at the tallest DEM point (dem_max_m).
     Terrain: heights.bin (240 m, +/-60 km) where the ray is inside it, else cap_heights.bin (640 m, +/-304 km).
     MEASURED by the engine at the 4 named sites: up to ~20 points off in sun % (Shackleton 65 vs exact 84). Always label it. */
  const RM = 1737400, MAX_SPOT_KM = 290;
  let grids = null;
  function makeGrid(m, z){
    const px = m.pixel_m, nx = m.nx, ny = m.ny, x0 = m.x_min, y1 = m.y_max, xMax = x0 + nx*px, yMin = y1 - ny*px;
    return {meta: m, pixel: px,
      sample(x, y){ let c = (x - x0)/px - 0.5, r = (y1 - y)/px - 0.5; c = c < 0 ? 0 : c > nx - 1 ? nx - 1 : c; r = r < 0 ? 0 : r > ny - 1 ? ny - 1 : r;
        const i = Math.min(nx - 2, Math.floor(c)), j = Math.min(ny - 2, Math.floor(r)), u = c - i, w = r - j, k = j*nx + i;
        return (z[k]*(1 - u) + z[k + 1]*u)*(1 - w) + (z[k + nx]*(1 - u) + z[k + nx + 1]*u)*w; },
      inside(x, y, mg = 1){ const d = mg*px; return x >= x0 + d && x <= xMax - d && y >= yMin + d && y <= y1 - d; }};
  }
  async function loadGrids(){
    if (!grids) grids = (async () => {
      const g = async (m, b) => { const [meta, buf] = await Promise.all([fetch(DATA + m).then(r => r.json()), fetch(DATA + b).then(r => r.arrayBuffer())]); return makeGrid(meta, new Float32Array(buf)); };
      const [far, near] = await Promise.all([g('cap_meta.json', 'cap_heights.bin'), g('terrain_meta.json', 'heights.bin')]);
      return {far, near};
    })();
    return grids;
  }
  const llXY = (lat, lon) => { const rho = 2*RM*Math.tan(Math.PI/4 + lat*D2R/2); return [rho*Math.sin(lon*D2R), rho*Math.cos(lon*D2R)]; };
  function approxMask(lat, lon, mastM, far, near){
    const sub = 4, frac = 0.005, maxM = 650000, demMax = far.meta.dem_max_m || 7026.33;
    const xy = llXY(lat, lon), gNear = near.inside(xy[0], xy[1]) ? near : null;
    const h0 = (gNear || far).sample(xy[0], xy[1]), r0 = RM + h0 + mastM, nearPx = gNear ? gNear.pixel : far.pixel, D = [nearPx];
    while (D[D.length - 1] < maxM){ const dl = D[D.length - 1]; D.push(dl + Math.max(dl < 60000 && gNear ? nearPx : far.pixel, frac*dl)); }
    const nD = D.length, bound = new Float64Array(nD), cs = new Float64Array(nD), sn = new Float64Array(nD);
    for (let q = 0; q < nD; q++){ const th = D[q]/RM, rr = RM + demMax; cs[q] = Math.cos(th); sn[q] = Math.sin(th); bound[q] = Math.atan2(rr*cs[q] - r0, rr*sn[q])/D2R; }
    for (let q = nD - 2; q >= 0; q--) if (bound[q + 1] > bound[q]) bound[q] = bound[q + 1];
    const la = lat*D2R, lo = lon*D2R, sl = Math.sin(la), cl = Math.cos(la), mask = new Array(360).fill(-90);
    let edge = 0;
    for (let b = 0; b < 360; b++){
      let edgeBin = false;
      for (let s = 0; s < sub; s++){
        const az = (b + (s + 0.5)/sub)*D2R, ca = Math.cos(az), sa = Math.sin(az); let best = -90;
        for (let q = 0; q < nD; q++){
          const ct = cs[q], st = sn[q], lat2 = Math.asin(sl*ct + cl*st*ca), lon2 = lo + Math.atan2(sa*st*cl, ct - sl*Math.sin(lat2));
          const rho = 2*RM*Math.tan(Math.PI/4 + lat2/2), x = rho*Math.sin(lon2), y = rho*Math.cos(lon2);
          if (!far.inside(x, y)){ edgeBin = true; break; }
          const h = (gNear && gNear.inside(x, y) ? gNear : far).sample(x, y);
          if (h === h){ const r1 = RM + h, el = Math.atan2(r1*ct - r0, r1*st)/D2R; if (el > best) best = el; }
          if (q + 1 < nD && best >= bound[q + 1]) break;
        }
        if (best > mask[b]) mask[b] = best;
      }
      if (edgeBin) edge++;
    }
    return {mask, ground_m: h0, edge_rays: edge, grid: gNear ? '240 m + 640 m' : '640 m'};
  }
  const poleKm = lat => (90 + lat)*D2R*R;   // surface distance from the south pole
  /* App.addSpot(lat, lon_east): adds ONE custom spot (replaces the previous one), selects it, emits 'spot' (+ 'site' if the selection moved). There is no 'sites' key.
     Resolves to the site row, or rejects with a plain-English Error (too far from the pole, not a number). */
  async function addSpot(lat, lon){
    lat = +lat; lon = ((+lon % 360) + 360) % 360;
    if (!isFinite(lat) || !isFinite(lon) || lat > -60) throw new Error('Give a south-pole latitude (negative, e.g. -89.5) and an east longitude.');
    const km = poleKm(lat);
    if (km > MAX_SPOT_KM) throw new Error('That spot is ' + Math.round(km) + ' km from the pole. Our terrain covers up to ' + MAX_SPOT_KM + ' km (about 80.4 S).');
    const {far, near} = await loadGrids(), masks = {}; let info = null;
    for (const m of ['0', '2', '10']){ const r = approxMask(lat, lon, +m, far, near); masks[m] = r.mask; if (m === '2') info = r; }
    const label = 'approximate, ' + info.grid + ' terrain';
    const base = sites.filter(s => !s.custom), i = base.length;
    const why = 'Coarse terrain (' + info.grid + ') misses nearby bumps, so sun and Earth % can be far off, mostly too optimistic on summits. The named sites use 20 m terrain.';
    const site = {i, id: 'X', name: 'Custom spot', short: 'Your spot', lat, lon, masks, psr_km: null, custom: true, approx: true, label, why,
      ground_m: info.ground_m, edge_rays: info.edge_rays, poleKm: km,
      raw: {id: 'X', name: 'Custom spot (' + label + ')', lat, lon_e: lon, psr_km: null, approx: true, reference: [], reference_stats: {by_mast: {}}}};
    // per-mast yearly stats for the ranking list (same rules as the series below; the engine's are over 2027 too)
    for (const m of ['0', '2', '10']){
      let sf = 0, eu = 0, run = 0, night = 0; const H = 365*24, j0 = jd(new Date(Date.UTC(2027, 0, 1)));
      for (let h = 0; h < H; h++){ const x = stateAtMask(site, masks[m], j0 + h/24); sf += x.sunLit; eu += x.earthVis ? 1 : 0; if (x.sunLit < 0.5){ if (++run > night) night = run; } else run = 0; }
      site.raw.reference_stats.by_mast[m] = {sun_pct: sf/H*100, earth_pct: eu/H*100, longest_night_h: night};
    }
    sites = base.concat(site);
    ser = ser.slice(0, i); buildSeriesFor(site); cache = {};
    set({site: i, selDay: -1, spot: {lat, lon, label, n: (state.spot ? state.spot.n : 0) + 1}}, 'core');
    return site;
  }
  function stateAtMask(site, m, j){
    const p = ephAt(j), su = azel(site.lat, site.lon, p.sun), ea = azel(site.lat, site.lon, p.earth);
    return {sunLit: sunFraction(su.el, profAt(m, su.az)), earthVis: ea.el - profAt(m, ea.az) + 0.95 > 0};
  }
  /* remove the custom spot (selects site 0 if it was selected) */
  function clearSpot(){
    if (!sites.some(s => s.custom)) return;
    sites = sites.filter(s => !s.custom); ser = ser.slice(0, sites.length); cache = {};
    set({site: state.site >= sites.length ? 0 : state.site, selDay: -1, spot: null}, 'core');
  }

  /* ---------- play loop: advances time, emits 't' ---------- */
  let last = 0;
  function tick(now){
    requestAnimationFrame(tick);
    if (state.playing && last){ const dt = Math.min(0.1, (now - last)/1000); set({t: (state.t + dt*state.speed) % (state.days - 1)}, 'play'); }
    last = now;
  }

  /* ---------- formatting helpers (plain English) ---------- */
  const iso = j => date(j).toISOString().slice(0, 16).replace('T', ' ');
  const dayDate = d => date(state.jd0 + d).toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
  const plainH = h => h == null ? 'not within 60 days' : h < 1 ? 'within the hour' : h < 48 ? 'in ' + Math.round(h) + ' hours' : 'in ' + (h/24).toFixed(1) + ' days';

  /* ---------- boot ---------- */
  const ready = (async function(){
    const [e, s, p] = await Promise.all([fetch(DATA + 'subpoints.json'), fetch(DATA + 'sites.json'), fetch(DATA + 'psr.json')].map(x => x.then(r => r.json())));
    EPH = e; eph = {generated_utc: e.generated_utc, versions: e.versions, start: date(e.jd0), end: date(e.jd0 + (e.n - 3)*e.step_hours/24)};
    sj = s; psr = p;
    sites = s.sites.map((o, i) => ({i, id: o.id, name: o.name.replace(/ \(.*\)/, ''), short: (o.name.match(/\((.*)\)/) || [, o.id])[1], lat: o.lat, lon: o.lon_e, masks: o.masks, psr_km: o.psr_km, raw: o}));
    buildSeries();
    if (window.Missions && Missions.load) await Missions.load();   // missions.js is loaded right after core.js
    requestAnimationFrame(tick);
  })();

  return {
    // constants + data
    R, D2R, DATA, PRESETS, ready,
    get state(){ return state; }, get sites(){ return sites; }, get sitesJson(){ return sj; }, get psr(){ return psr; }, get eph(){ return eph; },
    // maths (read-only use)
    ephAt, azel, jd, date, profAt, sunFraction, mask, stateAt, next, moonInfo,
    series: i => ser[i], wins, winsLong,
    // custom landing spot (approximate mask, label it with site.label)
    addSpot, clearSpot, MAX_SPOT_KM,
    // state
    set, on,
    // formatting
    iso, dayDate, plainH
  };
})();
