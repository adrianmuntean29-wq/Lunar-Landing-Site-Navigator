/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): buttons
   and inputs, replays, opening from the calendar, the animation loop and test hooks. */
/* =====================================================================
   controls
   ===================================================================== */
var launchSel = $('#launch');
LAUNCH_SITES.forEach(function(l, i){ var o = document.createElement('option'); o.value = i; o.textContent = l.name + ' · ' + l.lat.toFixed(2) + '° N'; launchSel.appendChild(o); });
launchSel.addEventListener('change', function(){ autoBest = false; launchIdx = +launchSel.value; recompute(); renderAll(); });
var tofIn = $('#tof'), stayIn = $('#stay');
function syncSetup(){
  var P = PROFILES[active], tH = transfer(C.RE + P.parkingAlt, C.dEM, 10).tH;
  tofIn.max = (Math.round(tH*10)/10).toFixed(1);
  tofIn.value = Math.min(P.tof, +tofIn.max); $('#tofOut').textContent = t1(+tofIn.value) + ' d';
  stayIn.min = P.stayMin; stayIn.max = P.stayMax; stayIn.value = P.stay; $('#stayOut').textContent = t1(P.stay) + ' d';
  $('#stayLabel').textContent = P.stayLabel;
  $('#pickCount').textContent = 'Crewed ' + picks.crewed.length + '/5 · Robotic ' + picks.robotic.length + '/5';
  $('#landingOut').innerHTML = 'Landing: <span class="c">crewed</span> <b>' + fmtDate(launchMs + missionTimes('crewed').land*86400000) + '</b> · <span class="r">robotic</span> <b>' + fmtDate(launchMs + missionTimes('robotic').land*86400000) + '</b>';
}
function syncDate(){ var d = new Date(launchMs); $('#ldate').value = d.toISOString().slice(0, 16); }
$('#ldate').addEventListener('change', function(e){
  var v = e.target.value; if (!v) return;
  var ms = Date.parse(v + ':00Z');
  if (isFinite(ms)){ autoBest = false; launchMs = Math.round(ms/60000)*60000; recompute(); renderAll(); }
});
Array.prototype.forEach.call(document.querySelectorAll('[data-slip]'), function(b){
  b.addEventListener('click', function(){ autoBest = false; launchMs += (+b.getAttribute('data-slip'))*86400000; syncDate(); recompute(); renderAll(); });
});
var mapBtns = Array.prototype.slice.call(document.querySelectorAll('[data-map]'));
mapBtns.forEach(function(b){ b.addEventListener('click', function(){ mapMode = b.getAttribute('data-map'); mapBtns.forEach(function(o){ o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); }); drawMap(); }); });
$('#addSite').addEventListener('submit', function(e){
  e.preventDefault();
  var lat = parseFloat($('#asLat').value), lon = parseFloat($('#asLon').value), name = $('#asName').value.trim();
  if (!isFinite(lat) || lat < -90 || lat > 90 || !isFinite(lon) || lon < -180 || lon > 180){ msgEl.textContent = 'Enter latitude −90…90 and longitude −180…180 (east positive).'; return; }
  addCustom(name, lat, lon);
  $('#asName').value = ''; $('#asLat').value = ''; $('#asLon').value = '';
});
tofIn.addEventListener('input', function(){ autoBest = false; PROFILES[active].tof = +tofIn.value; $('#tofOut').textContent = t1(+tofIn.value) + ' d'; recompute(); renderAll(); });
stayIn.addEventListener('input', function(){ autoBest = false; PROFILES[active].stay = +stayIn.value; $('#stayOut').textContent = t1(+stayIn.value) + ' d'; recompute(); renderAll(); });
var missionBtns = Array.prototype.slice.call(document.querySelectorAll('[data-mission]'));
function setActive(k){
  active = k; autoBest = false;
  missionBtns.forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-mission') === k ? 'true' : 'false'); });
  met = 0; recompute(); renderAll();
}
missionBtns.forEach(function(b){ b.addEventListener('click', function(){ setActive(b.getAttribute('data-mission')); }); });
var viewBtns = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
viewBtns.forEach(function(b){ b.addEventListener('click', function(){ view = b.getAttribute('data-view'); cam.zoom = 1; cam.pitch = view === 'moon' ? -0.75 : 0.62; viewBtns.forEach(function(o){ o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); }); dirty = true; }); });
var metIn = $('#met'), playBtn = $('#play'), playIcon = $('#playIcon');
function setPlaying(v){
  playing = v;
  playIcon.setAttribute('d', playing ? 'M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z' : 'M4 2.5v11l9-5.5z');
  playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play the mission');
  last = performance.now();
}
function startLanding(fromPlay){
  if (!mission) return;
  met = mission.tLand; syncMet(); setPlaying(false);
  look.follow = 'auto'; look.az = null;
  landAnim = {kind: 'land', start: performance.now(), resume: !!fromPlay};
  if (fromPlay && !landAnim.scrolled){
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    surfWrap.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'center'});
  }
  dirty = true;
}
$('#watchLand').addEventListener('click', function(){ startLanding(false); });
var launchSeen = false;
function startLaunch(fromPlay){
  if (!mission) return;
  launchSeen = true;
  met = 0; syncMet(); setPlaying(false);
  landAnim = {kind: 'launch', key: mission.key, start: performance.now(), resume: !!fromPlay};
  if (fromPlay){
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    surfWrap.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'center'});
    /* the launch table above can still grow (weather arriving) and push the view down; centre it again once */
    setTimeout(function(){ if (landAnim && landAnim.kind === 'launch') surfWrap.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'center'}); }, 1600);
  }
  dirty = true;
}
$('#watchLaunch').addEventListener('click', function(){ startLaunch(false); });
function goSurface(){ var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; surfWrap.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'center'}); }
$('#gPlay').addEventListener('click', function(){ launchSeen = false; startLaunch(true); });
$('#gLaunch').addEventListener('click', function(){ startLaunch(false); goSurface(); });
$('#gLand').addEventListener('click', function(){ startLanding(false); goSurface(); });
/* highlight the section in view in the sticky bar */
(function(){
  var links = Array.prototype.slice.call(document.querySelectorAll('#jump a')), map = {};
  links.forEach(function(a){ map[a.getAttribute('href').slice(1)] = a; });
  if (!window.IntersectionObserver) return;
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ if (e.isIntersecting){ links.forEach(function(a){ a.classList.remove('on'); }); var a = map[e.target.id]; if (a){ a.classList.add('on'); a.scrollIntoView({block: 'nearest', inline: 'nearest'}); } } });
  }, {rootMargin: '-45% 0px -50% 0px'});
  Object.keys(map).forEach(function(id){ var el = document.getElementById(id); if (el) io.observe(el); });
  links.forEach(function(a){ a.addEventListener('click', function(){ var el = document.getElementById(a.getAttribute('href').slice(1)); if (el && el.tagName === 'DETAILS') el.open = true; }); });
})();
function startLiftoff(fromPlay){
  if (!mission || mission.key !== 'crewed') return;
  met = mission.tLift; syncMet(); setPlaying(false);
  look.follow = 'auto'; look.az = null;
  landAnim = {kind: 'lift', start: performance.now(), resume: !!fromPlay};
  if (fromPlay){
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    surfWrap.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'center'});
  }
  dirty = true;
}
$('#watchLift').addEventListener('click', function(){ startLiftoff(false); });
function setMast(v){ mast = v; seriesCache = {}; lwKey = ''; autoBest = false; recompute(); renderAll(); }
$('#mastSel').addEventListener('change', function(e){ setMast(e.target.value); });
$('#relayChk').addEventListener('change', function(e){ relay = e.target.checked; seriesCache = {}; lwKey = ''; autoBest = false; recompute(); renderAll(); });
function syncLimits(){
  var a = LIMITS.crewed, b = LIMITS.robotic;
  function one(L){ return 'Sun ≥ ' + L.sun + '%, ' + (relay ? 'Earth not required (relay)' : 'Earth ≥ ' + L.earth + '%') + ', ' + (L.night ? 'night ≤ ' + L.night + ' h' : 'no night') + ', Sun ≥ ' + sgn(L.td, 1) + '° at touchdown'; }
  $('#limitsLine').textContent = 'Good landing, same limits as the landing calendar. Earth 25% is the value listed in a 2024 NASA presentation; the others are example values, not NASA requirements. Crewed: ' + one(a) + '. Robotic: ' + one(b) + '.';
  $('#mastSel').value = mast; $('#relayChk').checked = relay;
}
function syncMet(){ metIn.value = (met/mission.tEnd).toFixed(4); markPhase(); }
metIn.addEventListener('input', function(){ met = +metIn.value*mission.tEnd; markPhase(); dirty = true; });
playBtn.addEventListener('click', function(){
  if (landAnim) landAnim = null;
  if (!playing && met >= mission.tEnd - 1) met = 0;
  if (!playing && met < 1 && !launchSeen){ startLaunch(true); return; }
  setPlaying(!playing);
});
$('#warp').addEventListener('change', function(e){ warp = +e.target.value; });
var pointers = new Map(), pinch = null;
sc.addEventListener('pointerdown', function(e){ try { sc.setPointerCapture(e.pointerId); } catch (err) {} pointers.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (pointers.size === 2){ var p = Array.from(pointers.values()); pinch = {d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, z: cam.zoom}; } });
sc.addEventListener('pointermove', function(e){
  var p = pointers.get(e.pointerId); if (!p) return;
  var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1){ cam.yaw += dx*0.006; cam.pitch = clamp(cam.pitch + dy*0.005, -1.5, 1.5); }
  else if (pinch){ var q = Array.from(pointers.values()); cam.zoom = clamp(pinch.z*Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y)/pinch.d, 0.3, 40); }
  dirty = true;
});
function endP(e){ pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; }
sc.addEventListener('pointerup', endP); sc.addEventListener('pointercancel', endP);
sc.addEventListener('wheel', function(e){ e.preventDefault(); cam.zoom = clamp(cam.zoom*Math.exp(-e.deltaY*0.0012), 0.3, 40); dirty = true; }, {passive: false});
sc.addEventListener('keydown', function(e){
  var u = true;
  if (e.key === 'ArrowLeft') cam.yaw -= 0.08; else if (e.key === 'ArrowRight') cam.yaw += 0.08;
  else if (e.key === 'ArrowUp') cam.pitch = clamp(cam.pitch + 0.06, -1.5, 1.5); else if (e.key === 'ArrowDown') cam.pitch = clamp(cam.pitch - 0.06, -1.5, 1.5);
  else if (e.key === '+' || e.key === '=') cam.zoom = clamp(cam.zoom*1.15, 0.3, 40); else if (e.key === '-') cam.zoom = clamp(cam.zoom/1.15, 0.3, 40);
  else u = false;
  if (u){ e.preventDefault(); dirty = true; }
});

