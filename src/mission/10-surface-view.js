/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): the view
   from the landing site (sky, Sun, Earth, LOLA horizon), the lander and the landing replay. */
/* =====================================================================
   first-person view from the landing site
   ===================================================================== */
var surfC = $('#surf'), surfWrap = $('#surfWrap'), surfHud = $('#surfHud');
var look = {az: null, fov: 70, follow: 'auto'}, enlarge = 3;
var SKYSTARS = (function(){ var a = 99, out = []; function r(){ a = (a*16807) % 2147483647; return a/2147483647; } for (var i = 0; i < 520; i++) out.push([r()*360, Math.asin(r())/DEG, r()]); return out; })();
function nowIndex(){ return (launchMs - TAB.t0)/3600000 + met/3600; }
function skyInterp(site, fi, fr){
  fi = clamp(fi, 0, TAB.n - 2);
  var i0 = Math.floor(fi), f = fi - i0, a = skyAt(site, i0, fr), b = skyAt(site, i0 + 1, fr);
  function laz(x, y){ var d = ((y - x + 540) % 360) - 180; return (x + d*f + 360) % 360; }
  var D = TAB.ed[i0] + (TAB.ed[i0 + 1] - TAB.ed[i0])*f;
  return {sunEl: a.sunEl + (b.sunEl - a.sunEl)*f, sunAz: laz(a.sunAz, b.sunAz), earthEl: a.earthEl + (b.earthEl - a.earthEl)*f, earthAz: laz(a.earthAz, b.earthAz), D: D};
}
function enu(az, el){ var a = az*DEG, e = el*DEG; return [Math.cos(e)*Math.sin(a), Math.cos(e)*Math.cos(a), Math.sin(e)]; }
function wrap180(x){ return ((x + 540) % 360) - 180; }
function hoursTo(site, fi, field){
  var Y = siteSeries(site), arr = field === 'sun' ? Y.sunOK : Y.earthOK, i = clamp(Math.round(fi), 0, TAB.n - 1), cur = arr[i], j = i, lim = Math.min(TAB.n, i + 60*24);
  while (j < lim && arr[j] === cur) j++;
  return {up: cur === 1, h: j - i, capped: j >= lim};
}
function seeded(id){ var a = 0; for (var i = 0; i < id.length; i++) a = (a*31 + id.charCodeAt(i)) % 2147483647; a = a || 7; return function(){ a = (a*16807) % 2147483647; return a/2147483647; }; }
function phaseDisk(c, x, y, r, k, theta){
  c.save(); c.translate(x, y); c.rotate(theta);
  c.fillStyle = '#132033'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI*2); c.fill();
  var g = c.createRadialGradient(r*0.25, -r*0.2, r*0.1, 0, 0, r);
  g.addColorStop(0, '#E8F4FF'); g.addColorStop(0.45, '#7FB6F0'); g.addColorStop(1, '#2C62A8');
  c.fillStyle = g; c.beginPath();
  var rx = r*Math.abs(2*k - 1);
  c.arc(0, 0, r, -Math.PI/2, Math.PI/2);
  if (k >= 0.5) c.ellipse(0, 0, Math.max(rx, 0.01), r, 0, Math.PI/2, Math.PI*1.5, false);
  else c.ellipse(0, 0, Math.max(rx, 0.01), r, 0, Math.PI/2, -Math.PI/2, true);
  c.fill();
  c.strokeStyle = 'rgba(160,200,255,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r, 0, Math.PI*2); c.stroke();
  c.restore();
}
/* draws the panorama; returns the sky state used */
function drawPanorama(c, w, h, site, fi, o){
  prepSite(site);
  var fr = siteFrame(site), sk = skyInterp(site, fi, fr), mini = !!o.mini;
  var centerAz = o.az, fov = o.fov, pxDeg = w/fov, yH = h*(mini ? 0.66 : 0.72);
  function X(az){ return w/2 + wrap180(az - centerAz)*pxDeg; }
  function Y(el){ return yH - el*pxDeg; }
  function skyY(x){ return Y(hzAt(site, centerAz + (x - w/2)/pxDeg)); }
  var sunAlt = sk.sunEl - hzAt(site, sk.sunAz), earthAlt = sk.earthEl - hzAt(site, sk.earthAz);
  var sunLit = sunFrac(sunAlt), sunUp = sunLit > 0, sunCentre = sunAlt > 0, earthUp = earthAlt > -EARTH_R;
  var prof = [], pst = mini ? 3 : 2, yLow = 0;
  for (var px = 0; px <= w + pst; px += pst){ var py = skyY(px); prof.push(px, py); if (py > yLow) yLow = py; }
  // sky (no atmosphere: black)
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  var rot = (fi/24)*360/C.siderealMonth;
  for (var i = 0; i < SKYSTARS.length; i++){
    var st = SKYSTARS[i], sx = X(st[0] + rot), sy = Y(st[1]*0.9 + 0.5);
    if (sx < 0 || sx > w || sy > skyY(sx)) continue;
    c.globalAlpha = 0.25 + st[2]*0.6; c.fillStyle = '#DCE6F2'; c.fillRect(sx, sy, st[2] > 0.92 ? 1.6 : 1, st[2] > 0.92 ? 1.6 : 1);
  }
  c.globalAlpha = 1;
  // Sun
  var mag = mini ? Math.max(enlarge, 3) : enlarge;
  var sx = X(sk.sunAz), sy = Y(sk.sunEl), sr = Math.max(C.sunR*pxDeg*mag, 2.5);
  if (Math.abs(wrap180(sk.sunAz - centerAz)) < fov/2 + 20){
    var gl = c.createRadialGradient(sx, sy, 0, sx, sy, sr*9);
    gl.addColorStop(0, 'rgba(255,250,235,.55)'); gl.addColorStop(0.25, 'rgba(255,230,180,.18)'); gl.addColorStop(1, 'rgba(255,220,160,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(sx, sy, sr*9, 0, Math.PI*2); c.fill();
    c.fillStyle = '#FFFDF4'; c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI*2); c.fill();
  }
  // Earth with phase
  var su = enu(sk.sunAz, sk.sunEl), eu = enu(sk.earthAz, sk.earthEl), k = (1 - dot(su, eu))/2;
  var ex = X(sk.earthAz), ey = Y(sk.earthEl), er = Math.max(Math.asin(6371/sk.D)/DEG*pxDeg*mag, 3);
  var theta = Math.atan2(-(sk.sunEl - sk.earthEl), wrap180(sk.sunAz - sk.earthAz));
  if (Math.abs(wrap180(sk.earthAz - centerAz)) < fov/2 + 10) phaseDisk(c, ex, ey, er, k, theta);
  // ground
  var yT = Math.min(yLow, h - 6), light = sunUp ? 0.25 + 0.75*sunLit : 0, shine = !sunUp && earthUp ? 1 : 0;
  var top = sunUp ? 'rgb(' + Math.round(70 + 90*light) + ',' + Math.round(68 + 86*light) + ',' + Math.round(64 + 78*light) + ')' : shine ? '#1C2430' : '#0B0D10';
  var bot = sunUp ? 'rgb(' + Math.round(26 + 40*light) + ',' + Math.round(25 + 38*light) + ',' + Math.round(24 + 34*light) + ')' : shine ? '#0D1219' : '#050607';
  var yTop = h; for (var pi = 1; pi < prof.length; pi += 2) yTop = Math.min(yTop, prof[pi]);
  var gg = c.createLinearGradient(0, yTop, 0, h); gg.addColorStop(0, top); gg.addColorStop(1, bot);
  c.fillStyle = gg; c.beginPath(); c.moveTo(0, h);
  for (pi = 0; pi < prof.length; pi += 2) c.lineTo(prof[pi], prof[pi + 1]);
  c.lineTo(w, h); c.closePath(); c.fill();
  // illustrative craters, lit on the Sun side
  var rnd = seeded(site.id), sunDx = Math.sin(wrap180(sk.sunAz - centerAz)*DEG), sunDy = -Math.cos(wrap180(sk.sunAz - centerAz)*DEG);
  for (var q = 0; q < (mini ? 14 : 34); q++){
    var u = rnd(), v = rnd(), sz = rnd();
    var cy = yT + 4 + Math.pow(v, 1.6)*(h - yT - 4), depth = (cy - yT)/(h - yT), cx = u*w, rx = (4 + sz*26)*(0.25 + depth*1.6)*(mini ? 0.5 : 1), ry = rx*(0.12 + depth*0.35);
    c.fillStyle = 'rgba(0,0,0,' + (sunUp ? 0.28 : 0.12) + ')'; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); c.fill();
    if (sunUp){ c.strokeStyle = 'rgba(255,250,235,' + (0.25*light) + ')'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, Math.PI*(sunDx > 0 ? 1.15 : -0.15), Math.PI*(sunDx > 0 ? 1.85 : 0.65)); c.stroke(); }
  }
  // flat-Moon reference
  if (site._mask || Math.abs(site.horizon) > 0.05){ c.setLineDash([4, 5]); c.strokeStyle = 'rgba(200,210,220,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, Y(0) + 0.5); c.lineTo(w, Y(0) + 0.5); c.stroke(); c.setLineDash([]); }
  c.strokeStyle = sunUp ? 'rgba(255,244,222,' + (0.35 + 0.4*light) + ')' : 'rgba(230,236,242,.55)'; c.lineWidth = 1; c.beginPath();
  for (pi = 0; pi < prof.length; pi += 2){ if (pi) c.lineTo(prof[pi], prof[pi + 1] + 0.5); else c.moveTo(prof[pi], prof[pi + 1] + 0.5); }
  c.stroke();
  // compass along the horizon
  c.font = (mini ? '500 9.5px ' : '500 11px ') + tok('--f-mono'); c.textAlign = 'center'; c.textBaseline = 'top';
  var stepT = fov > 90 ? 30 : 10;
  for (var az = 0; az < 360; az += stepT){
    var x = X(az); if (x < 0 || x > w) continue;
    var name = az === 0 ? 'N' : az === 90 ? 'E' : az === 180 ? 'S' : az === 270 ? 'W' : (mini ? '' : az + '°');
    var yk = skyY(x);
    c.strokeStyle = 'rgba(230,236,242,.4)'; c.beginPath(); c.moveTo(x + 0.5, yk); c.lineTo(x + 0.5, yk + (name.length === 1 ? 7 : 4)); c.stroke();
    if (name){ c.fillStyle = name.length === 1 ? 'rgba(240,244,248,.85)' : 'rgba(200,210,220,.6)'; c.fillText(name, x, yk + 9); }
  }
  // lander + shadow (full view only): absent before touchdown, flying during the replay, on the ground after
  if (!mini && !o.noLander) drawLander(c, w, h, yT, sk, {light: light, shine: shine, sunUp: sunUp, sunDx: sunDx, centerAz: centerAz}, o.land || null,
    {lift: o.lift || null, baseOnly: !!o.baseOnly, crew: active === 'crewed', walk: !!o.walk});
  // labels and off-screen / below-horizon hints
  function tag(x, y, txt, col, below){
    c.font = (mini ? '600 10px ' : '600 11.5px ') + tok('--f-mono'); var tw = c.measureText(txt).width;
    x = clamp(x, tw/2 + 4, w - tw/2 - 4); y = below ? Math.min(skyY(x) - 10, h - 8) : Math.max(y, mini ? 14 : 72);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - tw/2 - 4, y - 8, tw + 8, 16);
    c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y);
  }
  var sIn = Math.abs(wrap180(sk.sunAz - centerAz)) < fov/2, eIn = Math.abs(wrap180(sk.earthAz - centerAz)) < fov/2;
  var sLab = 'Sun ' + sgn(sk.sunEl, 1) + '°' + (sIn ? '' : (wrap180(sk.sunAz - centerAz) > 0 ? ' →' : ' ←'));
  var eLab = 'Earth ' + sgn(sk.earthEl, 1) + '°' + (eIn ? '' : (wrap180(sk.earthAz - centerAz) > 0 ? ' →' : ' ←'));
  tag(sIn ? sx : (wrap180(sk.sunAz - centerAz) > 0 ? w : 0), sunUp ? sy - sr*2.2 - 10 : 0, sLab, sunUp ? '#FFE3A3' : '#9AA4AF', !sunUp);
  tag(eIn ? ex : (wrap180(sk.earthAz - centerAz) > 0 ? w : 0), earthUp ? ey - er - 14 : 0, eLab, earthUp ? '#A9D2FF' : '#9AA4AF', !earthUp);
  return {sk: sk, sunUp: sunCentre, earthUp: earthUp, k: k, sunLit: sunLit, sunAlt: sunAlt, earthAlt: earthAlt};
}
/* ---------- the lander, and the landing replay ----------
   Descent profile (illustrative): altitude h = t + 0.0958 t^2 metres at t seconds before touchdown,
   so 1.5 km and 24 m/s down two minutes out, 1 m/s at contact. Shown about 8x faster than real time. */
