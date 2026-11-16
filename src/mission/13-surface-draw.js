/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): drawing
   the site view and the small views of the other sites; the mission phase chips. */
function drawSurface(){
  var R = results[active].filter(function(r){ return r.site.id === target[active]; })[0];
  var dpr = Math.min(window.devicePixelRatio || 1, 2), w = surfWrap.clientWidth, h = surfWrap.clientHeight;
  if (surfC.width !== Math.round(w*dpr) || surfC.height !== Math.round(h*dpr)){ surfC.width = Math.round(w*dpr); surfC.height = Math.round(h*dpr); }
  var c = surfC.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!R){ c.fillStyle = '#000'; c.fillRect(0, 0, w, h); surfHud.innerHTML = '<span>Pick a site to stand on it</span>'; drawMinis(); return; }
  var LL = launchState(performance.now());
  if (LL){
    var lo = drawEarthLaunch(c, w, h, LL), wl = wxFor(launchMs), sa = lo.sun.alt;
    var sunTxt = sa >= 6 ? 'Daylight launch: Sun ' + Math.round(sa) + '° up' : sa >= -6 ? 'Twilight launch: Sun ' + sgn(sa, 0) + '°' : 'Night launch: Sun ' + Math.round(-sa) + '° below the horizon';
    var wxTxt = wl.src === 'forecast' ? 'Weather forecast: ' + (wl.go ? 'GO' : 'NO-GO' + (wl.why && wl.why.length ? ' (' + wl.why.join(', ') + ')' : '')) : wl.src === 'climate' && wl.p !== null ? 'Weather: ' + pct(wl.p) + ' of past days were GO' : '';
    var head = '<span class="' + (lo.crew ? 'crewtag' : '') + '"><b>' + (lo.crew ? 'Crewed launch' : 'Robotic launch') + '</b> · ' + fmtDate(launchMs, true) + ' · local ' + localTime(launchMs) + '</span>';
    var altT = LL.alt < 1000 ? Math.round(LL.alt) + ' m' : (LL.alt/1000).toFixed(1) + ' km';
    surfHud.innerHTML = LL.ts < 0
      ? head + '<span>T− <b>' + Math.ceil(-LL.ts) + ' s</b></span>' + (LL.event ? '<span>' + LL.event + '</span>' : '') + '<span>' + sunTxt + '</span>' + (wxTxt ? '<span>' + wxTxt + '</span>' : '')
      : head + '<span>T+ <b>' + Math.floor(LL.t) + ' s</b></span><span>Altitude <b>' + altT + '</b></span><span>Speed <b>' + Math.round(LL.v*3.6).toLocaleString('en-US') + ' km/h</b></span><span>Downrange <b>' + (LL.x/1000).toFixed(LL.x < 10000 ? 1 : 0) + ' km</b></span><span>' + LL.event + '</span><span>Replay ×' + Math.max(1, Math.round(LL.rate)) + '</span>';
    $('#surfWho').textContent = lo.LS.name.split(' (')[0];
    $('#surfNote').textContent = 'Sun: real for this time and place · rocket and ascent: illustrative';
    return;
  }
  var site = R.site, fiNow = nowIndex(), LS = landState(performance.now()), LF = liftState(performance.now()), before = !LS && !LF && fiNow < R.iL - 0.5, fi = LS ? R.iL : Math.max(fiNow, R.iL);
  var lifted = !LF && active === 'crewed' && mission && met >= mission.tLift;
  $('#watchLift').hidden = active !== 'crewed';
  if (look.follow === 'sun') look.az = skyInterp(site, fi).sunAz;
  else if (look.follow === 'earth') look.az = skyInterp(site, fi).earthAz;
  else if (look.follow === 'auto' || look.az === null) look.az = autoAz(site, fi);
  var onSurface = active === 'crewed' && mission && !LS && !LF && met > mission.tLand + 2*3600 && met < mission.tLift - 3600;
  var out = drawPanorama(c, w, h, site, fi, {az: look.az, fov: look.fov, land: LS, lift: LF, baseOnly: lifted, noLander: before, walk: onSurface});
  if (LF){
    surfHud.innerHTML = LF.ts < 0
      ? '<span><b>Liftoff</b> · ' + site.name + ' · ' + fmtDate(tabTime(0) + fi*3600000) + '</span><span>Ascent engine: ignition in <b>' + Math.ceil(-LF.ts) + ' s</b></span><span>The descent stage stays as the launch pad</span>'
      : '<span><b>Liftoff</b> · ' + site.name + '</span><span>Altitude <b>' + Math.round(LF.alt).toLocaleString('en-US') + ' m</b></span><span>Climbing <b>' + LF.v.toFixed(1) + ' m/s</b></span><span>T+ <b>' + Math.round(LF.t) + ' s</b></span><span>' + (LF.t < 10 ? 'Straight up' : 'Pitching over toward orbit') + '</span><span>Replay about 2× real time</span>';
    $('#surfWho').textContent = site.name;
    $('#surfNote').textContent = 'Horizon: ' + hzLabel(site) + ' · ascent stage, flakes and plume illustrative · ascent camera: real LRO image';
    drawAscentCam(c, w, h, site, LF);
    return;
  }
  if (LS){
    var tmm = Math.floor(LS.tau/60), tss = Math.round(LS.tau % 60);
    surfHud.innerHTML = LS.flying
      ? '<span><b>Powered descent</b> · ' + site.name + '</span><span>Altitude <b>' + Math.round(LS.alt).toLocaleString('en-US') + ' m</b></span><span>Descending <b>' + LS.vs.toFixed(1) + ' m/s</b></span><span>Touchdown in <b>' + (tmm ? tmm + ' min ' : '') + tss + ' s</b></span><span>Replay about 8× real time</span>'
      : '<span class="good"><b>Touchdown</b> · ' + site.name + ' · ' + fmtDate(tabTime(R.iL)) + '</span><span class="' + (out.sunUp ? 'good' : 'bad') + '">Sun <b>' + Math.abs(out.sunAlt).toFixed(2) + '°</b> ' + (out.sunAlt >= 0 ? 'above' : 'below') + ' the terrain horizon</span><span class="' + (out.earthUp ? 'good' : 'bad') + '">' + (out.earthUp ? 'Earth in view: direct link' : 'Earth below the terrain') + '</span><span>Engine off</span>';
    $('#surfWho').textContent = site.name;
    $('#surfNote').textContent = 'Horizon: ' + hzLabel(site) + ' · lander and dust illustrative · descent camera: real LRO image';
    drawDescentCam(c, w, h, site, LS);
    return;
  }
  var sk = out.sk, sunT = hoursTo(site, fi, 'sun'), earT = hoursTo(site, fi, 'earth');
  var shadow = sk.sunEl > 0.05 && out.sunUp ? 3/Math.tan(sk.sunEl*DEG) : null;
  $('#surfWho').textContent = site.name;
  surfHud.innerHTML =
    '<span><b>' + fmtDate(tabTime(0) + fi*3600000) + '</b>' + (before ? ' · lander arrives in ' + dh(R.iL - fiNow) : '') + '</span>' +
    '<span class="' + (out.sunUp ? 'good' : 'bad') + '">Sun <b>' + sgn(sk.sunEl, 2) + '°</b> az ' + Math.round(sk.sunAz) + '° · ' + (sunT.up ? 'sets in ' : 'rises in ') + (sunT.capped ? '> 60 d' : dh(sunT.h)) + '</span>' +
    '<span class="' + (out.earthUp ? 'good' : 'bad') + '">Earth <b>' + sgn(sk.earthEl, 2) + '°</b> az ' + Math.round(sk.earthAz) + '° · ' + (out.earthUp ? 'direct link possible' : 'no direct link') + ' · ' + (earT.up ? 'sets in ' : 'rises in ') + (earT.capped ? '> 60 d' : dh(earT.h)) + '</span>' +
    '<span>Earth phase <b>' + Math.round(out.k*100) + '%</b> · ' + Math.round(sk.D).toLocaleString('en-US') + ' km</span>' +
    (shadow ? '<span>A 3 m lander casts a <b>' + (shadow > 999 ? Math.round(shadow/1000*10)/10 + ' km' : Math.round(shadow) + ' m') + '</b> shadow</span>' : '') +
    (lifted ? '<span>Crew left on ' + fmtDate(mission.landMs + (mission.tLift - mission.tLand)*1000) + '; the descent stage stays</span>' : '') +
    (onSurface ? '<span class="crewtag">Crew on the surface · day ' + (Math.floor((met - mission.tLand)/86400) + 1) + ' of ' + Math.ceil((mission.tLift - mission.tLand)/86400) + '</span>' : '');
  $('#surfNote').textContent = 'Horizon: ' + hzLabel(site) + ' (dashed: flat Moon)' + ' · foreground craters illustrative' + (enlarge > 1 ? ' · Sun and Earth drawn ×' + enlarge : '');
  drawMinis(fi);
}
var minisEl = $('#minis'), minisKey = '';
function drawMinis(fiArg){
  var list = results[active], key = active + '|' + list.map(function(r){ return r.site.id; }).join(',') + '|' + target[active];
  if (key !== minisKey){
    minisKey = key; minisEl.innerHTML = '';
    list.forEach(function(r){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'mini'; b.dataset.id = r.site.id;
      b.innerHTML = '<canvas></canvas><b></b><span class="status"></span>';
      b.querySelector('b').textContent = r.site.name;
      b.addEventListener('click', function(){ target[active] = r.site.id; recompute(); renderAll(); });
      minisEl.appendChild(b);
    });
  }
  if (!list.length) return;
  var fi = fiArg !== undefined ? fiArg : Math.max(nowIndex(), list[0].iL);
  $('#minisTitle').textContent = 'The same moment at your ' + list.length + ' ' + active + ' sites · ' + fmtDate(tabTime(0) + fi*3600000);
  Array.prototype.forEach.call(minisEl.children, function(b){
    var r = list.filter(function(x){ return x.site.id === b.dataset.id; })[0]; if (!r) return;
    b.setAttribute('aria-pressed', target[active] === r.site.id ? 'true' : 'false');
    var cv = b.querySelector('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth || 200, h = Math.round(w/2);
    if (cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var saveFov = look.fov; look.fov = 110;
    var az = autoAz(r.site, fi); look.fov = saveFov;
    var out = drawPanorama(c, w, h, r.site, fi, {az: az, fov: 110, mini: true});
    b.querySelector('.status').innerHTML = '<span class="chip ' + (out.sunUp ? 'up' : 'down') + '">Sun ' + sgn(out.sk.sunEl, 1) + '°</span><span class="chip ' + (out.earthUp ? 'up' : 'down') + '">Earth ' + sgn(out.sk.earthEl, 1) + '°</span>';
  });
}
(function(){
  var drag = null;
  surfC.addEventListener('pointerdown', function(e){ try { surfC.setPointerCapture(e.pointerId); } catch (err) {} drag = {x: e.clientX, az: look.az}; look.follow = 'manual'; setLookBtns(); });
  surfC.addEventListener('pointermove', function(e){ if (!drag) return; var pxDeg = surfWrap.clientWidth/look.fov; look.az = ((drag.az - (e.clientX - drag.x)/pxDeg) % 360 + 360) % 360; dirty = true; });
  function end(){ drag = null; }
  surfC.addEventListener('pointerup', end); surfC.addEventListener('pointercancel', end);
  surfC.addEventListener('wheel', function(e){ e.preventDefault(); look.fov = clamp(look.fov*Math.exp(e.deltaY*0.0012), 12, 150); dirty = true; }, {passive: false});
  surfC.addEventListener('keydown', function(e){
    if (e.key === 'ArrowLeft'){ look.az = (look.az + 355) % 360; look.follow = 'manual'; } else if (e.key === 'ArrowRight'){ look.az = (look.az + 5) % 360; look.follow = 'manual'; }
    else if (e.key === '+' || e.key === '='){ look.fov = clamp(look.fov/1.15, 12, 150); } else if (e.key === '-'){ look.fov = clamp(look.fov*1.15, 12, 150); } else return;
    e.preventDefault(); setLookBtns(); dirty = true;
  });
  var lookBtns = Array.prototype.slice.call(document.querySelectorAll('[data-look]'));
  function setLookBtns(){ lookBtns.forEach(function(b){ b.setAttribute('aria-pressed', look.follow === b.getAttribute('data-look') ? 'true' : 'false'); }); }
  lookBtns.forEach(function(b){ b.addEventListener('click', function(){ var f = b.getAttribute('data-look'); look.follow = look.follow === f ? 'auto' : f; setLookBtns(); dirty = true; }); });
  $('#enlarge').addEventListener('click', function(){ enlarge = enlarge > 1 ? 1 : 3; this.setAttribute('aria-pressed', enlarge > 1 ? 'true' : 'false'); dirty = true; });
})();
var phasesEl = $('#phases');
function renderPhases(){
  var M = mission, list = [['Ascent', 0, M.tAsc], ['Parking orbit', M.tAsc, M.tTLI], ['Earth → Moon', M.tTLI, M.tLOI], ['Lunar orbit', M.tLOI, M.tDOI], ['Descent', M.tDOI, M.tLand], [M.key === 'crewed' ? 'Surface stay' : 'Surface mission', M.tLand, M.tLift]];
  if (M.key === 'crewed') list.push(['Lunar ascent', M.tLift, M.tLLO2], ['Lunar orbit', M.tLLO2, M.tTEI], ['Moon → Earth', M.tTEI, M.tEnd]);
  phasesEl.innerHTML = '';
  list.forEach(function(p){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'phase'; b.setAttribute('role', 'listitem');
    var dur = (p[2] - p[1])/86400;
    b.innerHTML = '<span></span><small>' + (dur < 0.1 ? Math.round(dur*1440) + ' min' : t1(dur) + ' d') + '</small>';
    b.querySelector('span').textContent = p[0];
    b.addEventListener('click', function(){ met = p[1] + 1; syncMet(); dirty = true; });
    b.dataset.t0 = p[1]; b.dataset.t1 = p[2];
    phasesEl.appendChild(b);
  });
}
function markPhase(){
  Array.prototype.forEach.call(phasesEl.children, function(b){ var on = met >= +b.dataset.t0 && met < +b.dataset.t1; b.setAttribute('aria-current', on ? 'true' : 'false'); });
}

