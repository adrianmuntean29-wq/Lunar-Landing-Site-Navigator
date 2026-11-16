/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): panels:
   site ranking, fuel budget, vehicle, sites table, year chart, sky chart. */
/* =====================================================================
   panels
   ===================================================================== */
function renderRanks(){
  ['crewed', 'robotic'].forEach(function(k){
    var el = $(k === 'crewed' ? '#rankCrew' : '#rankRobot');
    el.innerHTML = '';
    if (!results[k].length){ el.innerHTML = '<li class="empty">No sites picked. Switch to this mission above and click sites on the map.</li>'; return; }
    var landMs = launchMs + missionTimes(k).land*86400000;
    results[k].forEach(function(r, i){
      var li = document.createElement('li'); li.className = 'ritem' + (target[k] === r.site.id ? ' target' : '');
      var A = r.at, st = r.stay, Y = r.Y;
      var sunTxt = (A.sunUp ? 'sets in ' : 'rises in ') + (A.sunCapped ? '> 60 d' : dh(A.sunNext));
      var earthTxt = (A.earthUp ? 'Earthset in ' : 'Earthrise in ') + (A.earthCapped ? '> 60 d' : dh(A.earthNext));
      var verdict = r.viable
        ? '<span class="verdict ok">✓ Viable for a landing on ' + fmtDate(landMs, false) + '</span>'
        : '<span class="verdict bad">✗ Not viable on ' + fmtDate(landMs, false) + ': ' + failText(r.ev, k) + (r.next >= 0 ? ' · next window ' + fmtDate(tabTime(r.next), false) + ' (+' + t1((r.next - r.iL)/24) + ' d)' : ' · no window in the next year') + '</span>';
      li.innerHTML = '<span class="rnum">' + (i + 1) + '</span><span class="rname"></span>' +
        '<span class="rscore">' + Math.round(r.score) + '<small>score</small></span>' +
        '<span class="status"><span class="chip ' + (A.sunUp ? 'up' : 'down') + '">Sun <b class="big">' + sgn(A.sunEl, 1) + '°</b></span><span>' + sunTxt + '</span>' +
        '<span class="chip ' + (A.earthUp ? 'up' : 'down') + '">Earth <b class="big">' + sgn(A.earthEl, 1) + '°</b></span><span>' + (A.earthEl < -20 && !A.earthUp ? 'never in view' : earthTxt) + '</span></span>' +
        verdict +
        '<span class="rmetrics"><span class="s">' + (k === 'crewed' ? 'Sun during stay' : 'Sun during mission') + ' <b>' + pct(st.sun) + '</b></span>' +
        '<span class="e">Earth during ' + (k === 'crewed' ? 'stay' : 'mission') + ' <b>' + pct(st.earth) + '</b></span>' +
        '<span class="' + (r.windows ? '' : 'bad') + '">windows/yr <b>' + r.windows + '</b></span>' +
        '<span>longest night <b>' + (Y.night >= 364 ? 'all year' : t1(Y.night) + ' d') + '</b></span></span>';
      var rn = li.querySelector('.rname');
      var nm = document.createElement('span'); nm.textContent = r.site.name; rn.appendChild(nm);
      var sm = document.createElement('small'); sm.textContent = fmt(r.site.lat, 2) + '°, ' + fmt(r.site.lon, 2) + '° · ' + (r.site.g || '') + ' · ' + hzLabel(r.site); rn.appendChild(sm);
      var btns = document.createElement('span'); btns.className = 'btns';
      function btn(label, fn, primary){ var b = document.createElement('button'); b.type = 'button'; b.className = 'fly'; if (primary) b.style.cssText = ''; b.textContent = label; b.addEventListener('click', fn); btns.appendChild(b); }
      btn(target[k] === r.site.id && active === k ? 'Shown in the simulation' : 'Show in the simulation', function(){ target[k] = r.site.id; setActive(k); });
      if (!r.viable && r.next >= 0) btn('Move launch to next window', function(){ target[k] = r.site.id; planFor(k, r.next); setActive(k); });
      if (r.best >= 0 && r.best !== r.iL) btn('Move launch to best window', function(){ target[k] = r.site.id; planFor(k, r.best); setActive(k); });
      li.appendChild(btns);
      el.appendChild(li);
    });
  });
}
function renderBudget(){
  var a = budgets.crewed, b = budgets.robotic, rows = [];
  function row(lbl, va, vb, d, cls){ rows.push('<tr class="' + (cls || '') + '"><td class="lbl">' + lbl + '</td><td class="num crew">' + va + '</td><td class="num robot">' + vb + '</td></tr>'); }
  function n(v, d){ return v === 0 ? '—' : v.toFixed(d === undefined ? 2 : d); }
  rows.push('<tr><th>Item</th><th class="num crew">Crewed</th><th class="num robot">Robotic</th></tr>');
  row('Launch to ' + a.P.parkingAlt + ' km orbit from ' + a.L.name + ' <small>(incl. ' + C.launchLosses.toFixed(1) + ' losses, minus ' + a.vRot.toFixed(2) + ' from Earth\'s spin)</small>', n(a.dv.ascent), n(b.dv.ascent));
  row('Translunar injection (TLI)', n(a.dv.tli), n(b.dv.tli));
  row('Mid-course corrections', n(a.dv.mcc), n(b.dv.mcc));
  row('Lunar orbit insertion into ' + a.P.lloAlt + ' km polar orbit <small>(arrival v∞ ' + a.vinf.toFixed(2) + ' / ' + b.vinf.toFixed(2) + ')</small>', n(a.dv.loi), n(b.dv.loi));
  row('Powered descent and landing <small>(incl. hover reserve)</small>', n(a.dv.descent), n(b.dv.descent));
  row('Lunar ascent and rendezvous', n(a.dv.lunarAscent), n(b.dv.lunarAscent));
  row('Trans-Earth injection (return)', n(a.dv.tei), n(b.dv.tei));
  row('Total Δv after Earth orbit', n(a.dv.space), n(b.dv.space), 2, 'total');
  row('Reserve applied to stage sizing', Math.round(a.P.reserve*100) + '%', Math.round(b.P.reserve*100) + '%');
  row('Mass needed in Earth orbit', a.mass.ok ? t1(a.mass.leo) + ' t' : 'not feasible', b.mass.ok ? t1(b.mass.leo) + ' t' : 'not feasible', 0, 'total');
  row('… per tonne delivered to the surface', a.mass.ok ? t1(a.mass.leo/a.mass.landed) + ' t' : '—', b.mass.ok ? t1(b.mass.leo/b.mass.landed) + ' t' : '—');
  row('Earth–Moon distance on arrival <small>(mean 384,400 km; closer = less Δv)</small>', Math.round(a.D).toLocaleString('en-US') + ' km', Math.round(b.D).toLocaleString('en-US') + ' km');
  row('Earth → Moon transfer time', t1(a.tr.tof) + ' d', t1(b.tr.tof) + ' d');
  row('Launch → landing', t1(missionTimes('crewed').land) + ' d', t1(missionTimes('robotic').land) + ' d');
  row(a.P.stayLabel + ' / ' + b.P.stayLabel.toLowerCase(), t1(a.P.stay) + ' d', t1(b.P.stay) + ' d');
  row('Whole mission', t1(missionTimes('crewed').end) + ' d (to Earth entry)', t1(missionTimes('robotic').end) + ' d');
  row('Earth entry speed', a.entry.toFixed(2), '—');
  function azTxt(x){ return Math.abs(x.az - 90) < 0.5 ? '<span class="flag ok">due east</span>' : 'azimuth ' + Math.round(x.az) + '°'; }
  row('Parking orbit ' + t1(a.incl) + '° · Moon declination on arrival ' + sgn(a.decArr, 1) + '°', azTxt(a), azTxt(b));
  $('#budget').innerHTML = rows.join('');
}
function missionTimes(k){
  var B = budgets[k], P = B.P, PLEO = 2*Math.PI*Math.sqrt(B.r1*B.r1*B.r1/C.muE);
  var tTLI = (600 + (2*Math.PI - Math.PI/2 - 2*Math.PI*600/PLEO)/(2*Math.PI)*PLEO)/86400;
  var land = tTLI + B.tr.tof + P.lloBefore;
  var end = k === 'crewed' ? land + P.stay + P.lloAfter + B.tr.tof : land + P.stay;
  return {land: land, end: end};
}
function renderVehicle(){
  var el = $('#vehicle');
  if (el.childElementCount) return;
  var fields = [
    ['Crewed: masses (t)', [['crewed', 'mass', 'capsule', 'Crew capsule'], ['crewed', 'mass', 'cabin', 'Ascent cabin + crew'], ['crewed', 'mass', 'cargo', 'Surface cargo']]],
    ['Crewed: engines', [['crewed', 'eng.sm', 'isp', 'Service module Isp (s)'], ['crewed', 'eng.desc', 'isp', 'Descent Isp (s)'], ['crewed', 'eng.asc', 'isp', 'Ascent Isp (s)'], ['crewed', null, 'reserve', 'Δv reserve (0–1)']]],
    ['Robotic', [['robotic', 'mass', 'rover', 'Rover / payload (t)'], ['robotic', 'eng.lander', 'isp', 'Lander Isp (s)'], ['robotic', 'eng.lander', 'k', 'Lander dry / propellant'], ['robotic', null, 'reserve', 'Δv reserve (0–1)']]],
    ['Both', [['both', 'eng.tli', 'isp', 'TLI stage Isp (s)'], ['both', 'eng.tli', 'k', 'TLI stage dry / propellant'], ['both', 'lloAlt', null, 'Lunar orbit altitude (km)'], ['both', 'launch', null, 'Launch losses (km/s)']]]
  ];
  fields.forEach(function(fs){
    var f = document.createElement('fieldset'), lg = document.createElement('legend'); lg.textContent = fs[0]; f.appendChild(lg);
    fs[1].forEach(function(d, i){
      var id = 'v_' + fs[0].replace(/\W/g, '') + i, lab = document.createElement('label'), inp = document.createElement('input');
      lab.setAttribute('for', id); lab.textContent = d[3]; inp.id = id; inp.type = 'number'; inp.step = 'any';
      function getObj(k){ var o = PROFILES[k]; if (d[1] && d[1] !== 'lloAlt' && d[1] !== 'launch') d[1].split('.').forEach(function(p){ o = o[p]; }); return o; }
      var cur;
      if (d[1] === 'lloAlt') cur = PROFILES.crewed.lloAlt; else if (d[1] === 'launch') cur = C.launchLosses;
      else cur = getObj(d[0] === 'both' ? 'crewed' : d[0])[d[2]];
      inp.value = cur;
      inp.addEventListener('change', function(){
        var v = parseFloat(inp.value); if (!isFinite(v)) return;
        var keys = d[0] === 'both' ? ['crewed', 'robotic'] : [d[0]];
        keys.forEach(function(k){
          if (d[1] === 'lloAlt') PROFILES[k].lloAlt = v; else if (d[1] === 'launch') C.launchLosses = v;
          else getObj(k)[d[2]] = v;
        });
        recompute(); renderAll();
      });
      lab.appendChild(inp); f.appendChild(lab);
    });
    el.appendChild(f);
  });
}
function renderSitesTable(){
  var rows = ['<tr><th>Crewed</th><th>Robotic</th><th>Site</th><th class="num">Lat</th><th class="num">Lon</th><th class="num">Horizon °</th><th class="num">Sun/yr</th><th class="num">Earth/yr</th><th class="num">Longest night</th><th>Reference</th><th></th></tr>'];
  SITES.forEach(function(s){
    var Y = analyse(s, active).Y;
    rows.push('<tr data-id="' + s.id + '">' +
      '<td><input type="checkbox" class="crewcol" data-k="crewed" aria-label="Crewed pick"' + (picks.crewed.indexOf(s.id) >= 0 ? ' checked' : '') + '></td>' +
      '<td><input type="checkbox" class="robotcol" data-k="robotic" aria-label="Robotic pick"' + (picks.robotic.indexOf(s.id) >= 0 ? ' checked' : '') + '></td>' +
      '<td><span class="nm"></span><br><small>' + (s.g ? s.g + ' · ' : '') + s.kind + '</small></td>' +
      '<td class="num">' + fmt(s.lat, 2) + '</td><td class="num">' + fmt(s.lon, 2) + '</td>' +
      '<td class="num">' + (prepSite(s)._mask ? '<small>LOLA</small>' : '<input type="number" step="0.5" value="' + s.horizon + '" aria-label="Local horizon in degrees">') + '</td>' +
      '<td class="num">' + pct(Y.sunYear) + '</td><td class="num">' + pct(Y.earthYear) + '</td><td class="num">' + (Y.night >= 364 ? 'all year' : t1(Y.night) + ' d') + '</td>' +
      '<td><small class="rf"></small></td>' +
      '<td>' + (s.custom ? '<button type="button" class="del" aria-label="Remove custom site">×</button>' : '') + '</td></tr>');
  });
  var tb = $('#sitesTable'); tb.innerHTML = rows.join('');
  Array.prototype.forEach.call(tb.querySelectorAll('tr[data-id]'), function(tr){
    var s = siteById(tr.getAttribute('data-id'));
    tr.querySelector('.nm').textContent = s.name; tr.querySelector('.rf').textContent = s.ref;
    Array.prototype.forEach.call(tr.querySelectorAll('input[type=checkbox]'), function(cb){
      cb.addEventListener('change', function(){
        var k = cb.getAttribute('data-k'), list = picks[k], i = list.indexOf(s.id);
        msgEl.textContent = '';
        if (cb.checked && i < 0){ if (list.length >= 5){ cb.checked = false; msgEl.textContent = 'Already 5 ' + k + ' sites. Remove one first.'; return; } list.push(s.id); }
        if (!cb.checked && i >= 0) list.splice(i, 1);
        recompute(); renderAll();
      });
    });
    var hin = tr.querySelector('input[type=number]');
    if (hin) hin.addEventListener('change', function(e){ var v = parseFloat(e.target.value); if (isFinite(v)){ s.horizon = v; recompute(); renderAll(); } });
    var del = tr.querySelector('.del');
    if (del) del.addEventListener('click', function(){
      SITES.splice(SITES.indexOf(s), 1);
      ['crewed', 'robotic'].forEach(function(k){ var i = picks[k].indexOf(s.id); if (i >= 0) picks[k].splice(i, 1); });
      recompute(); renderAll();
    });
  });
}
var yearC = $('#year');
function drawYear(){
  var list = results[active], rowH = 30, top = 4, lab = 150, axis = 24;
  var hgt = top + Math.max(1, list.length)*rowH + axis;
  var dpr = Math.min(window.devicePixelRatio || 1, 2), w = yearC.clientWidth || 600;
  yearC.style.height = hgt + 'px';
  if (yearC.width !== Math.round(w*dpr) || yearC.height !== Math.round(hgt*dpr)){ yearC.width = Math.round(w*dpr); yearC.height = Math.round(hgt*dpr); }
  var y = yearC.getContext('2d'); y.setTransform(dpr, 0, 0, dpr, 0, 0); y.clearRect(0, 0, w, hgt);
  if (w < 520) lab = 92;
  var days = MODEL.year, pw = w - lab - 6, cw = pw/days, col = active === 'crewed' ? tok('--crew-fill') : tok('--robot-fill');
  var C2 = {ink: tok('--ink'), muted: tok('--muted'), line: tok('--line'), sun: tok('--sun-fill'), earth: tok('--earth-fill'), mono: tok('--f-mono')};
  $('#yearWho').textContent = active;
  var i0 = list.length ? list[0].iL : 0;
  list.forEach(function(r, i){
    var y0 = top + i*rowH;
    y.font = (target[active] === r.site.id ? '600 ' : '500 ') + '11.5px ' + C2.mono; y.fillStyle = target[active] === r.site.id ? C2.ink : C2.muted;
    y.textAlign = 'left'; y.textBaseline = 'middle';
    var nm = (i + 1) + ' ' + r.site.name; while (y.measureText(nm).width > lab - 10 && nm.length > 4) nm = nm.slice(0, -2) + '…';
    y.fillText(nm, 0, y0 + 11);
    y.fillStyle = C2.line; y.fillRect(lab, y0, pw, 8); y.fillRect(lab, y0 + 10, pw, 6); y.fillRect(lab, y0 + 18, pw, 4);
    for (var d = 0; d < days; d++){
      var ss = 0, ee = 0, vv = 0, cnt = 0;
      for (var h = 0; h < 24; h++){ var q = r.iL + d*24 + h; if (q >= TAB.n) break; ss += r.Y.sunF[q]; ee += r.Y.earthOK[q]; vv += r.valid[q]; cnt++; }
      if (!cnt) break;
      if (ss > 0.2){ y.globalAlpha = ss/cnt; y.fillStyle = C2.sun; y.fillRect(lab + d*cw, y0, cw + 0.6, 8); }
      if (ee > 0.2){ y.globalAlpha = ee/cnt; y.fillStyle = C2.earth; y.fillRect(lab + d*cw, y0 + 10, cw + 0.6, 6); }
      if (vv > 0){ y.globalAlpha = 1; y.fillStyle = col; y.fillRect(lab + d*cw, y0 + 18, cw + 0.6, 4); }
    }
    y.globalAlpha = 1;
    if (r.best >= 0 && target[active] === r.site.id){ var x = lab + (r.best - r.iL)/24*cw; y.strokeStyle = C2.ink; y.lineWidth = 2; y.beginPath(); y.moveTo(x, y0 - 2); y.lineTo(x, y0 + 24); y.stroke(); }
  });
  var yA = top + Math.max(1, list.length)*rowH, t0 = tabTime(i0), t1ms = t0 + days*86400000;
  y.font = '500 10.5px ' + C2.mono; y.fillStyle = C2.muted; y.textBaseline = 'top'; y.strokeStyle = C2.line; y.lineWidth = 1;
  var d0 = new Date(t0), m = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1)), lastX = -99;
  while (m.getTime() < t1ms){
    var x2 = lab + (m.getTime() - t0)/86400000*cw;
    y.beginPath(); y.moveTo(x2 + 0.5, yA - 2); y.lineTo(x2 + 0.5, yA + 3); y.stroke();
    if (x2 - lastX > 34){ y.textAlign = 'center'; y.fillText(MON[m.getUTCMonth()] + (m.getUTCMonth() === 0 ? ' ' + String(m.getUTCFullYear()).slice(2) : ''), x2, yA + 5); lastX = x2; }
    m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1));
  }
  y.textAlign = 'left'; y.fillStyle = C2.ink; y.fillText('landing', lab, yA + 5 + 11);
}
var skyC = $('#sky');
function drawSky(){
  var R = results[active].filter(function(r){ return r.site.id === target[active]; })[0];
  var dpr = Math.min(window.devicePixelRatio || 1, 2), w = skyC.clientWidth || 600, h = 240;
  if (skyC.width !== Math.round(w*dpr) || skyC.height !== Math.round(h*dpr)){ skyC.width = Math.round(w*dpr); skyC.height = Math.round(h*dpr); }
  var c = skyC.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  if (!R){ $('#skyWho').textContent = 'the site'; $('#skyCaption').textContent = 'Pick a site to see its sky.'; return; }
  var s = R.site, fr = siteFrame(s), S = R.S, iL = R.iL, step = S > 240 ? 6 : 2;
  var K = {ink: tok('--ink'), muted: tok('--muted'), line: tok('--line'), sun: tok('--sun-fill'), earth: tok('--earth-fill'), sunT: tok('--sun'), earthT: tok('--earth'), mono: tok('--f-mono'), sky: tok('--panel'), ground: tok('--line')};
  prepSite(s);
  var pMin = 99, pMax = -99; for (var pa = 0; pa < 360; pa += 2){ var pv = hzAt(s, pa); pMin = Math.min(pMin, pv); pMax = Math.max(pMax, pv); }
  var sunP = [], earP = [], hi = pMax + 4, lo = Math.min(-4, pMin - 2);
  for (var i = iL; i <= iL + S; i += step){ var k = skyAt(s, i, fr); sunP.push([k.sunAz, k.sunEl, i]); earP.push([k.earthAz, k.earthEl, i]); hi = Math.max(hi, k.sunEl + 2, k.earthEl + 2); }
  var yMax = clamp(Math.ceil(hi), 6, 90), yMin = Math.max(-12, Math.floor(lo));
  var nowI = clamp(Math.round((launchMs - TAB.t0)/3600000 + met/3600), iL, iL + S), now = skyAt(s, nowI, fr);
  var pl = 40, pr = 10, pt = 10, pb = 26, pw = w - pl - pr, ph = h - pt - pb;
  function X(az){ var r = ((az + 180) % 360 + 360) % 360 - 180; return pl + (r + 180)/360*pw; }
  function Yv(el){ return pt + (yMax - clamp(el, yMin, yMax))/(yMax - yMin)*ph; }
  c.fillStyle = K.sky; c.fillRect(pl, pt, pw, ph);
  var st = (yMax - yMin) > 40 ? 15 : (yMax - yMin) > 16 ? 5 : 2;
  c.font = '500 10.5px ' + K.mono; c.textAlign = 'right'; c.textBaseline = 'middle';
  for (var g = Math.ceil(yMin/st)*st; g <= yMax; g += st){ c.strokeStyle = K.line; c.lineWidth = 1; c.beginPath(); c.moveTo(pl, Yv(g) + 0.5); c.lineTo(pl + pw, Yv(g) + 0.5); c.stroke(); c.fillStyle = K.muted; c.fillText((g > 0 ? '+' : g < 0 ? '−' : '') + Math.abs(g) + '°', pl - 5, Yv(g)); }
  c.beginPath(); c.moveTo(pl, pt + ph);
  for (var xx = 0; xx <= pw; xx += 2) c.lineTo(pl + xx, Yv(hzAt(s, xx/pw*360 - 180)));
  c.lineTo(pl + pw, pt + ph); c.closePath(); c.globalAlpha = 0.85; c.fillStyle = K.ground; c.fill(); c.globalAlpha = 1;
  c.strokeStyle = K.ink; c.lineWidth = 1.2; c.beginPath();
  for (xx = 0; xx <= pw; xx += 2){ var yy0 = Yv(hzAt(s, xx/pw*360 - 180)) + 0.5; if (xx) c.lineTo(pl + xx, yy0); else c.moveTo(pl, yy0); }
  c.stroke();
  c.setLineDash([3, 3]); c.strokeStyle = K.muted; c.beginPath(); c.moveTo(pl, Yv(0) + 0.5); c.lineTo(pl + pw, Yv(0) + 0.5); c.stroke(); c.setLineDash([]);
  function track(P, color){
    c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); var started = false, px = 0;
    P.forEach(function(p){ var x = X(p[0]), yy = Yv(p[1]); if (!started || Math.abs(x - px) > pw/2){ c.moveTo(x, yy); started = true; } else c.lineTo(x, yy); px = x; });
    c.stroke();
    var a = P[0]; c.fillStyle = color; c.beginPath(); c.arc(X(a[0]), Yv(a[1]), 3, 0, Math.PI*2); c.fill();
  }
  track(sunP, K.sun); track(earP, K.earth);
  function body(az, el, color, label, up, txtCol){
    var x = X(az), yy = Yv(el); c.beginPath(); c.arc(x, yy, 6.5, 0, Math.PI*2); c.lineWidth = 2.2; c.strokeStyle = color; c.stroke();
    if (up){ c.fillStyle = color; c.fill(); }
    c.font = '600 11px ' + K.mono; c.textBaseline = 'middle'; var tw = c.measureText(label).width, tx = x + 10;
    c.textAlign = 'left'; if (tx + tw > pl + pw) tx = x - 10 - tw; c.fillStyle = txtCol; c.fillText(label, tx, yy - (el > yMax || el < yMin ? 0 : 0));
  }
  body(now.earthAz, now.earthEl, K.earth, 'Earth ' + sgn(now.earthEl, 1) + '°' + (now.earthEl < yMin ? ' (below)' : ''), now.earthEl - hzAt(s, now.earthAz) > -EARTH_R, K.earthT);
  body(now.sunAz, now.sunEl, K.sun, 'Sun ' + sgn(now.sunEl, 1) + '°', now.sunEl - hzAt(s, now.sunAz) > 0, K.sunT);
  c.strokeStyle = K.line; c.strokeRect(pl + 0.5, pt + 0.5, pw - 1, ph - 1);
  c.font = '500 10.5px ' + K.mono; c.fillStyle = K.muted; c.textBaseline = 'top';
  [[-180, 'S'], [-90, 'W'], [0, 'N'], [90, 'E'], [180, 'S']].forEach(function(o){ var x = pl + (o[0] + 180)/360*pw; c.textAlign = o[0] === -180 ? 'left' : o[0] === 180 ? 'right' : 'center'; c.fillText(o[1] + (o[0] === 0 ? ' (lunar north)' : ''), x, pt + ph + 6); });
  $('#skyWho').textContent = s.name;
  $('#skyCaption').textContent = 'Tracks over the ' + (active === 'crewed' ? 'stay' : 'mission') + ' from ' + fmtDate(tabTime(iL), false) + ' (dot = landing). Circles: ' + fmtDate(tabTime(nowI)) + '. Grey: ' + (s._mask ? 'LOLA terrain horizon (' + mast + ' m mast)' : 'assumed flat horizon at ' + sgn(s.horizon, 1) + '°') + '; dashed: 0°.';
}