var LAND = {pre: 120, post: 8, dur: 15000, c2: 0.0958};
var landAnim = null;
function descentAt(tau){ tau = Math.max(0, tau); return {alt: tau + LAND.c2*tau*tau, vs: 1 + 2*LAND.c2*tau}; }
/* Liftoff (crewed): the ascent stage leaves, the descent stage stays as its launch pad. Illustrative profile:
   altitude 1.2 t^2 m for the first 10 s (straight up), then pitch-over and 24 m/s + 1 m/s^2 climbing while picking up speed sideways. */
var LIFT = {pre: 2, post: 25, dur: 12000};
function liftState(now){
  if (!landAnim || landAnim.kind !== 'lift') return null;
  var p = clamp((now - landAnim.start)/LIFT.dur, 0, 1), ts = -LIFT.pre + p*(LIFT.pre + LIFT.post), t = Math.max(0, ts), alt, v, x = 0;
  if (t <= 10){ alt = 1.2*t*t; v = 2.4*t; } else { var u = t - 10; alt = 120 + 24*u + 0.5*u*u; v = 24 + u; x = 3*u*u; }
  return {p: p, ts: ts, t: t, alt: alt, v: v, x: x, af: Math.sqrt(clamp(alt/1500, 0, 1)), engine: ts >= 0 ? 1 : 0, debris: ts >= 0 ? clamp(1 - t/4, 0, 1) : 0};
}
function landState(now){
  if (!landAnim || landAnim.kind !== 'land') return null;
  var p = clamp((now - landAnim.start)/LAND.dur, 0, 1), ts = -LAND.pre + p*(LAND.pre + LAND.post), tau = Math.max(0, -ts), d = descentAt(tau);
  var af = Math.sqrt(clamp(d.alt/1500, 0, 1));
  return {p: p, ts: ts, tau: tau, alt: tau > 0 ? d.alt : 0, vs: tau > 0 ? d.vs : 0, af: af, flying: ts < 0,
          dust: ts < 0 ? clamp(1 - d.alt/35, 0, 1) : clamp(1 - ts/5, 0, 1)*0.9, engine: ts < 0 ? 1 : clamp(1 - ts/0.6, 0, 1)};
}
