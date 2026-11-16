/* Landing calendar, runs inside startApp() and shares its scope with the other files here (see tools/build_js.py): the
   horizon chart and the year timeline. */
/* ---------- charts ---------- */
function tok(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function fitCanvas(cv, cssH){
  var dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth || 300;
  if (cssH) cv.style.height = cssH + 'px';
  var hgt = cssH || cv.clientHeight || 200;
  var tw = Math.round(w*dpr), th = Math.round(hgt*dpr);
  if (cv.width !== tw || cv.height !== th){ cv.width = tw; cv.height = th; }
  var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {ctx: ctx, w: w, h: hgt};
}
var hzCanvas = $('#horizon');
function drawHorizon(){
  var f = fitCanvas(hzCanvas, 210), ctx = f.ctx, w = f.w, h = f.h, s = sites[sel], st = siteState(s, state.t);
  var C = {ink: tok('--ink'), muted: tok('--muted'), line: tok('--line'), sky: tok('--sky'), ground: tok('--ground'), sun: tok('--sun-fill'), earth: tok('--earth-fill'), sunT: tok('--sun'), earthT: tok('--earth'), mono: tok('--f-mono')};
  var pl = 36, pr = 8, pt = 10, pb = 24, pw = w - pl - pr, ph = h - pt - pb;
  var pathMax = -90, pathMin = 90, k;
  for (k = 1; k < s.pathSun.length; k += 2){ pathMax = Math.max(pathMax, s.pathSun[k]); pathMin = Math.min(pathMin, s.pathSun[k]); }
  for (k = 1; k < s.pathEarth.length; k += 2){ pathMax = Math.max(pathMax, s.pathEarth[k]); pathMin = Math.min(pathMin, s.pathEarth[k]); }
  var yMax = Math.min(40, Math.ceil(Math.max(4, s.pmax + 1, pathMax + 1))), yMin = Math.floor(Math.min(-2, s.pmin - 1, pathMin - 1));
  var X = function(az){ return pl + az/360*pw; }, Y = function(el){ return pt + (yMax - el)/(yMax - yMin)*ph; };
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = C.sky; ctx.fillRect(pl, pt, pw, ph);
  var stepY = (yMax - yMin) > 24 ? 10 : (yMax - yMin) > 10 ? 5 : 2;
  ctx.font = '500 10.5px ' + C.mono; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  for (var gy = Math.ceil(yMin/stepY)*stepY; gy <= yMax; gy += stepY){
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl, Y(gy) + 0.5); ctx.lineTo(pl + pw, Y(gy) + 0.5); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.fillText((gy > 0 ? '+' : gy < 0 ? '−' : '') + Math.abs(gy) + '°', pl - 5, Y(gy));
  }
  var dots = function(path, color){
    ctx.fillStyle = color; ctx.globalAlpha = 0.35;
    for (var i = 0; i < path.length; i += 2) ctx.fillRect(X(path[i]) - 0.75, Y(path[i + 1]) - 0.75, 1.5, 1.5);
    ctx.globalAlpha = 1;
  };
  dots(s.pathEarth, C.earth); dots(s.pathSun, C.sun);
  var az;
  ctx.fillStyle = C.ground; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(X(0), pt + ph);
  for (az = 0; az <= 360; az += 1) ctx.lineTo(X(az), Y(clamp(s.prof[az % 360], yMin, yMax)));
  ctx.lineTo(X(360), pt + ph); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.beginPath();
  for (az = 0; az <= 360; az += 1){ var yy = Y(clamp(s.prof[az % 360], yMin, yMax)); if (az === 0) ctx.moveTo(X(az), yy); else ctx.lineTo(X(az), yy); }
  ctx.stroke();
  ctx.setLineDash([3, 3]); ctx.strokeStyle = C.muted; ctx.beginPath(); ctx.moveTo(pl, Y(0) + 0.5); ctx.lineTo(pl + pw, Y(0) + 0.5); ctx.stroke(); ctx.setLineDash([]);
  var mark = function(a, el, color, filled, label, below){
    var x = X(a), y = Y(clamp(el, yMin, yMax));
    ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI*2);
    ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
    if (filled){ ctx.fillStyle = color; ctx.fill(); }
    ctx.font = '600 11px ' + C.mono; ctx.textBaseline = 'middle';
    var tw = ctx.measureText(label).width, tx = x + 9; ctx.textAlign = 'left';
    if (tx + tw > pl + pw) { tx = x - 9 - tw; }
    ctx.fillStyle = below; ctx.fillText(label, tx, y);
  };
  mark(st.earthAz, st.earthEl, C.earth, st.earthVis > 0, 'Earth', C.earthT);
  mark(st.sunAz, st.sunEl, C.sun, st.sunLit > 0.5, 'Sun', C.sunT);
  ctx.strokeStyle = C.line; ctx.strokeRect(pl + 0.5, pt + 0.5, pw - 1, ph - 1);
  ctx.textBaseline = 'top'; ctx.font = '500 10.5px ' + C.mono;
  [[0, 'N 0°'], [90, 'E 90°'], [180, 'S 180°'], [270, 'W 270°'], [360, 'N']].forEach(function(tk){
    ctx.fillStyle = C.muted;
    ctx.textAlign = tk[0] === 0 ? 'left' : tk[0] === 360 ? 'right' : 'center';
    ctx.fillText(tk[1], X(tk[0]), pt + ph + 6);
  });
}
var tlCanvas = $('#timeline'), TL = {l: 26, r: 6, top: 6, row: 26, axis: 22};
function drawTimeline(){
  var hgt = TL.top + sites.length*TL.row + TL.axis;
  var f = fitCanvas(tlCanvas, hgt), ctx = f.ctx, w = f.w, pw = w - TL.l - TL.r;
  var C = {ink: tok('--ink'), muted: tok('--muted'), line: tok('--line'), sun: tok('--sun-fill'), earth: tok('--earth-fill'), mono: tok('--f-mono')};
  ctx.clearRect(0, 0, w, hgt);
  var cw = pw/DAYS;
  sites.forEach(function(s, r){
    var y0 = TL.top + r*TL.row;
    ctx.font = '600 11.5px ' + C.mono; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = r === sel ? C.ink : C.muted; ctx.fillText(s.id, 4, y0 + 8);
    ctx.fillStyle = C.line; ctx.fillRect(TL.l, y0, pw, 10); ctx.fillRect(TL.l, y0 + 12, pw, 6);
    for (var d = 0; d < DAYS; d++){
      var a = s.daySun[d]; if (a > 0.01){ ctx.globalAlpha = a; ctx.fillStyle = C.sun; ctx.fillRect(TL.l + d*cw, y0, cw + 0.6, 10); }
      var e = s.dayEarth[d]; if (e > 0.01){ ctx.globalAlpha = e; ctx.fillStyle = C.earth; ctx.fillRect(TL.l + d*cw, y0 + 12, cw + 0.6, 6); }
    }
    ctx.globalAlpha = 1;
    if (r === sel){ ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.strokeRect(TL.l - 0.5, y0 - 0.5, pw + 1, 19); }
  });
  var yA = TL.top + sites.length*TL.row;
  ctx.font = '500 10.5px ' + C.mono; ctx.textBaseline = 'top'; ctx.fillStyle = C.muted;
  [0, 0.25, 0.5, 0.75, 1].map(function(f){ return Math.round(f*DAYS); }).forEach(function(d){
    var x = TL.l + d/DAYS*pw; ctx.textAlign = d === 0 ? 'left' : d === DAYS ? 'right' : 'center';
    ctx.fillText(dateFromJd(state.jd0 + d).toISOString().slice(0, 7), x, yA);
  });
  var cx = TL.l + state.t/DAYS*pw;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, 1); ctx.lineTo(cx, yA - 3); ctx.stroke();
}
tlCanvas.addEventListener('pointerdown', function(ev){
  var rect = tlCanvas.getBoundingClientRect(), pw = rect.width - TL.l - TL.r;
  setT(clamp((ev.clientX - rect.left - TL.l)/pw*DAYS, 0, DAYS));
  var row = Math.floor((ev.clientY - rect.top - TL.top)/TL.row);
  if (row >= 0 && row < sites.length && row !== sel) select(row);
});

