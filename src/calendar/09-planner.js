/* Landing calendar, runs inside startApp() and shares its scope with the other files here (see tools/build_js.py): the
   mission planner: start date and span, limits, the landing calendar, Fly it, site ranking, data provenance. */
/* ---------- first landing date + time span (UTC midnight) ----------
   The ephemeris file ends at EPH_END, so the last allowed first date is EPH_END minus the span. */
var startEl = $('#start');
var EPH_END = EPH.jd0 + (EPH.n - 3)*EPH.step_hours/24;
function isoDay(jd){ return dateFromJd(jd).toISOString().slice(0, 10); }
function clampStart(){
  var maxJd = Math.floor(EPH_END - DAYS - 0.5) + 0.5;
  startEl.max = isoDay(maxJd);
  if (state.jd0 > maxJd) state.jd0 = maxJd;
  startEl.value = isoDay(state.jd0);
}
function rebuildAll(){
  var t0 = performance.now();
  buildSites(); setT(clamp(state.t, 0, DAYS)); tInput.max = DAYS;
  meanDone = 0; sunMean.fill(0); earthMean.fill(0);
  if (stage === 2){ stage = 1; statusEl.hidden = false; segBtns.forEach(function(o){ o.disabled = o.getAttribute('data-mode') !== '0'; }); }
  dirty.sites = true; dirty.charts = true; lastHead = -1;
  lastBuildMs = performance.now() - t0;
  schedulePlan();
}
var lastBuildMs = 0;
clampStart();
startEl.addEventListener('change', function(){
  if (!startEl.value) return;
  var d = new Date(startEl.value + 'T00:00:00Z');
  if (isNaN(d)) return;
  state.jd0 = jdFromDate(d); clampStart(); state.t = 0;
  rebuildAll();
});