function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = vp.clientWidth; H = vp.clientHeight;
  sc.width = Math.round(W*DPR); sc.height = Math.round(H*DPR); dirty = true; panelsDirty = true;
}
var dirty = true, panelsDirty = true;
/* plain-language summary of the mission on show, with the main actions */
function renderGlance(){
  if (!mission) return;
  var k = active, R = results[k].filter(function(r){ return r.site.id === target[k]; })[0], g = $('#glance');
  g.classList.toggle('robot', k !== 'crewed');
  $('#gType').textContent = k === 'crewed' ? 'Crewed mission' : 'Robotic mission';
  $('#gSite').textContent = R ? R.site.name : 'Pick a site';
  var v = $('#gVerdict');
  if (R){
    v.className = 'g-verdict ' + (R.viable ? 'ok' : 'bad');
    v.textContent = R.viable ? 'Good landing day: Sun ' + pct(R.stay.sun) + ' and Earth ' + pct(R.stay.earth) + ' of the ' + (k === 'crewed' ? 'stay' : 'mission')
      : 'Not a good landing day: ' + failText(R.ev, k).replace(/<[^>]+>/g, '') + (R.next >= 0 ? '. Next good day ' + fmtDate(tabTime(R.next), false) : '');
  } else { v.className = 'g-verdict'; v.textContent = ''; }
  var M = mission, land = launchMs + M.tLand*1000, lift = launchMs + M.tLift*1000, end = launchMs + M.tEnd*1000;
  var steps = [['Launch', fmtDate(launchMs), LAUNCH_SITES[launchIdx].name.split(' (')[0]],
               ['Land', fmtDate(land), 'after ' + t1(M.tLand/86400) + ' days']];
  if (k === 'crewed'){ steps.push(['On the surface', t1((M.tLift - M.tLand)/86400) + ' days', 'crew outside, then liftoff']); steps.push(['Home', fmtDate(end, false), 'Earth entry after ' + t1(M.tEnd/86400) + ' days']); }
  else steps.push(['Rover at work', t1((M.tEnd - M.tLand)/86400) + ' days', 'until ' + fmtDate(end, false)]);
  $('#gSteps').style.setProperty('--n', steps.length);
  $('#gSteps').innerHTML = steps.map(function(s){ return '<li><b>' + s[0] + '</b><span>' + s[1] + '</span><small>' + s[2] + '</small></li>'; }).join('');
}
function renderAll(){
  syncSetup(); syncLimits(); renderGlance(); renderRanks(); renderBudget(); renderPhases(); syncMet();
  renderSitesTable(); renderVehicle(); drawMap(); drawYear(); drawSky(); drawSurface(); renderWindows(); dirty = true;
}
if (window.ResizeObserver){ new ResizeObserver(resize).observe(vp); new ResizeObserver(function(){ drawMap(); drawYear(); drawSky(); drawLwChart(); orbDirty = true; dirty = true; }).observe(document.body); }
window.addEventListener('resize', resize);
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(){ drawMap(); drawYear(); drawLwChart(); dirty = true; }); } catch (err) {}
new MutationObserver(function(){ drawMap(); drawYear(); drawLwChart(); dirty = true; }).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});

