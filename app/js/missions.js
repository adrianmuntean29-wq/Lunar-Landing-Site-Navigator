/* missions.js: OWNER missions chat. Other missions near a landing site: data + keep-out maths. No dependencies.
   Reads App.state / App.sites when present; never changes state, never touches any area's DOM.

   Rules (NASA 2011 recommendations, NON-BINDING):
   - land >= 2.0 km from a historic lander site, with the whole landing ellipse outside;
   - >= 0.5 km from an impact site (crashes count as impacts).
   - Large landers (e.g. Blue Moon MK1) throw debris much further (Metzger 2024: 2 km is a placeholder). No number is
     published, so the user sets a caution radius; the default below is OUR ASSUMPTION, not a rule.
   Each mission point carries a position uncertainty (radius_km, from its precision class). The keep-out is measured
   from the edge of that circle: inside = distance <= rule + radius.
   "Coordinate" = a planned mission is inside the keep-out AND its possible landing/operations period overlaps the
   chosen window (selected landing day + mission length, or the whole period when no day is chosen). */
window.Missions = (function(){
  'use strict';
  const R = 1737.4, D2R = Math.PI/180;
  const LABEL = 'Public announcements and NASA 2011 non-binding guidance, not an official registry or law.';
  const RULES = {lander: 2.0, impact: 0.5};
  const DEFAULTS = {caution: 5, cn: true};   // caution: OUR ASSUMPTION (km) for large landers; cn: show Chang'e rows
  const PRECISION = {
    lroc_point:   'measured position (LROC image or reconstruction), tens of metres',
    target_point: 'announced target or unconfirmed point, about 1.5 km',
    region:       'region only: placeholder point, circle = size of the named region (see note)',
    unknown:      'position not known well'
  };
  const SRC = (document.currentScript && document.currentScript.src) || location.href;
  const URL_CSV = new URL('../data/missions.csv', SRC).href;
  let rows = null, loading = null;

  /* ---------- CSV (quoted fields with commas) ---------- */
  function parseCSV(text){
    const out = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++){
      const c = text[i];
      if (q){ if (c === '"'){ if (text[i+1] === '"'){ f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ','){ row.push(f); f = ''; }
      else if (c === '\n' || c === '\r'){ if (c === '\r' && text[i+1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0]) out.push(row); row = []; }
      else f += c;
    }
    if (f || row.length){ row.push(f); out.push(row); }
    const head = out.shift();
    return out.map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
  }
  const jdOf = s => s ? Date.parse(s + 'T00:00:00Z')/86400000 + 2440587.5 : null;
  const num = s => s === '' ? null : +s;
  function shape(o){
    const lat = num(o.lat), lon = num(o.lon_e), from = jdOf(o.date_from), to = jdOf(o.date_to), ops = num(o.ops_days) || 0;
    return Object.assign(o, {lat, lon, radius_km: num(o.radius_km) || 0, ops_days: ops, placed: lat != null && lon != null,
      large: o.large === 'yes', placeholder: o.placeholder === 'yes', jdFrom: from, jdTo: to == null ? null : to + ops,
      impact: o.status === 'impact' || o.status === 'crashed', planned: o.status === 'planned',
      precisionText: PRECISION[o.precision] || o.precision});
  }
  function load(url){
    if (rows) return Promise.resolve(rows);
    if (!loading) loading = fetch(url || URL_CSV, {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error('missions.csv ' + r.status); return r.text(); })
      .then(t => (rows = parseCSV(t).map(shape)));
    return loading;
  }

  /* ---------- maths ---------- */
  /* great-circle distance on the 1737.4 km sphere (haversine; east-positive longitudes) */
  function distanceKm(lat1, lon1, lat2, lon2){
    const a = lat1*D2R, b = lat2*D2R, dl = (lon2 - lon1)*D2R;
    const h = Math.sin((b - a)/2)**2 + Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;
    return 2*R*Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function settings(opts){
    const s = (window.App && App.state && App.state.missions) || {};
    return Object.assign({}, DEFAULTS, s, opts || {});
  }
  /* rule distance for one mission: 2.0 lander / 0.5 impact / max(2.0, caution) for large landers */
  function ruleKm(m, caution){
    if (m.impact) return {km: RULES.impact, why: 'impact site: 0.5 km (NASA 2011, non-binding)'};
    if (m.large && caution > RULES.lander) return {km: caution, why: 'large lander: ' + caution + ' km caution radius (our assumption)'};
    return {km: RULES.lander, why: 'lander site: 2.0 km (NASA 2011, non-binding)'};
  }
  /* the window the user is looking at, in Julian days: chosen landing day + mission length, else the whole period */
  function windowNow(){
    if (!(window.App && App.state)) return null;
    const st = App.state;
    return st.selDay >= 0 ? {from: st.jd0 + st.selDay, to: st.jd0 + st.selDay + st.lim.len, chosenDay: true}
                          : {from: st.jd0, to: st.jd0 + st.days, chosenDay: false};
  }
  function resolveSite(site){
    if (site == null && window.App && App.sites) site = App.state.site;
    if (typeof site === 'number') site = App.sites[site];
    return site;   // {lat, lon} (App.sites rows use lon = east positive)
  }
  /* near(site, opts) -> missions sorted by distance.
     site: index into App.sites, an App.sites row, {lat, lon}, or nothing (= the selected site).
     opts: {caution, cn, window: {from, to} (JD), withinKm: also list missions this far even if outside keep-out (default 0)}
     Each hit: {m, km, edgeKm, ruleKm, needKm, why, inside, coordinate} */
  function near(site, opts){
    if (!rows) throw new Error('Missions.near: call Missions.load() first');
    const o = settings(opts), s = resolveSite(site), w = o.window || windowNow();
    if (!s) return [];
    const out = [];
    for (const m of rows){
      if (!m.placed || (!o.cn && m.group === 'cn')) continue;
      const km = distanceKm(s.lat, s.lon, m.lat, m.lon), r = ruleKm(m, o.caution), need = r.km + m.radius_km;
      const inside = km <= need;
      if (!inside && km > (o.withinKm || 0)) continue;
      const overlap = !!(w && m.planned && m.jdFrom != null && m.jdFrom <= w.to && (m.jdTo == null || m.jdTo >= w.from));
      out.push({m, km, edgeKm: Math.max(0, km - m.radius_km), ruleKm: r.km, needKm: need, why: r.why, inside, coordinate: inside && overlap});
    }
    return out.sort((a, b) => a.km - b.km);
  }
  /* plain-English one-liner for the panel */
  function summary(site, opts){
    const hits = near(site, opts).filter(h => h.inside);
    if (!hits.length) return {ok: true, text: 'No known mission inside its keep-out distance.', hits};
    const c = hits.filter(h => h.coordinate);
    const names = hits.map(h => h.m.name + ' (' + fmtKm(h.km) + (h.m.placeholder ? ', region only' : '') + ')').join('; ');
    return {ok: false, coordinate: c.length > 0,
      text: (c.length ? 'Coordinate with ' + c.map(h => h.m.name).join(', ') + ': planned nearby in your window. ' : '') +
            hits.length + ' inside keep-out: ' + names + '.', hits};
  }
  /* for the calendars: reasons a landing day fails because of other missions.
     Static keep-out does not depend on the day; "coordinate" does (day d + mission length vs the mission's period). */
  function dayFail(siteIndex, d, opts){
    const st = App.state, w = {from: st.jd0 + d, to: st.jd0 + d + st.lim.len};
    const hits = near(siteIndex, Object.assign({}, opts, {window: w})).filter(h => h.inside);
    const f = [];
    if (hits.some(h => !h.m.planned)) f.push('keepout');   // hardware already on the surface: always
    // planned missions only fail a day when their period overlaps it ('coordinate'); otherwise they are info only
    if (hits.some(h => h.coordinate)) f.push('coordinate');
    return f;
  }
  /* split placed missions into the ones inside a pole-centred view and the ones beyond its edge.
     offMap(viewKm = 60, opts) -> {inView: [rows], offMap: [{names, rows, lonE, km}]}
     km = distance from the pole (to the group's nearest member); lonE = direction from the pole: on a polar map a point
     at east longitude L lies along the L meridian, so the edge arrow points along L (scene: siteXZ({lat: -89, lon: lonE})).
     Missions within groupKm (default 40) of each other share one arrow so labels do not pile up. */
  function offMap(viewKm, opts){
    if (!rows) throw new Error('Missions.offMap: call Missions.load() first');
    const o = settings(opts), V = viewKm == null ? 60 : viewKm, G = o.groupKm || 40, inView = [], out = [];
    const list = rows.filter(m => m.placed && (o.cn || m.group !== 'cn'))
      .map(m => ({m, km: distanceKm(-90, 0, m.lat, m.lon)})).sort((a, b) => a.km - b.km);
    for (const x of list){
      if (x.km <= V){ inView.push(x.m); continue; }
      const g = out.find(g => g.rows.some(r => distanceKm(r.lat, r.lon, x.m.lat, x.m.lon) <= G));
      if (g){ g.rows.push(x.m); g.names.push(x.m.name); } else out.push({rows: [x.m], names: [x.m.name], lonE: x.m.lon, km: x.km});
    }
    out.forEach(g => g.text = g.names.join(', ') + ': ' + Math.round(g.km) + ' km from the pole');
    return {inView, offMap: out};
  }
  const fmtKm = km => km < 10 ? km.toFixed(1) + ' km' : Math.round(km) + ' km';

  return {LABEL, RULES, DEFAULTS, PRECISION, load, distanceKm, ruleKm, near, summary, dayFail, offMap, windowNow, fmtKm,
          get rows(){ return rows; }};
})();
