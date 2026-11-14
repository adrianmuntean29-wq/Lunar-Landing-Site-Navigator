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
  const R = 1737.4, D2R = Math.PI/180, DATA = '../data/';
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
    missions: {on: true, caution: 5, cn: true}
  };
  const PRESETS = {robotic: {len: 13, sun: 70, earth: 50, night: 48}, crew: {len: 6, sun: 95, earth: 50, night: 0}};   // example values, not NASA's
  const listeners = [];
  let sites = [], ser = [], sj = null, psr = null, eph = null, cache = {};

  function buildSeries(){
    const H = (state.days + 61)*24;   // +61 days: missions may end after the period (porkchop goes to 60 days)
    ser = sites.map(site => { const sun = new Float32Array(H), earth = new Uint8Array(H);
      for (let h = 0; h < H; h++){ const x = stateAt(site, state.jd0 + h/24); sun[h] = x.sunLit; earth[h] = x.earthVis ? 1 : 0; }
      return {sun, earth}; });
    cache = {};
  }
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
    // state
    set, on,
    // formatting
    iso, dayDate, plainH
  };
})();