var last = performance.now();
function frame(now){
  var dt = Math.min(0.1, (now - last)/1000); last = now;
  if (playing && mission){
    var metBefore = met;
    met += dt*warp*3600;
    if (metBefore < mission.tLand && met >= mission.tLand){ startLanding(true); }
    else if (mission.key === 'crewed' && metBefore < mission.tLift && met >= mission.tLift){ startLiftoff(true); }
    if (met >= mission.tEnd){ met = mission.tEnd; playing = false; playIcon.setAttribute('d', 'M4 2.5v11l9-5.5z'); playBtn.setAttribute('aria-label', 'Play the mission'); }
    syncMet(); dirty = true;
  }
  if (dirty){ render(); drawSky(); drawSurface(); drawOrbit(); dirty = false; }
  else {
    if (landAnim) drawSurface();
    if (orbDirty) drawOrbit();
  }
  if (landAnim && performance.now() - landAnim.start > (landAnim.kind === 'lift' ? LIFT.dur : landAnim.kind === 'launch' ? LAUNCH.dur : LAND.dur)){
    var resume = landAnim.resume, wasLaunch = landAnim.kind === 'launch'; landAnim = null; dirty = true;
    if (resume) setPlaying(true);
    if (resume && wasLaunch){   // after the launch, back to the flight view for the trip to the Moon
      var reduce2 = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      vp.scrollIntoView({behavior: reduce2 ? 'auto' : 'smooth', block: 'center'});
    }
  }
  requestAnimationFrame(frame);
}
/* opened from the landing calendar: mission.html?site=C1&land=2027-01-13&type=robotic&len=13&sun=70&earth=50&night=48&td=0&mast=2&relay=0 */
var FROMCAL = null;
(function(){
  var Q; try { Q = new URLSearchParams(location.search); } catch (err) { return; }
  var sid = Q.get('site'), land = Q.get('land');
  if (sid && !siteById(sid)){ var bad = $('#fromCal'); if (bad){ bad.hidden = false; bad.textContent = 'Site "' + sid + '" is not in this page\'s site list, so the mission below uses the default site instead.'; } return; }
  if (!sid || !land) return;
  var k = Q.get('type') === 'robotic' ? 'robotic' : 'crewed';
  ['sun', 'earth', 'night', 'td'].forEach(function(f){ var v = parseFloat(Q.get(f)); if (isFinite(v)) LIMITS[k][f] = v; });
  var len = parseFloat(Q.get('len')); if (isFinite(len) && len > 0) PROFILES[k].stay = clamp(len, PROFILES[k].stayMin, PROFILES[k].stayMax);
  if (['0', '2', '10'].indexOf(Q.get('mast')) >= 0) mast = Q.get('mast');
  relay = Q.get('relay') === '1';
  var ms = Date.parse(land.length <= 10 ? land + 'T00:00:00Z' : land); if (!isFinite(ms)) return;
  if (picks[k].indexOf(sid) < 0){ picks[k].unshift(sid); if (picks[k].length > 5) picks[k].pop(); }
  target[k] = sid; active = k; autoBest = false;
  FROMCAL = {k: k, site: sid, land: ms};
})();
recompute(); resize();
if (FROMCAL){
  launchMs = Math.round((FROMCAL.land - missionTimes(FROMCAL.k).land*86400000)/60000)*60000;
  recompute();
  missionBtns.forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-mission') === active ? 'true' : 'false'); });
}
syncDate(); renderAll();
(function(){
  var p = [];
  if (HZD) p.push('Sun and Earth at the sites: ' + (HZD.versions && HZD.versions.ephemeris || 'JPL Horizons') + ', table made ' + String(HZD.generated_utc).replace('T', ' ') + (TAB.horizons ? '' : ' (dates outside 2026–2035 fall back to the Meeus model)'));
  if (MASKMETA) p.push('Terrain horizons: LOLA masks from ' + (MASKMETA.versions && MASKMETA.versions.dem || 'PGDA') + ', made ' + String(MASKMETA.generated).replace('T', ' '));
  p.push('Trajectory, launch times and 3D scene: simplified model');
  $('#prov').textContent = p.join(' · ');
})();
if (FROMCAL){
  var fs = siteById(FROMCAL.site), fc = $('#fromCal');
  fc.hidden = false;
  fc.innerHTML = 'From the landing calendar: ' + (FROMCAL.k === 'crewed' ? 'crewed' : 'robotic') + ' landing at <b></b> on <b>' + fmtDate(FROMCAL.land) + '</b>. Launch worked back to ' + fmtDate(launchMs) + ' from ' + LAUNCH_SITES[launchIdx].name.split(' (')[0] + '. The launch plays first, then the flight; the touchdown is replayed in “Standing at” below.';
  fc.querySelector('b').textContent = fs.name;
  warp = 12; $('#warp').value = '12';
  startLaunch(true);
} else {
  met = mission.tLand + 6*3600; syncMet();
  applyBest();
}
window.__mission = {LRO: LRO, lroXY: lroXY, orbView: orbView, evalAt: evalAt, siteSeries: siteSeries, LIMITS: LIMITS, startLanding: startLanding, startLiftoff: startLiftoff, startLaunch: startLaunch, launchState: launchState, sunAltAz: sunAltAz, get landAnim(){ return landAnim; }, get mast(){ return mast; }, get target(){ return target; }, get active(){ return active; }, budgets: budgets, results: results, get mission(){ return mission; }, PROFILES: PROFILES, SITES: SITES, picks: picks,
  get windows(){ return lwRes; }, get wx(){ return wx; }, get launchMs(){ return launchMs; }, budget: budget, launchOpps: launchOpps, moonRADec: moonRADec, gmstDeg: gmstDeg};
