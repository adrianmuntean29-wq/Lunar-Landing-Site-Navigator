/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): launch
   dates: when to leave Earth (geometry, delta-v, landing verdict, Open-Meteo weather). */
/* =====================================================================
   launch windows: when to leave Earth (geometry, Δv, landing site, weather)
   ===================================================================== */
var WEATHER = {gustMax: 15, precipMax: 1.0, snowMax: 0.5, tMin: -10, noCodes: [56, 57, 66, 67, 95, 96, 99], climateYears: [2015, 2024]};
var SITE_TZ = {ns: 'America/Halifax', ksc: 'America/New_York', csg: 'America/Cayenne'};
function n360(x){ x %= 360; return x < 0 ? x + 360 : x; }
function gmstDeg(ms){ return n360(280.46061837 + 360.98564736629*(ms/86400000 + 2440587.5 - 2451545.0)); }
function moonRADec(ms){
  var e = EPH.at(new Date(ms)), T = (EPH.jd(new Date(ms)) - 2451545)/36525, eps = (23.4392911 - 0.0130042*T)*DEG;
  var l = e.moonEcl.lon*DEG, b = e.moonEcl.lat*DEG;
  var dec = Math.asin(Math.sin(b)*Math.cos(eps) + Math.cos(b)*Math.sin(eps)*Math.sin(l));
  var ra = Math.atan2(Math.sin(l)*Math.cos(eps) - Math.tan(b)*Math.sin(eps), Math.cos(l));
  return {ra: n360(ra/DEG), dec: dec/DEG, dist: e.earth.dist};
}
function tliDays(key){
  var P = PROFILES[key], r1 = C.RE + P.parkingAlt, PLEO = 2*Math.PI*Math.sqrt(r1*r1*r1/C.muE);
  return (600 + (2*Math.PI - Math.PI/2 - 2*Math.PI*600/PLEO)/(2*Math.PI)*PLEO)/86400;
}
function arrivalDist(key, tMs){
  if (!TAB) return C.dEM;
  var t = tMs === undefined ? launchMs : tMs, P = PROFILES[key];
  var i = (t - TAB.t0)/3600000 + (tliDays(key) + Math.min(P.tof, 5))*24;
  i = clamp(Math.round(i), 0, TAB.n - 1);
  return TAB.ed[i];
}
/* daily launch opportunities: times when the parking-orbit plane contains the Moon's position at arrival */
function launchOpps(dayMs, key){
  var L = LAUNCH_SITES[launchIdx], phi = L.lat, lam = L.lon, out = [];
  var arrive = (tliDays(key) + Math.min(PROFILES[key].tof, 5))*86400000;
  [0, 1].forEach(function(branch){
    var t = dayMs + 12*3600000, info = null;
    for (var it = 0; it < 3; it++){
      var m = moonRADec(t + arrive), inc = Math.max(Math.abs(phi), Math.abs(m.dec) + 0.3);
      var x = Math.asin(clamp(-Math.tan(m.dec*DEG)/Math.tan(inc*DEG), -1, 1))/DEG;
      var Om = branch === 0 ? m.ra + x : m.ra + 180 - x;
      var u0 = Math.asin(clamp(Math.sin(phi*DEG)/Math.sin(inc*DEG), -1, 1));
      var raSite = Om + Math.atan2(Math.cos(inc*DEG)*Math.sin(u0), Math.cos(u0))/DEG;
      var g = n360(raSite - lam), dt = n360(g - gmstDeg(dayMs))/360.98564736629*86400000;
      t = dayMs + dt;
      var sinAz = clamp(Math.cos(inc*DEG)/Math.cos(phi*DEG), -1, 1);
      info = {t: Math.round(t/60000)*60000, inc: inc, az: Math.asin(sinAz)/DEG, dec: m.dec};
    }
    if (info.t >= dayMs && info.t < dayMs + 86400000) out.push(info);
  });
  out.sort(function(a, b){ return a.t - b.t; });
  return out;
}
/* ---------- weather: Open-Meteo (forecast 16 days + 10-year climatology) ---------- */
var wx = {site: null, climo: null, fc: {}, status: 'Weather not loaded yet', version: 0};
function wxGo(d){
  var why = [];
  if (d.gust != null && d.gust > WEATHER.gustMax) why.push('gusts ' + Math.round(d.gust) + ' m/s');
  if (d.precip != null && d.precip > WEATHER.precipMax) why.push('rain ' + d.precip.toFixed(1) + ' mm');
  if (d.snow != null && d.snow > WEATHER.snowMax) why.push('snow');
  if (d.tmin != null && d.tmin < WEATHER.tMin) why.push('cold ' + Math.round(d.tmin) + ' °C');
  if (d.code != null && WEATHER.noCodes.indexOf(d.code) >= 0) why.push(d.code >= 95 ? 'thunderstorm' : 'freezing rain');
  return {go: why.length === 0, why: why};
}
function loadWeather(){
  var L = LAUNCH_SITES[launchIdx], key = L.id;
  if (wx.site === key) return;   /* one attempt per launch site */
  wx = {site: key, climo: null, fc: {}, status: 'Loading weather for ' + L.name + '…', version: wx.version + 1, loading: true};
  var vars = 'daily=weather_code,precipitation_sum,snowfall_sum,wind_gusts_10m_max,temperature_2m_min&wind_speed_unit=ms&timezone=UTC';
  var base = 'latitude=' + L.lat + '&longitude=' + L.lon + '&';
  function rows(j){
    var d = j && j.daily, out = [];
    if (!d || !d.time) return out;
    for (var i = 0; i < d.time.length; i++) out.push({date: d.time[i], code: d.weather_code[i], precip: d.precipitation_sum[i], snow: d.snowfall_sum[i], gust: d.wind_gusts_10m_max[i], tmin: d.temperature_2m_min[i]});
    return out;
  }
  var y0 = WEATHER.climateYears[0], y1 = WEATHER.climateYears[1];
  function get(url){
    var ctl = window.AbortController ? new AbortController() : null, tm = ctl && setTimeout(function(){ ctl.abort(); }, 20000);
    return fetch(url, ctl ? {signal: ctl.signal} : {}).then(function(r){ clearTimeout(tm); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  var pc = get('https://archive-api.open-meteo.com/v1/archive?' + base + 'start_date=' + y0 + '-01-01&end_date=' + y1 + '-12-31&' + vars)
    .then(function(j){
      if (wx.site !== key) return;
      var go = new Float64Array(366), n = new Float64Array(366);
      rows(j).forEach(function(r){
        if (r.gust == null && r.precip == null) return;
        var dt = new Date(r.date + 'T00:00:00Z'), doy = Math.floor((dt - Date.UTC(dt.getUTCFullYear(), 0, 1))/86400000);
        go[Math.min(doy, 365)] += wxGo(r).go ? 1 : 0; n[Math.min(doy, 365)] += 1;
      });
      var climo = new Float32Array(366);
      for (var d = 0; d < 366; d++){ var a = 0, b = 0; for (var k = -7; k <= 7; k++){ var q = (d + k + 366) % 366; a += go[q]; b += n[q]; } climo[d] = b ? a/b : NaN; }
      wx.climo = climo;
    });
  var pf = get('https://api.open-meteo.com/v1/forecast?' + base + vars + '&forecast_days=16')
    .then(function(j){ if (wx.site !== key) return; rows(j).forEach(function(r){ wx.fc[r.date] = r; }); });
  Promise.allSettled([pc, pf]).then(function(res){
    if (wx.site !== key) return;
    wx.loading = false;
    var okC = res[0].status === 'fulfilled' && wx.climo, okF = res[1].status === 'fulfilled' && Object.keys(wx.fc).length;
    wx.status = okC || okF
      ? 'Weather: ' + (okF ? 'Open-Meteo forecast for the next 16 days' : 'no forecast') + ' + ' + (okC ? 'launch-day statistics ' + y0 + '–' + y1 + ' (ERA5)' : 'no climate statistics')
      : 'Weather could not be loaded (needs an internet connection). Dates are ranked without weather.';
    wx.version++; lwKey = '';
    if (autoBest) applyBest(); else renderWindows();
  });
}
function wxFor(tMs){
  var d = new Date(tMs), iso = d.toISOString().slice(0, 10), f = wx.fc[iso];
  if (f){ var g = wxGo(f); return {p: g.go ? 0.95 : 0.05, src: 'forecast', go: g.go, why: g.why, d: f}; }
  if (wx.climo){ var doy = Math.floor((tMs - Date.UTC(d.getUTCFullYear(), 0, 1))/86400000), p = wx.climo[Math.min(doy, 365)]; if (isFinite(p)) return {p: p, src: 'climate'}; }
  return {p: null, src: 'none'};
}
/* ---------- scan ---------- */
var lwRange = 120, lwKey = '', lwRes = null;
function scanWindows(){
  var key = active, site = siteById(target[active]);
  if (!site) return null;
  var P = PROFILES[key], S = Math.max(1, Math.round(P.stay*24)), Y = siteSeries(site), n = TAB.n;
  var landH = missionTimes(key).land*24, today = Math.floor(Date.now()/86400000)*86400000, start = Math.max(today + 86400000, TAB.t0 + 86400000);
  var cands = [], days = [];
  for (var d = 0; d < lwRange; d++){
    var day = start + d*86400000, opps = launchOpps(day, key), dayBest = null;
    opps.forEach(function(o){
      var iL = Math.round((o.t - TAB.t0)/3600000 + landH);
      if (iL < 0 || iL + S >= n) return;
      var ev = evalAt(Y, iL, S, key); if (!ev) return;
      var viable = ev.ok;
      var B = budget(key, o.t), dv = {D: B.D, space: B.dv.space, ascent: B.dv.ascent, leo: B.mass.leo}, w = wxFor(o.t);
      var siteQ = (key === 'crewed' ? ev.earth : ev.sun)/100;
      var c = {t: o.t, o: o, iL: iL, viable: viable, dv: dv, w: w, siteQ: siteQ, sunStay: ev.sun/100, earthStay: ev.earth/100};
      if (viable) cands.push(c);
      if (!dayBest || (c.viable && !dayBest.viable)) dayBest = c;
    });
    days.push({day: day, best: dayBest, n: opps.length});
  }
  var dvMin = Infinity, dvMax = -Infinity, mMin = Infinity;
  cands.forEach(function(c){ c.dvTot = c.dv.space + c.dv.ascent; dvMin = Math.min(dvMin, c.dvTot); dvMax = Math.max(dvMax, c.dvTot); mMin = Math.min(mMin, c.dv.leo); });
  cands.forEach(function(c){
    /* fuel points fall to zero for a stack 5% heavier than the lightest one in the search */
    var fuel = isFinite(c.dv.leo) && isFinite(mMin) ? clamp(1 - (c.dv.leo/mMin - 1)/0.05, 0, 1) : 0;
    var wp = c.w.p === null ? 0.5 : c.w.p;
    c.fuel = fuel; c.score = 100*(0.4*wp + 0.35*c.siteQ + 0.25*fuel);
  });
  cands.sort(function(a, b){ return b.score - a.score; });
  var picked = [];
  cands.forEach(function(c){ if (picked.length < 8 && picked.every(function(p){ return Math.abs(p.t - c.t) > 2*86400000; })) picked.push(c); });
  return {site: site, key: key, days: days, top: picked, dvMin: dvMin, dvMax: dvMax, mMin: mMin, count: cands.length, start: start};
}
function localTime(ms){
  var tz = SITE_TZ[LAUNCH_SITES[launchIdx].id];
  try { return new Intl.DateTimeFormat('en-GB', {timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'}).format(new Date(ms)); } catch (e) { return ''; }
}
function renderWindows(){
  var k = [active, target[active], launchIdx, PROFILES[active].tof, PROFILES[active].stay, lwRange, wx.version, TAB && TAB.t0, (siteById(target[active]) || {}).horizon, mast, relay, JSON.stringify(LIMITS[active])].join('|');
  if (k !== lwKey){ lwKey = k; lwRes = scanWindows(); }
  var R = lwRes, tb = $('#lwTable');
  $('#wxStatus').textContent = wx.status;
  loadWeather();
  var opts = results[active].map(function(r){ return '<option value="' + r.site.id + '"' + (r.site.id === target[active] ? ' selected' : '') + '></option>'; }).join('');
  lwSiteSel.innerHTML = opts;
  Array.prototype.forEach.call(lwSiteSel.options, function(o, i){ o.textContent = results[active][i].site.name; });
  var ub = $('#useBest'), b0 = R && R.top[0];
  ub.disabled = !b0 || Math.abs(b0.t - launchMs) < 60000;
  ub.textContent = !b0 ? 'No good launch found' : ub.disabled ? '✓ Best launch selected' : 'Use best launch: ' + fmtDate(b0.t);
  if (!R){ $('#lwWho').textContent = '—'; tb.innerHTML = '<tr><td>Pick a site first.</td></tr>'; drawLwChart(); return; }
  $('#lwWho').textContent = (R.key === 'crewed' ? 'a crewed landing at ' : 'a robotic landing at ') + R.site.name;
  $('#lwCaption').textContent = R.count + ' of ' + R.days.reduce(function(a, d){ return a + d.n; }, 0) + ' launch opportunities from ' + LAUNCH_SITES[launchIdx].name.split(' (')[0] + ' between ' + fmtDate(R.start, false) + ' and ' + fmtDate(R.start + (lwRange - 1)*86400000, false) + ' give a usable landing.';
  var rows = ['<tr><th>#</th><th>Launch</th><th>Landing</th><th class="num">Moon at arrival</th><th class="num">Δv · mass in Earth orbit</th><th>At the site</th><th>Launch weather</th><th class="num">Score</th><th></th></tr>'];
  R.top.forEach(function(c, i){
    var dD = Math.round((c.dvTot - R.dvMin)*1000), w = c.w;
    var wTxt = w.src === 'forecast' ? (w.go ? '<span class="flag ok">GO (forecast)</span>' : '<span class="flag bad">NO-GO: ' + w.why.join(', ') + '</span>')
      : w.src === 'climate' ? 'GO on ' + Math.round(w.p*100) + '% of days<br>around this date, 2015–24' : 'not loaded';
    var near = c.dv.D < 370000 ? 'near perigee' : c.dv.D > 398000 ? 'near apogee' : '';
    var on = Math.abs(c.t - launchMs) < 60000;
    rows.push('<tr' + (on ? ' class="on"' : '') + '><td class="num">' + (i + 1) + '</td>' +
      '<td>' + fmtDate(c.t) + '<br><small>local ' + localTime(c.t) + '</small><small>azimuth ' + Math.round(c.o.az) + '°, orbit ' + c.o.inc.toFixed(1) + '°</small></td>' +
      '<td>' + fmtDate(tabTime(c.iL)) + '</td>' +
      '<td class="num">' + Math.round(c.dv.D).toLocaleString('en-US') + ' km<br><small>' + near + '</small></td>' +
      '<td class="num">' + c.dvTot.toFixed(3) + ' km/s · ' + (isFinite(c.dv.leo) ? t1(c.dv.leo) + ' t' : 'n/a') + '<br><small>' + (dD ? '+' + dD + ' m/s' : 'lowest Δv') + (isFinite(c.dv.leo) && c.dv.leo - R.mMin > 0.05 ? ' · +' + t1(c.dv.leo - R.mMin) + ' t propellant' : '') + '</small></td>' +
      '<td><small>Sun ' + pct(c.sunStay) + '</small><small>Earth ' + pct(c.earthStay) + '</small></td>' +
      '<td><small>' + wTxt + '</small></td>' +
      '<td class="num">' + Math.round(c.score) + '</td>' +
      '<td>' + (on ? '<span class="flag ok">Selected</span>' : '<button type="button" class="fly" data-t="' + c.t + '">Use this launch</button>') + '</td></tr>');
  });
  if (!R.top.length) rows.push('<tr><td colspan="9">No launch in the next ' + lwRange + ' days gives a usable landing at this site. Try another site, a shorter stay, or a longer search.</td></tr>');
  tb.innerHTML = rows.join('');
  Array.prototype.forEach.call(tb.querySelectorAll('button[data-t]'), function(b){
    b.addEventListener('click', function(){ useLaunch(+b.getAttribute('data-t')); });
  });
  drawLwChart();
}
var lwC = $('#lwChart');
function drawLwChart(){
  var R = lwRes, dpr = Math.min(window.devicePixelRatio || 1, 2), w = lwC.clientWidth || 600, h = 98;
  if (lwC.width !== Math.round(w*dpr) || lwC.height !== Math.round(h*dpr)){ lwC.width = Math.round(w*dpr); lwC.height = Math.round(h*dpr); }
  var c = lwC.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  if (!R) return;
  var K = {ink: tok('--ink'), muted: tok('--muted'), line: tok('--line'), earth: tok('--earth-fill'), mono: tok('--f-mono'), col: R.key === 'crewed' ? tok('--crew-fill') : tok('--robot-fill')};
  var lab = w < 520 ? 74 : 96, pw = w - lab - 6, n = R.days.length, cw = pw/n;
  var ySite = 16, yWx = 34, yDv = 52, hDv = 24;
  c.font = '500 11px ' + K.mono; c.fillStyle = K.muted; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText('Site usable', 0, ySite + 6); c.fillText('Weather GO', 0, yWx + 6); c.fillText('Δv', 0, yDv + 7);
  c.fillStyle = K.line; c.fillRect(lab, ySite, pw, 12); c.fillRect(lab, yWx, pw, 12); c.fillRect(lab, yDv, pw, hDv);
  var dmin = Infinity, dmax = -Infinity;
  R.days.forEach(function(d){ if (d.best){ var v = d.best.dv.space + d.best.dv.ascent; dmin = Math.min(dmin, v); dmax = Math.max(dmax, v); } });
  var line = [];
  R.days.forEach(function(d, i){
    var x = lab + i*cw;
    if (d.best && d.best.viable){ c.fillStyle = K.col; c.fillRect(x, ySite, cw + 0.5, 12); }
    var wv = d.best ? d.best.w : wxFor(d.day + 43200000);
    if (wv && wv.p !== null){
      c.globalAlpha = 0.12 + 0.88*wv.p; c.fillStyle = K.earth; c.fillRect(x, yWx, cw + 0.5, 12); c.globalAlpha = 1;
      if (wv.src === 'forecast'){ c.fillStyle = K.ink; c.fillRect(x, yWx + 13, cw + 0.5, 2); }
    }
    if (d.best){ var v = d.best.dv.space + d.best.dv.ascent; line.push([x + cw/2, yDv + hDv - 3 - (dmax > dmin ? (dmax - v)/(dmax - dmin) : 0.5)*(hDv - 6)]); }
  });
  c.strokeStyle = K.ink; c.lineWidth = 1.3; c.beginPath();
  line.forEach(function(p, i){ if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
  c.stroke();
  if (isFinite(dmin)){ c.font = '500 10px ' + K.mono; c.fillStyle = K.muted; c.fillText('±' + Math.round((dmax - dmin)*500) + ' m/s', 0, yDv + 19); }
  c.textBaseline = 'top';
  R.top.slice(0, 3).forEach(function(t, i){
    var x = lab + (t.t - R.start)/86400000*cw;
    c.strokeStyle = K.ink; c.lineWidth = 1; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(x + 0.5, 12); c.lineTo(x + 0.5, yDv + hDv); c.stroke(); c.setLineDash([]);
    c.font = '600 10.5px ' + K.mono; c.fillStyle = K.ink; c.textAlign = 'center'; c.fillText('#' + (i + 1), x, 0);
  });
  var xl = lab + (launchMs - R.start)/86400000*cw;
  if (xl >= lab && xl <= lab + pw){ c.strokeStyle = K.ink; c.lineWidth = 2.5; c.beginPath(); c.moveTo(xl, ySite - 2); c.lineTo(xl, yDv + hDv + 2); c.stroke(); }
  c.font = '500 10.5px ' + K.mono; c.fillStyle = K.muted;
  var m = new Date(R.start), mm = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)), last = -99;
  while (mm.getTime() < R.start + n*86400000){
    var x2 = lab + (mm.getTime() - R.start)/86400000*cw;
    c.fillStyle = K.line; c.fillRect(x2, yDv + hDv, 1, 4); c.fillStyle = K.muted;
    if (x2 - last > 30){ c.textAlign = 'center'; c.fillText(MON[mm.getUTCMonth()] + (mm.getUTCMonth() === 0 ? ' ' + mm.getUTCFullYear() : ''), x2, yDv + hDv + 6); last = x2; }
    mm = new Date(Date.UTC(mm.getUTCFullYear(), mm.getUTCMonth() + 1, 1));
  }
}
/* ---------- choosing a launch ---------- */
var autoBest = true;
function useLaunch(t){ autoBest = false; launchMs = Math.round(t/60000)*60000; syncDate(); met = 0; recompute(); renderAll(); }
function applyBest(){
  renderWindows();
  var b = lwRes && lwRes.top[0];
  if (b && Math.abs(b.t - launchMs) >= 60000){ launchMs = Math.round(b.t/60000)*60000; syncDate(); recompute(); renderAll(); met = mission.tLand + 6*3600; syncMet(); }
}
var lwSiteSel = $('#lwSite');
lwSiteSel.addEventListener('change', function(){ autoBest = false; target[active] = lwSiteSel.value; recompute(); renderAll(); });
$('#lwRange').addEventListener('change', function(e){ lwRange = +e.target.value; renderWindows(); });
$('#useBest').addEventListener('click', function(){ var b = lwRes && lwRes.top[0]; if (b) useLaunch(b.t); });