/* ---------- headline: time to the next sunset / Earthset (or rise) ---------- */
var headEl = $('#headline'), lastHead = -1, lastHeadAt = 0;
function hoursText(h){ return h < 48 ? num(h, 1) + ' h' : num(h/24, 1) + ' days'; }
function change(c, setWord, riseWord){
  var w = c.up ? setWord : riseWord;
  return c.hours === null ? 'No ' + w.toLowerCase() + ' within 60 days' : w + ' in ' + hoursText(c.hours);
}
function renderHeadline(force){
  var now = performance.now();
  if (!force && Math.abs(state.t - lastHead) < 1/96 && lastHead >= 0) return;
  if (!force && state.playing && now - lastHeadAt < 250) return;
  lastHead = state.t; lastHeadAt = now;
  var s = sites[sel], sn = nextChange(s, state.t, 'sun'), en = nextChange(s, state.t, 'earth');
  headEl.innerHTML =
    '<span class="m">' + s.name.replace(/[<>&]/g, '') + ' · ' + dateFromJd(state.jd0 + state.t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC</span><br>' +
    '<span class="s">' + change(sn, 'Sunset', 'Sunrise') + '</span> · ' +
    '<span class="e">' + change(en, 'Earthset', 'Earthrise') + '</span><br>' +
    '<span class="m">Sun: disc centre vs the ' + (s.flat ? 'flat 0° horizon (terrain mask not loaded yet)' : 'terrain horizon') + '. Earth: any part of its disc.</span>';
}

/* ---------- mission planner: controls, calendar, funnel, ranking ----------
   Everything here is computed live in the browser from the hourly series in computeSite. */
var PRESETS = {
  crew: {len: 6, sun: 95, earth: 25, night: 0, td: 0},
  robotic: {len: 13, sun: 70, earth: 25, night: 48, td: 0}
};   // example values, not NASA requirements (the page says so); Earth 25% = the visibility mask in a 2024 NASA presentation (NTRS 20240009596)
var MS_PER_SPOT_YEAR = 0.7;   // engine MEASURED, single thread (vault DECISIONS item 8)
var GLYPH = {sun: '☀', earth: '⊕', night: '☾', td: '▲'};
var FAILTXT = {sun: 'too little sun', earth: 'too little Earth contact', night: 'night too long', td: 'Sun too low at touchdown'};
var SL = {len: $('#sLen'), sun: $('#sSun'), earth: $('#sEarth'), night: $('#sNight'), td: $('#sTd')};
var OUT = {len: $('#oLen'), sun: $('#oSun'), earth: $('#oEarth'), night: $('#oNight'), td: $('#oTd')};
var pSite = $('#pSite'), calEl = $('#cal'), funnelEl = $('#funnel'), rankEl = $('#rank'), estEl = $('#pEst');
var planResults = [], planTimer = 0, calSelDay = -1;
function esc(t){ return String(t).replace(/[&<>"]/g, function(c){ return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }

function setPressed(group, v){ Array.prototype.forEach.call(group.querySelectorAll('button'), function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-v') === String(v) ? 'true' : 'false'); }); }
function syncOutputs(){
  OUT.len.textContent = LIM.len + ' days';
  OUT.sun.textContent = LIM.sun + '%';
  OUT.earth.textContent = LIM.relay ? 'off (relay)' : LIM.earth + '%';
  OUT.night.textContent = LIM.night + ' h';
  OUT.td.textContent = (LIM.td >= 0 ? '+' : '') + num(LIM.td, 1) + '°';
  SL.earth.disabled = LIM.relay;
}
function applyPreset(name){
  var p = PRESETS[name]; if (!p) return;
  LIM.len = p.len; LIM.sun = p.sun; LIM.earth = p.earth; LIM.night = p.night; LIM.td = p.td;
  Object.keys(SL).forEach(function(k){ SL[k].value = LIM[k]; });
  setPressed($('#pPreset'), name); syncOutputs(); schedulePlan();
}
Object.keys(SL).forEach(function(k){
  SL[k].addEventListener('input', function(){
    LIM[k] = parseFloat(SL[k].value); setPressed($('#pPreset'), 'custom'); syncOutputs(); schedulePlan();
  });
});
$('#pPreset').addEventListener('click', function(e){ var b = e.target.closest('button'); if (!b) return; var v = b.getAttribute('data-v'); if (v === 'custom'){ setPressed($('#pPreset'), 'custom'); return; } applyPreset(v); });
$('#cRelay').addEventListener('change', function(e){ LIM.relay = e.target.checked; syncOutputs(); schedulePlan(); });
pSite.addEventListener('change', function(){ select(parseInt(pSite.value, 10)); });

/* Time span: estimate first (spots x years x 0.7 ms), warn above 3 s, then rebuild. */
function estimateMs(years){ return sites.length*years*MS_PER_SPOT_YEAR; }
function showEstimate(years, ran){
  var ms = estimateMs(years);
  estEl.className = 'est' + (ms > 3000 ? ' warn' : '');
  estEl.textContent = sites.length + ' sites × ' + years + ' y ≈ ' + (ms < 1000 ? num(ms, 0) + ' ms' : num(ms/1000, 1) + ' s') + ' (engine estimate)' +
    (ran ? ' · this build took ' + num(lastBuildMs, 0) + ' ms in your browser' : '') + (ms > 3000 ? ' · above 3 s: expect a pause' : '');
}
$('#pYears').addEventListener('click', function(e){
  var b = e.target.closest('button'); if (!b) return;
  var y = parseInt(b.getAttribute('data-v'), 10);
  if (estimateMs(y) > 3000 && !window.confirm('This span is estimated at over 3 seconds. Run it?')) return;
  setPressed($('#pYears'), y); DAYS = 365*y; clampStart(); rebuildAll(); showEstimate(y, true);
});

/* Mast height: needs one mask per height from the engine; disabled until sites.json has them. */
function mastAvailable(){ return !!(SITEDATA && SITE_LIST.some(function(o){ return SITEDATA[o.id] && SITEDATA[o.id].masks; })); }
(function(){
  var ok = mastAvailable();
  Array.prototype.forEach.call($('#pMast').querySelectorAll('button'), function(b){ b.disabled = !ok; });
  $('#pMastNote').textContent = ok ? '' : 'Available when the engine\'s terrain masks load. Until then: flat horizon.';
})();
$('#pMast').addEventListener('click', function(e){
  var b = e.target.closest('button'); if (!b || b.disabled) return;
  state.mast = b.getAttribute('data-v'); setPressed($('#pMast'), state.mast); rebuildAll();
});

function schedulePlan(){ clearTimeout(planTimer); planTimer = setTimeout(renderPlanner, 30); }
/* the same site under the crewed example limits (relay and mast as chosen), so crewed landings stand out in any preset */
function evalCrew(s){
  var keep = {len: LIM.len, sun: LIM.sun, earth: LIM.earth, night: LIM.night, td: LIM.td}, P = PRESETS.crew;
  LIM.len = P.len; LIM.sun = P.sun; LIM.earth = P.earth; LIM.night = P.night; LIM.td = P.td;
  try { return evalSite(s); } finally { LIM.len = keep.len; LIM.sun = keep.sun; LIM.earth = keep.earth; LIM.night = keep.night; LIM.td = keep.td; }
}
var crewResults = [];
function renderPlanner(){
  planResults = sites.map(evalSite);
  crewResults = sites.map(evalCrew);
  // site picker
  pSite.innerHTML = sites.map(function(s, i){ return '<option value="' + i + '">' + esc(s.name) + '</option>'; }).join('');
  pSite.value = String(sel);
  var s = sites[sel], res = planResults[sel], n = res.length, cres = crewResults[sel];
  // settings printed on the view
  $('#calTitle').textContent = 'Landing windows: ' + s.name;
  $('#calNote').textContent = 'Landing at 00:00 UTC · ' + LIM.len + '-day mission · sun ≥ ' + LIM.sun + '% · ' +
    (LIM.relay ? 'Earth contact not required (relay)' : 'Earth ≥ ' + LIM.earth + '%') + ' · night ≤ ' + LIM.night + ' h · Sun at touchdown ≥ ' +
    num(LIM.td, 1) + '° · mast ' + state.mast + ' m · ' + (s.flat ? 'flat horizon' : 'LOLA horizon');
  // calendar: one row per month, one cell per landing day
  var rows = {}, order = [];
  for (var d = 0; d < DAYS; d++){
    var dt = dateFromJd(state.jd0 + d), key = dt.toISOString().slice(0, 7), dom = dt.getUTCDate();
    if (!rows[key]){ rows[key] = []; order.push(key); }
    var r = res[d], cls, glyph = '', label, cr = cres[d], crewOk = !!(cr && !cr.fail.length);
    var dayIso = dt.toISOString().slice(0, 10);
    if (!r){ cls = 'none'; label = dayIso + ': mission would end after the time span'; }
    else if (!r.fail.length){ cls = 'pass'; label = dayIso + ': passes. Sun ' + num(r.sun, 0) + '%, Earth ' + num(r.earth, 0) + '%, longest night ' + (r.clipped ? '≥ ' : '') + num(r.night, 0) + ' h'; }
    else { cls = 'fail'; glyph = GLYPH[r.fail[0]]; label = dayIso + ': fails, ' + r.fail.map(function(f){ return FAILTXT[f]; }).join(', ') + '. Sun ' + num(r.sun, 0) + '%, Earth ' + num(r.earth, 0) + '%, longest night ' + (r.clipped ? '≥ ' : '') + num(r.night, 0) + ' h, Sun at touchdown ' + num(r.td, 1) + '°'; }
    if (crewOk && cls !== 'none') label += '. A crewed landing works on this day (crew limits)';
    rows[key].push('<button type="button" class="cal-c ' + cls + (crewOk && cls !== 'none' ? ' crewok' : '') + (d === calSelDay ? ' sel' : '') + '" style="grid-column:' + (dom + 1) + '" data-d="' + d + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"' + (cls === 'none' ? ' tabindex="-1"' : '') + '>' + glyph + '</button>');
  }
  calEl.innerHTML = order.map(function(k){ return '<div class="mrow"><span class="mlab">' + k + '</span>' + rows[k].join('') + '</div>'; }).join('');
  // funnel: how many landing days survive each limit, in order
  var c = [0, 0, 0, 0];
  res.forEach(function(r){
    if (!r) return; var f = r.fail;
    if (f.indexOf('sun') < 0){ c[0]++;
      if (f.indexOf('earth') < 0){ c[1]++;
        if (f.indexOf('night') < 0){ c[2]++; if (f.indexOf('td') < 0) c[3]++; } } }
  });
  var total = res.filter(Boolean).length;
  funnelEl.innerHTML =
    '<div><span>Landing days in the span</span><b>' + total + '</b></div>' +
    '<div><span>→ enough sun</span><b>' + c[0] + '</b></div>' +
    '<div><span>→ enough Earth contact' + (LIM.relay ? ' (relay: skipped)' : '') + '</span><b>' + c[1] + '</b></div>' +
    '<div><span>→ night short enough</span><b>' + c[2] + '</b></div>' +
    '<div><span>→ Sun high enough at touchdown</span><b>' + c[3] + '</b></div>';
  // ranking: every site under the same limits
  var rank = sites.map(function(st, i){
    var rr = planResults[i], ok = rr.filter(function(x){ return x && !x.fail.length; }), first = ok.length ? ok[0].d : -1;
    var cr = crewResults[i] || [], crewN = cr.filter(function(x){ return x && !x.fail.length; }).length;
    return {i: i, s: st, pass: ok.length, total: rr.filter(Boolean).length, first: first, crewN: crewN, crewT: cr.filter(Boolean).length};
  }).sort(function(a, b){ return b.pass - a.pass || b.s.pSun - a.s.pSun; });
  rankEl.innerHTML = '<thead><tr><th>Site</th><th>Landing days that pass</th><th>Crewed landing days</th><th>First that passes</th><th>Sun (span)</th><th>Earth (span)</th><th>Longest night (span)</th><th>Data</th></tr></thead><tbody>' +
    rank.map(function(x){
      var share = x.total ? x.pass/x.total : 0;
      return '<tr tabindex="0" data-i="' + x.i + '"' + (x.i === sel ? ' class="selr"' : '') + '>' +
        '<td>' + esc(x.s.name) + '</td>' +
        '<td>' + x.pass + ' / ' + x.total + '<span class="bar bar-pass"><b style="width:' + Math.round(share*100) + '%;background:var(--pass)"></b></span></td>' +
        '<td><span class="crewn">' + x.crewN + '</span> / ' + x.crewT + '</td>' +
        '<td>' + (x.first >= 0 ? isoDay(state.jd0 + x.first) : 'none') + '</td>' +
        '<td>' + pct(x.s.pSun) + '</td><td>' + pct(x.s.pEarth) + '</td>' +
        '<td>' + nightText(x.s.night, x.s.nightClipped) + '</td>' +
        '<td class="q">' + esc(x.s.flat ? 'flat horizon' : (x.s.meta && x.s.meta.approx ? 'approximate' : 'LOLA mask')) + (x.s.studied ? '' : ' · no reference') + '</td></tr>';
    }).join('') + '</tbody>';
  renderFly();
}
/* hand a landing day over to the mission page (launch from Canada, flight, touchdown) */
/* the mission page names a site by the code in brackets (C1, S, SL2…), or by its full name when it has none */
function flyId(s){ return s.id === 'X' ? '' : ((s.name.match(/\(([^)]+)\)/) || [])[1] || s.name); }
function renderFly(){
  var el = $('#flybar'), s = sites[sel], res = planResults[sel] || [], d = calSelDay, picked = d >= 0;
  if (!picked){ for (var q = 0; q < res.length; q++){ if (res[q] && !res[q].fail.length){ d = q; break; } } }
  var r = d >= 0 ? res[d] : null, fid = flyId(s);
  var pre = $('#pPreset [aria-pressed="true"]'), type = pre && pre.getAttribute('data-v') === 'crew' ? 'crewed' : 'robotic';
  if (!r){ el.className = 'flybar fails'; el.innerHTML = '<p class="flytxt">No landing day passes these limits at ' + esc(s.name) + '. Loosen a limit or pick another site to fly a mission.</p>'; return; }
  var day = dateFromJd(state.jd0 + d).toISOString().slice(0, 10);
  var status = r.fail.length ? 'fails: ' + r.fail.map(function(f){ return FAILTXT[f]; }).join(', ') : 'passes all limits';
  el.className = 'flybar' + (r.fail.length ? ' fails' : '');
  var txt = '<p class="flytxt"><b>Landing ' + day + ', 00:00 UTC</b> at ' + esc(s.name) + ' · ' + type + ', ' + LIM.len + ' days · ' + status +
    '<small>' + (picked ? 'Day chosen in the calendar.' : 'First day that passes. Click any day in the calendar to change it.') + '</small></p>';
  if (!fid){ el.innerHTML = txt + '<span class="caption">The mission page covers the named sites, not your own site.</span>'; return; }
  var q = 'site=' + fid + '&land=' + day + '&type=' + type + '&len=' + LIM.len + '&sun=' + LIM.sun + '&earth=' + LIM.earth + '&night=' + LIM.night + '&td=' + LIM.td + '&mast=' + state.mast + '&relay=' + (LIM.relay ? 1 : 0);
  var cr = (crewResults[sel] || [])[d], crewOk = !!(cr && !cr.fail.length), P = PRESETS.crew;
  var qc = 'site=' + fid + '&land=' + day + '&type=crewed&len=' + P.len + '&sun=' + P.sun + '&earth=' + P.earth + '&night=' + P.night + '&td=' + P.td + '&mast=' + state.mast + '&relay=' + (LIM.relay ? 1 : 0);
  var btns = type === 'crewed' ? '<a class="flybtn crew" href="mission.html?' + q + '">Fly it with a crew</a>'
    : (crewOk ? '<a class="flybtn crew" href="mission.html?' + qc + '">Fly it with a crew</a><a class="flybtn alt" href="mission.html?' + q + '">Fly it robotic</a>'
              : '<a class="flybtn" href="mission.html?' + q + '">Fly this mission from Canada</a>');
  el.innerHTML = txt.replace('</small></p>', (type !== 'crewed' ? (crewOk ? ' A crewed landing also works on this day.' : ' Not good enough for a crewed landing.') : '') + '</small></p>') + '<div class="flybtns">' + btns + '</div>';
}
calEl.addEventListener('click', function(e){
  var b = e.target.closest('.cal-c'); if (!b || b.classList.contains('none')) return;
  calSelDay = parseInt(b.getAttribute('data-d'), 10);
  Array.prototype.forEach.call(calEl.querySelectorAll('.cal-c.sel'), function(x){ x.classList.remove('sel'); });
  b.classList.add('sel');
  setT(calSelDay); lastHead = -1;
  renderFly();
});
rankEl.addEventListener('click', function(e){ var tr = e.target.closest('tr[data-i]'); if (tr) select(parseInt(tr.getAttribute('data-i'), 10)); });
rankEl.addEventListener('keydown', function(e){ if (e.key !== 'Enter' && e.key !== ' ') return; var tr = e.target.closest('tr[data-i]'); if (tr){ e.preventDefault(); select(parseInt(tr.getAttribute('data-i'), 10)); } });

/* ---------- provenance: what was precomputed, when, from what ---------- */
var REPO_ISSUES = 'https://github.com/adrianmuntean29-wq/Lunar-Landing-Site-Navigator/issues/new';
function renderProv(){
  var eph = 'Sun/Earth table: ' + (EPH.versions && EPH.versions.ephemeris || 'JPL Horizons') + ', computed ' + (EPH.generated_utc || 'date unknown') +
    ', covers ' + isoDay(EPH.jd0) + ' to ' + isoDay(EPH_END);
  var sd = window.__sitesMeta;
  var ter = sd ? 'Terrain masks: ' + (sd.versions && sd.versions.dem || sd.dem || 'LOLA') + ', computed ' + (sd.generated_utc || sd.generated || 'date unknown')
               : 'Terrain masks: not loaded yet (flat horizon)';
  var body = 'Please rerun the precalculation (pipeline/).\n\nCurrent data:\n- ' + eph + '\n- ' + ter +
    '\n\nPage settings when requested: first date ' + isoDay(state.jd0) + ', span ' + DAYS/365 + ' y, mast ' + state.mast + ' m.' +
    '\n\nExpected run time on the team server: named sites about 2 min, whole pole about 6 min.';
  var url = REPO_ISSUES + '?title=' + encodeURIComponent('Request: newer precalculation') + '&body=' + encodeURIComponent(body);
  $('#prov').innerHTML = esc(eph) + ' · ' + esc(ter) + ' · <a href="' + esc(url) + '" target="_blank" rel="noopener">Request a newer precalculation</a> (opens a GitHub issue; about 2-6 min to run)';
}

applyPreset('robotic'); showEstimate(1, false); renderProv();