/* Test hook (pipeline/validation/pages_vs_engine.py): this page's verdicts for one engine site, mast height and set of
   limits, landing at 00:00 UTC on nDays days from an ISO start date. Restores the page state afterwards. */
window.__mission.check = function(eng, mastM, lim, startIso, nDays, withSeries){
  var st = SITES.filter(function(x){ return x.eng === eng; })[0]; if (!st) return null;
  var keep = {mast: mast, relay: relay, t0: TAB.t0, L: Object.assign({}, LIMITS.robotic)};
  try {
    mast = String(mastM); relay = !!lim.relay;
    Object.assign(LIMITS.robotic, {sun: lim.sun, earth: lim.earth, night: lim.night, td: lim.td});
    buildTable(Date.parse(startIso + 'T00:00:00Z'));
    var Y = siteSeries(st), S = lim.len*24, out = [];
    for (var d = 0; d < nDays; d++){ var ev = evalAt(Y, d*24, S, 'robotic'); out.push(ev && {pass: ev.ok, fails: ev.fail, sun: ev.sun, earth: ev.earth, night: ev.night, td: ev.td}); }
    if (withSeries) return {days: out, sun: Array.from(Y.sunF), earth: Array.from(Y.earthOK), sunAlt: Array.from(Y.sunAlt)};
    return out;
  } finally {
    mast = keep.mast; relay = keep.relay; Object.assign(LIMITS.robotic, keep.L); buildTable(keep.t0); seriesCache = {};
  }
};
requestAnimationFrame(frame);
