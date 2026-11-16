/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): the
   launch from Spaceport Nova Scotia, replayed at the pad. */
/* ---------- launch from Earth (replay in the site view) ----------
   A ground tracking camera 3 km from the pad, 30 m up, side-on to the flight. The Sun's height in the sky is real for the
   launch time and site; the ascent profile is illustrative, typical of a heavy-lift launcher (no specific vehicle).
   Replay time runs slower near liftoff and faster later (see LAUNCH.map). */
var LAUNCH = {dur: 19000, pre: 6, post: 150, map: [[0, -6], [0.24, 0], [0.5, 16], [0.78, 80], [1, 150]],
  /* t s, altitude m, downrange m */
  prof: [[0, 0, 0, 0], [5, 18, 0, 8], [10, 105, 2, 25], [15, 290, 12, 48], [20, 640, 40, 80], [30, 1850, 180, 160], [45, 5000, 900, 300], [60, 9800, 2600, 450],
         [75, 15500, 5600, 610], [90, 22000, 10500, 790], [110, 32000, 20000, 1060], [126, 41000, 30500, 1350], [140, 48500, 42000, 1500], [150, 53500, 51000, 1650], [175, 66000, 82000, 2050]],
  events: {crewed: [[-6, 'Core engines start'], [0, 'Liftoff'], [7, 'Clear of the tower'], [12, 'Roll and pitch over'], [30, 'Climbing and speeding up'], [52, 'Faster than sound'], [70, 'Max-Q: highest air pressure on the rocket'], [95, 'Above most of the air'], [126, 'Side boosters separate'], [140, 'Abort tower jettisoned']],
           robotic: [[-3, 'Engines start'], [0, 'Liftoff'], [7, 'Clear of the tower'], [12, 'Pitch over'], [30, 'Climbing and speeding up'], [52, 'Faster than sound'], [70, 'Max-Q: highest air pressure on the rocket'], [95, 'Above most of the air'], [140, 'First stage done, second stage burns']]},
  cam: {d: 3000, up: 30}};
function launchState(now){
  if (!landAnim || landAnim.kind !== 'launch') return null;
  var p = clamp((now - landAnim.start)/LAUNCH.dur, 0, 1), m = LAUNCH.map, i = 1;
  while (i < m.length - 1 && p > m[i][0]) i++;
  var u = (p - m[i - 1][0])/(m[i][0] - m[i - 1][0]), ts = m[i - 1][1] + u*(m[i][1] - m[i - 1][1]);
  var rate = (m[i][1] - m[i - 1][1])/((m[i][0] - m[i - 1][0])*LAUNCH.dur/1000);
  var P = ascentAt(Math.max(0, ts)), ev = '', E = LAUNCH.events[landAnim.key || 'crewed'];
  for (var k = 0; k < E.length; k++) if (ts >= E[k][0]) ev = E[k][1];
  return {p: p, ts: ts, t: Math.max(0, ts), alt: P.alt, x: P.x, v: P.v, pitch: P.pitch, rate: rate, event: ev, engine: ts >= (landAnim.key === 'robotic' ? -3 : -6) ? 1 : 0};
}
function ascentAt(t){
  var A = LAUNCH.prof, i = 1;
  while (i < A.length - 1 && t > A[i][0]) i++;
  var a = A[i - 1], b = A[i], u = clamp((t - a[0])/(b[0] - a[0]), 0, 1), s = u*u*(3 - 2*u)*0.35 + u*0.65;
  var alt = a[1] + (b[1] - a[1])*s, x = a[2] + (b[2] - a[2])*s;
  var dt = b[0] - a[0], va = (b[1] - a[1])/dt, vx = (b[2] - a[2])/dt;
  return {alt: alt, x: x, v: a[3] + (b[3] - a[3])*u, pitch: Math.atan2(vx, Math.max(va, 1e-3))};
}
/* low-precision Sun position (about 0.01 deg, enough for the sky colour); returns altitude and azimuth in degrees */
function sunAltAz(lat, lon, ms){
  var n = ms/86400000 + 2440587.5 - 2451545.0, L = n360(280.460 + 0.9856474*n), g = n360(357.528 + 0.9856003*n)*DEG;
  var lam = (L + 1.915*Math.sin(g) + 0.020*Math.sin(2*g))*DEG, eps = (23.439 - 0.0000004*n)*DEG;
  var ra = Math.atan2(Math.cos(eps)*Math.sin(lam), Math.cos(lam)), dec = Math.asin(Math.sin(eps)*Math.sin(lam));
  var H = (gmstDeg(ms) + lon)*DEG - ra, f = lat*DEG;
  var alt = Math.asin(Math.sin(f)*Math.sin(dec) + Math.cos(f)*Math.cos(dec)*Math.cos(H));
  var az = Math.atan2(-Math.sin(H)*Math.cos(dec), Math.cos(f)*Math.sin(dec) - Math.sin(f)*Math.cos(dec)*Math.cos(H));
  return {alt: alt/DEG, az: n360(az/DEG)};
}
function mixC(a, b, t){ return [a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t, a[2] + (b[2] - a[2])*t]; }
function rgb(a, al){ return 'rgba(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ',' + (al === undefined ? 1 : al) + ')'; }
/* sky colours at the horizon and overhead for a Sun altitude (degrees) */
function skyCols(sa){
  var K = [[-18, [6, 9, 18], [3, 5, 12]], [-10, [24, 34, 66], [6, 10, 26]], [-4, [214, 120, 74], [28, 44, 92]], [2, [246, 178, 110], [62, 98, 160]],
           [10, [186, 206, 226], [74, 122, 190]], [40, [176, 204, 232], [52, 104, 182]]];
  if (sa <= K[0][0]) return {hz: K[0][1], zen: K[0][2], night: 1};
  for (var i = 1; i < K.length; i++) if (sa <= K[i][0]){ var u = (sa - K[i - 1][0])/(K[i][0] - K[i - 1][0]); return {hz: mixC(K[i - 1][1], K[i][1], u), zen: mixC(K[i - 1][2], K[i][2], u), night: clamp(-sa/12, 0, 1)}; }
  return {hz: K[K.length - 1][1], zen: K[K.length - 1][2], night: 0};
}
var LSTARS = (function(){ var a = 4242, out = []; function r(){ a = (a*16807) % 2147483647; return a/2147483647; } for (var i = 0; i < 300; i++) out.push([r()*2.4 - 1.2, r()*1.5, r()]); return out; })();
function drawEarthLaunch(c, w, h, F){
  var LS = LAUNCH_SITES[launchIdx], sun = sunAltAz(LS.lat, LS.lon, launchMs + F.ts*1000), S = skyCols(sun.alt), crew = landAnim.key !== 'robotic';
  var RL = crew ? 98 : 70, long = F.ts >= 16;   // rocket length (m); camera cut at T+16 s
  /* world: X downrange, Y away from the camera, Z up (m). Pad camera 3 km away, long-range tracker 25 km away, both 30 m up. */
  var D = long ? 25000 : 3000, UP = 30;
  function dir(x, z){ return [x, D, z - UP]; }
  var mid = [F.x + Math.sin(F.pitch)*RL/2, F.alt + Math.cos(F.pitch)*RL/2], dR = norm(dir(mid[0], mid[1]));
  var k = long ? ease(clamp((F.ts - 16)/45, 0, 1)) : 0, Fz;
  if (!long) Fz = h*0.5/(RL/3000);
  else Fz = Math.exp(Math.log(h*0.16/(RL/Math.hypot(25000, ascentAt(16).alt))) *(1 - k) + Math.log(h*1.15)*k);
  var dP = norm(dir(0, 60)), aD = norm(add(mul(dR, 1 - 0.3*k), mul(dP, 0.3*k)));
  var fw = aD, rt = norm([fw[1], -fw[0], 0]), upv = cross(rt, fw), cx0 = w*0.5, cy0 = h*(long ? 0.5 + 0.12*k : 0.45);
  function Pv(v){ var z = dot(v, fw); if (z <= 1e-6) return null; return [cx0 + Fz*dot(v, rt)/z, cy0 - Fz*dot(v, upv)/z, z]; }
  function P(x, z){ return Pv(dir(x, z)); }
  var pitchC = Math.asin(clamp(fw[2], -1, 1)), yHz = cy0 + Fz*Math.tan(pitchC);
  // sky by elevation angle, coloured from the real Sun altitude
  function skyAt(el){ var u = Math.pow(clamp(el/(Math.PI/2.4), 0, 1), 0.55); return mixC(S.hz, S.zen, u); }
  var elTop = pitchC + Math.atan(cy0/Fz), sg = c.createLinearGradient(0, 0, 0, Math.max(2, Math.min(h, yHz)));
  sg.addColorStop(0, rgb(skyAt(elTop))); sg.addColorStop(1, rgb(skyAt(Math.max(0, pitchC - Math.atan((h - cy0)/Fz)))));
  c.fillStyle = sg; c.fillRect(0, 0, w, h);
  if (yHz < h){ var hg = c.createLinearGradient(0, yHz - h*0.25, 0, yHz); hg.addColorStop(0, rgb(S.hz, 0)); hg.addColorStop(1, rgb(S.hz, 0.9)); c.fillStyle = hg; c.fillRect(0, yHz - h*0.25, w, h*0.25); }
  // stars (night), fixed on the sky
  if (S.night > 0.2){
    for (var i = 0; i < LSTARS.length; i++){
      var s = LSTARS[i], az = s[0]*1.6, el = s[1]*0.95, q = Pv([Math.cos(el)*Math.sin(az), Math.cos(el)*Math.cos(az), Math.sin(el)]);
      if (!q || q[0] < 0 || q[0] > w || q[1] < 0 || q[1] > yHz) continue;
      c.globalAlpha = (S.night - 0.2)*(0.3 + 0.7*s[2]); c.fillStyle = '#E6ECF5'; c.fillRect(q[0], q[1], s[2] > 0.9 ? 1.6 : 1, s[2] > 0.9 ? 1.6 : 1);
    }
    c.globalAlpha = 1;
  }
  // the Sun: the camera looks across the flight path (flight to the right), i.e. toward launch azimuth − 90°
  var view = n360((budgets[active] ? budgets[active].az : 90) - 90), ra = (sun.az - view)*DEG, sa = sun.alt*DEG;
  var sp = sun.alt > -1 ? Pv([Math.cos(sa)*Math.sin(ra), Math.cos(sa)*Math.cos(ra), Math.sin(sa)]) : null;
  if (sp && sp[0] > -200 && sp[0] < w + 200){
    var sr = Math.max(Fz*0.0047, 3), gl = c.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], sr*14);
    gl.addColorStop(0, 'rgba(255,248,228,.9)'); gl.addColorStop(0.2, 'rgba(255,226,170,.35)'); gl.addColorStop(1, 'rgba(255,214,150,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(sp[0], sp[1], sr*14, 0, Math.PI*2); c.fill();
    c.fillStyle = '#FFF8E6'; c.beginPath(); c.arc(sp[0], sp[1], sr, 0, Math.PI*2); c.fill();
  }
  var day = clamp((sun.alt + 6)/12, 0, 1), lightK = 0.25 + 0.75*day;
  // sea beyond the pad, land in front of it
  if (yHz < h){
    var sea = mixC([14, 22, 36], [52, 86, 118], day), land = mixC([10, 12, 12], [62, 70, 52], day);
    c.fillStyle = rgb(sea); c.fillRect(0, yHz, w, h - yHz);
    var sh = P(0, 0), yl0 = sh ? Math.max(yHz + 1, sh[1] - (sh[1] - yHz)*0.5) : h;
    var lg = c.createLinearGradient(0, yl0, 0, h); lg.addColorStop(0, rgb(land)); lg.addColorStop(1, rgb(mixC(land, [0, 0, 0], 0.45)));
    c.fillStyle = lg; c.beginPath(); c.moveTo(0, h); c.lineTo(0, yl0 + 6);
    for (var xx = 0; xx <= w; xx += 24) c.lineTo(xx, yl0 + 4*Math.sin(xx*0.031) + 3*Math.sin(xx*0.11));
    c.lineTo(w, h); c.closePath(); c.fill();
  }
  var tNow = F.t;
  // exhaust trail: past positions, widening and fading with age (white smoke by day, dim by night)
  if (F.ts > 0.5){
    var smoke = mixC([70, 66, 64], [236, 234, 230], day), n = 110;
    c.lineCap = 'round';
    for (var kk = n; kk >= 1; kk--){
      var ta = tNow*(kk - 1)/n, tb = tNow*kk/n, A = ascentAt(ta), B = ascentAt(tb), age = tNow - tb;
      var pa = P(A.x, A.alt), pb = P(B.x, B.alt); if (!pa || !pb) continue;
      var wpx = Math.max(1.2, Fz*(6 + age*2.2)/pb[2]), al = clamp(0.8 - age/160, 0.08, 0.8);
      if (B.alt > 45000) al *= clamp(1 - (B.alt - 45000)/15000, 0.2, 1);
      c.strokeStyle = rgb(smoke, al); c.lineWidth = wpx; c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.stroke();
    }
  }
  // steam and smoke billowing out of the flame trench
  if (F.engine > 0){
    var age2 = F.ts - (crew ? -6 : -3), cloud = mixC([60, 58, 56], [242, 240, 236], day);
    for (var qq = 0; qq < 46; qq++){
      var side = qq % 2 ? 1 : -1, sp2 = 0.4 + ((qq*0.618) % 1)*0.9, grow = Math.min(age2, 60);
      var cx2 = side*(12 + grow*sp2*6), ca = 4 + grow*(0.25 + ((qq*0.377) % 1)*0.5)*2.2, r2 = 14 + grow*2.4*(0.5 + ((qq*0.29) % 1));
      var pp = P(cx2, ca); if (!pp) continue;
      var pr = Fz*r2/pp[2];
      if (pp[1] - pr > h || pp[0] + pr < 0 || pp[0] - pr > w || pr < 0.6) continue;
      var a2 = clamp(0.55 - age2/220, 0.12, 0.55);
      var cg = c.createRadialGradient(pp[0], pp[1], 0, pp[0], pp[1], pr);
      cg.addColorStop(0, rgb(cloud, a2)); cg.addColorStop(1, rgb(cloud, 0));
      c.fillStyle = cg; c.beginPath(); c.arc(pp[0], pp[1], pr, 0, Math.PI*2); c.fill();
    }
  }
  // launch tower (left of the rocket) and pad
  var tw0 = P(-26, 0), tw1 = P(-26, 120);
  if (tw0 && tw1 && tw0[1] > -20){
    var twW = Math.max(1.5, Fz*12/tw0[2]);
    c.fillStyle = rgb(mixC([20, 22, 26], [92, 96, 104], lightK)); c.fillRect(tw0[0] - twW/2, tw1[1], twW, tw0[1] - tw1[1]);
    if (twW > 6){
      c.strokeStyle = rgb(mixC([40, 42, 48], [150, 154, 162], lightK), 0.8); c.lineWidth = Math.max(0.6, twW*0.06);
      for (var yy = tw1[1]; yy < tw0[1]; yy += Math.max(4, twW*0.9)){ c.beginPath(); c.moveTo(tw0[0] - twW/2, yy); c.lineTo(tw0[0] + twW/2, yy + twW*0.9); c.stroke(); }
    }
    var arm = P(-26, 92), armE = P(-6, 92);
    if (F.ts < 0 && arm && armE){ c.fillStyle = rgb(mixC([20, 22, 26], [110, 112, 118], lightK)); c.fillRect(arm[0], arm[1] - twW*0.15, armE[0] - arm[0], twW*0.3); }
    var pd0 = P(-40, 0), pd1 = P(40, 0);
    if (pd0 && pd1){ c.fillStyle = rgb(mixC([16, 16, 18], [120, 118, 112], lightK)); c.fillRect(pd0[0], pd0[1] - 2, pd1[0] - pd0[0], Math.max(2, Fz*10/pd0[2])); }
  }
  // the rocket, drawn along its projected axis
  var base = P(F.x, F.alt), nose = P(F.x + Math.sin(F.pitch)*RL, F.alt + Math.cos(F.pitch)*RL);
  if (!base || !nose) return {sun: sun, crew: crew, LS: LS};
  var sz = Math.hypot(nose[0] - base[0], nose[1] - base[1]), rot = Math.atan2(nose[0] - base[0], base[1] - nose[1]);
  var plumeL = Math.max(sz*(F.ts < 0 ? 0.15 : 0.55 + Math.min(F.alt/30000, 1.6)), F.ts < 0 ? 0 : 7), fl = 0.9 + 0.1*Math.sin(performance.now()/31);
  c.save(); c.translate(base[0], base[1]); c.rotate(rot);
  if (F.engine > 0){
    // plume: white-hot at the nozzles, orange further out, wider as the air thins
    var pw = Math.max(sz*(crew ? 0.2 : 0.11)*(1 + Math.min(F.alt/20000, 2)), 1.5);
    var pg = c.createLinearGradient(0, 0, 0, plumeL*fl);
    pg.addColorStop(0, 'rgba(255,252,240,1)'); pg.addColorStop(0.25, 'rgba(255,214,140,.9)'); pg.addColorStop(1, 'rgba(255,150,70,0)');
    c.fillStyle = pg; c.beginPath(); c.moveTo(-pw*0.5, 0); c.lineTo(pw*0.5, 0); c.lineTo(pw*1.3, plumeL*fl); c.lineTo(-pw*1.3, plumeL*fl); c.closePath(); c.fill();
  }
  var body = mixC([38, 40, 44], [236, 236, 232], lightK), shade = mixC([20, 22, 26], [168, 170, 174], lightK), dark = mixC([10, 10, 12], [44, 46, 52], lightK);
  var cw = Math.max(sz*(crew ? 0.085 : 0.075), 0.8);
  function cyl(x0, wd, y0, y1, col){ var g = c.createLinearGradient(x0 - wd/2, 0, x0 + wd/2, 0); g.addColorStop(0, rgb(col)); g.addColorStop(0.55, rgb(mixC(col, [255, 255, 255], 0.12))); g.addColorStop(1, rgb(mixC(col, [0, 0, 0], 0.45))); c.fillStyle = g; c.fillRect(x0 - wd/2, y0, wd, y1 - y0); }
  if (crew){
    cyl(0, cw, -sz*0.74, 0, body);                                          // core stage
    c.fillStyle = rgb(dark); c.fillRect(-cw/2, -sz*0.76, cw, sz*0.025);       // interstage band
    cyl(0, cw*0.8, -sz*0.86, -sz*0.76, shade);                                 // upper stage
    c.fillStyle = rgb(shade); c.beginPath(); c.moveTo(-cw*0.42, -sz*0.86); c.lineTo(cw*0.42, -sz*0.86); c.lineTo(cw*0.22, -sz*0.93); c.lineTo(-cw*0.22, -sz*0.93); c.closePath(); c.fill();   // crew capsule
    if (F.ts < 140){ c.strokeStyle = rgb(body); c.lineWidth = Math.max(1, cw*0.12); c.beginPath(); c.moveTo(0, -sz*0.93); c.lineTo(0, -sz); c.stroke(); }   // abort tower
    if (F.ts < 126){ [-1, 1].forEach(function(sd){ cyl(sd*cw*0.78, cw*0.48, -sz*0.62, 0, body); c.fillStyle = rgb(body); c.beginPath(); c.moveTo(sd*cw*0.78 - cw*0.24, -sz*0.62); c.lineTo(sd*cw*0.78 + cw*0.24, -sz*0.62); c.lineTo(sd*cw*0.78, -sz*0.68); c.closePath(); c.fill(); }); }
  } else {
    cyl(0, cw, -sz*0.72, 0, body);
    c.fillStyle = rgb(dark); c.fillRect(-cw/2, -sz*0.74, cw, sz*0.03);
    cyl(0, cw, -sz*0.9, -sz*0.74, body);
    c.fillStyle = rgb(body); c.beginPath(); c.moveTo(-cw/2, -sz*0.9); c.quadraticCurveTo(-cw/2, -sz, 0, -sz); c.quadraticCurveTo(cw/2, -sz, cw/2, -sz*0.9); c.fill();   // payload fairing
  }
  c.restore();
  // side boosters falling away after separation (crewed)
  if (crew && F.ts >= 126){
    var dtb = F.ts - 126, Bp = ascentAt(126);
    [-1, 1].forEach(function(sd){
      var bx = Bp.x + (F.x - Bp.x)*0.6 + sd*dtb*20, ba = Bp.alt + (F.alt - Bp.alt)*0.5 - 2*dtb*dtb, bp = P(bx, ba); if (!bp) return;
      c.save(); c.translate(bp[0], bp[1]); c.rotate(rot + sd*dtb*0.15); c.fillStyle = rgb(body, 0.9); c.fillRect(-Math.max(cw*0.24, 0.6), -sz*0.6, Math.max(cw*0.48, 1.2), Math.max(sz*0.6, 2.5)); c.restore();
    });
  }
  // engine glow: lights the pad and smoke, strongest at night
  if (F.engine > 0){
    var gr = Math.max(sz*1.6, 26)*(F.alt < 2000 ? 1 : 0.7), gp = c.createRadialGradient(base[0], base[1], 0, base[0], base[1], gr);
    var ga = (0.25 + 0.5*(1 - day))*fl;
    gp.addColorStop(0, 'rgba(255,214,150,' + ga.toFixed(3) + ')'); gp.addColorStop(1, 'rgba(255,170,90,0)');
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = gp; c.beginPath(); c.arc(base[0], base[1], gr, 0, Math.PI*2); c.fill(); c.restore();
  }
  return {sun: sun, crew: crew, LS: LS};
}
function night2(S){ return S.night > 0.5; }
function drawLander(c, w, h, yT, sk, E, L, X){
  var bx = w*0.5, by = h*0.93, lh = Math.min(h*0.17, 110), lw = lh*0.9, light = E.light, sunDx = E.sunDx;
  var ax = bx, ay = by, sc = 1;
  if (L && L.flying){ ax = bx - Math.pow(L.tau/LAND.pre, 1.6)*w*0.3; ay = by - L.af*(by - h*0.16); sc = 0.5 + 0.5*(1 - L.af); }
  var groundY = by;
  // shadow
  if (E.sunUp && sk.sunEl > 0.05){
    var rel = wrap180(sk.sunAz + 180 - E.centerAz)*DEG;
    if (L && L.flying){
      var off = Math.min((by - ay)/Math.tan(Math.max(sk.sunEl, 0.3)*DEG)*0.15, w);
      var shx = ax + Math.sin(rel)*off, sa = 0.5*(1 - L.af);
      c.fillStyle = 'rgba(0,0,0,' + sa.toFixed(3) + ')'; c.beginPath(); c.ellipse(shx, groundY, lw*0.5*sc, lw*0.09*sc, 0, 0, Math.PI*2); c.fill();
    } else {
      var Ls = Math.min(lh/Math.tan(Math.max(sk.sunEl, 0.3)*DEG)*0.35, h*3);
      var tx = bx + Math.sin(rel)*Ls, ty = Math.max(by - Math.cos(rel)*Ls*0.22, yT + 2);
      c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.moveTo(bx - lw*0.42, by); c.lineTo(bx + lw*0.42, by); c.lineTo(tx + lw*0.12, ty); c.lineTo(tx - lw*0.12, ty); c.closePath(); c.fill();
    }
  }
  // engine glow on the ground as the lander comes close
  if (L && L.engine > 0){
    var near = L.flying ? clamp(1 - L.alt/120, 0, 1) : 1, gr = w*0.18*(0.4 + near);
    var gl0 = c.createRadialGradient(ax, groundY, 0, ax, groundY, gr);
    gl0.addColorStop(0, 'rgba(255,214,150,' + (0.35*near*L.engine).toFixed(3) + ')'); gl0.addColorStop(1, 'rgba(255,200,140,0)');
    c.fillStyle = gl0; c.beginPath(); c.ellipse(ax, groundY, gr, gr*0.22, 0, 0, Math.PI*2); c.fill();
  }
  // dust blown sideways by the engine near the ground, settling after touchdown
  if (L && L.dust > 0){
    var dd = L.dust, t0 = performance.now()/1000;
    var cloudR = w*0.34*(0.35 + dd), cg = c.createRadialGradient(ax, groundY - lh*0.05, 0, ax, groundY - lh*0.05, cloudR);
    cg.addColorStop(0, 'rgba(214,208,196,' + (0.75*dd).toFixed(3) + ')'); cg.addColorStop(0.5, 'rgba(200,194,182,' + (0.35*dd).toFixed(3) + ')'); cg.addColorStop(1, 'rgba(190,184,172,0)');
    c.fillStyle = cg; c.beginPath(); c.ellipse(ax, groundY - lh*0.05, cloudR, lh*(0.25 + 0.5*dd), 0, 0, Math.PI*2); c.fill();
    for (var q = 0; q < 70; q++){
      var side = q % 2 ? 1 : -1, ph = (q*0.6180339 + t0*(0.9 + (q % 7)*0.08)) % 1;
      var dist = ph*cloudR*1.25, yy = groundY - 2 - Math.sin(ph*Math.PI)*lh*0.08*((q % 5) + 1)/5;
      c.fillStyle = 'rgba(225,220,208,' + (0.6*dd*(1 - ph)).toFixed(3) + ')';
      c.fillRect(ax + side*dist, yy, 2 + (q % 3), 1.5);
    }
    for (q = 0; q < 18; q++){
      var a2 = (q/18)*Math.PI, ln = cloudR*(0.6 + 0.4*Math.sin(q*3.7 + t0*3));
      c.strokeStyle = 'rgba(220,214,202,' + (0.22*dd).toFixed(3) + ')'; c.lineWidth = 1.5 + 3*dd;
      c.beginPath(); c.moveTo(ax, groundY - 3); c.lineTo(ax + Math.cos(a2)*ln, groundY - 3 - Math.sin(a2)*ln*0.04); c.stroke();
    }
  }
  var lit = E.sunUp ? 0.55 + 0.45*light : E.shine ? 0.25 : 0.12;
  c.save(); c.translate(ax, ay); c.scale(sc, sc);
  // engine plume: faint in vacuum, brightest at the nozzle
  if (L && L.engine > 0){
    var fl = 0.88 + 0.12*Math.sin(performance.now()/37) + 0.05*Math.sin(performance.now()/11);
    var pl = (L.flying ? Math.min((groundY - ay)/sc + lh*0.05, lh*2.2) : lh*0.45)*fl;
    var pg = c.createLinearGradient(0, -lh*0.3, 0, -lh*0.3 + pl);
    pg.addColorStop(0, 'rgba(255,250,235,' + (1*L.engine).toFixed(3) + ')'); pg.addColorStop(0.2, 'rgba(255,200,130,' + (0.6*L.engine).toFixed(3) + ')'); pg.addColorStop(1, 'rgba(255,170,100,0)');
    c.fillStyle = pg; c.beginPath(); c.moveTo(-lw*0.07, -lh*0.3); c.lineTo(lw*0.07, -lh*0.3); c.lineTo(lw*0.3, -lh*0.3 + pl); c.lineTo(-lw*0.3, -lh*0.3 + pl); c.closePath(); c.fill();
    var ng = c.createRadialGradient(0, -lh*0.28, 0, 0, -lh*0.28, lh*0.35);
    ng.addColorStop(0, 'rgba(255,240,210,' + (0.7*L.engine).toFixed(3) + ')'); ng.addColorStop(1, 'rgba(255,220,170,0)');
    c.fillStyle = ng; c.beginPath(); c.arc(0, -lh*0.28, lh*0.35, 0, Math.PI*2); c.fill();
  }
  // descent stage: legs, descent engine and the gold body (it stays on the Moon after a crewed liftoff)
  c.strokeStyle = 'rgba(200,205,212,' + lit + ')'; c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(-lw*0.42, 0); c.lineTo(-lw*0.22, -lh*0.42); c.moveTo(lw*0.42, 0); c.lineTo(lw*0.22, -lh*0.42); c.moveTo(-lw*0.18, 0); c.lineTo(-lw*0.1, -lh*0.4); c.moveTo(lw*0.18, 0); c.lineTo(lw*0.1, -lh*0.4); c.stroke();
  c.fillStyle = 'rgba(90,92,98,' + lit + ')'; c.beginPath(); c.moveTo(-lw*0.06, -lh*0.38); c.lineTo(lw*0.06, -lh*0.38); c.lineTo(lw*0.08, -lh*0.3); c.lineTo(-lw*0.08, -lh*0.3); c.closePath(); c.fill();
  var bg = c.createLinearGradient(-lw*0.3, 0, lw*0.3, 0);
  bg.addColorStop(sunDx > 0 ? 0 : 1, 'rgba(70,64,40,' + lit + ')'); bg.addColorStop(sunDx > 0 ? 1 : 0, 'rgba(232,196,96,' + lit + ')');
  c.fillStyle = bg; c.fillRect(-lw*0.3, -lh*0.72, lw*0.6, lh*0.34);
  c.restore();
  if (X && X.baseOnly) return;
  // ascent stage (crew cabin, mast, panel, dish): rises on its own engine at liftoff
  var F = X && X.lift, ux = ax, uy = ay, us = sc;
  if (F){ ux = ax + Math.min(F.x/700, 1)*w*0.32; uy = ay - F.af*(by - h*0.14); us = sc*(1 - 0.45*F.af); }
  c.save(); c.translate(ux, uy); c.scale(us, us);
  if (F && F.engine > 0){
    var fl2 = 0.85 + 0.15*Math.sin(performance.now()/29), reach = (ay - uy)/us;
    var pl2 = Math.max(lh*0.35, Math.min(reach - lh*0.05, lh*2.4))*fl2;
    var pg2 = c.createLinearGradient(0, -lh*0.72, 0, -lh*0.72 + pl2);
    pg2.addColorStop(0, 'rgba(255,250,235,1)'); pg2.addColorStop(0.25, 'rgba(255,200,130,.6)'); pg2.addColorStop(1, 'rgba(255,170,100,0)');
    c.fillStyle = pg2; c.beginPath(); c.moveTo(-lw*0.05, -lh*0.72); c.lineTo(lw*0.05, -lh*0.72); c.lineTo(lw*0.24, -lh*0.72 + pl2); c.lineTo(-lw*0.24, -lh*0.72 + pl2); c.closePath(); c.fill();
    var ng2 = c.createRadialGradient(0, -lh*0.7, 0, 0, -lh*0.7, lh*0.3);
    ng2.addColorStop(0, 'rgba(255,240,210,.75)'); ng2.addColorStop(1, 'rgba(255,220,170,0)');
    c.fillStyle = ng2; c.beginPath(); c.arc(0, -lh*0.7, lh*0.3, 0, Math.PI*2); c.fill();
  }
  if (X && X.crew){
    c.fillStyle = 'rgba(150,156,168,' + lit + ')'; c.fillRect(-lw*0.22, -lh*0.98, lw*0.44, lh*0.26);
    c.fillStyle = 'rgba(20,24,32,' + Math.min(1, lit + 0.2) + ')'; c.fillRect(-lw*0.12, -lh*0.93, lw*0.09, lh*0.08); c.fillRect(lw*0.03, -lh*0.93, lw*0.09, lh*0.08);
  }
  c.fillStyle = 'rgba(120,130,150,' + lit + ')'; c.fillRect(-lw*0.04, -lh*1.05, lw*0.08, lh*0.34);
  c.fillStyle = 'rgba(40,70,140,' + Math.min(1, lit + 0.1) + ')'; c.fillRect(-lw*0.42, -lh*1.12, lw*0.84, lh*0.14);
  c.strokeStyle = 'rgba(160,190,240,' + lit + ')'; c.lineWidth = 1; for (var p = -3; p <= 3; p++){ c.beginPath(); c.moveTo(p*lw*0.12, -lh*1.12); c.lineTo(p*lw*0.12, -lh*0.98); c.stroke(); }
  var dish = wrap180(sk.earthAz - E.centerAz) > 0 ? 1 : -1;
  c.strokeStyle = 'rgba(220,225,232,' + lit + ')'; c.lineWidth = 2; c.beginPath(); c.arc(lw*0.22*dish, -lh*0.82, lh*0.1, dish > 0 ? -2.4 : -0.7, dish > 0 ? 0.7 : 2.4, dish < 0); c.stroke();
  c.restore();
  // crew outside during the stay: two astronauts beside the lander (illustrative, about to scale with the lander)
  if (X && X.walk && !F){
    var tw = performance.now()/1000, ah = lh*0.36;
    [[-0.95, 0], [1.25, 1.7]].forEach(function(A, n){
      var px = ax + A[0]*lw + Math.sin(tw*0.35 + A[1])*lw*0.12, bob = Math.abs(Math.sin(tw*2.2 + A[1]))*ah*0.05, py = by - bob, face = Math.cos(tw*0.35 + A[1]) > 0 ? 1 : -1;
      if (E.sunUp && sk.sunEl > 0.05){ var rel2 = wrap180(sk.sunAz + 180 - E.centerAz)*DEG, Ls2 = Math.min(ah/Math.tan(Math.max(sk.sunEl, 0.3)*DEG)*0.35, h); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = ah*0.16; c.beginPath(); c.moveTo(px, by); c.lineTo(px + Math.sin(rel2)*Ls2, Math.max(by - Math.cos(rel2)*Ls2*0.22, yT + 2)); c.stroke(); }
      var suit = 'rgba(' + Math.round(228*lit) + ',' + Math.round(230*lit) + ',' + Math.round(232*lit) + ',1)', sh2 = 'rgba(' + Math.round(150*lit) + ',' + Math.round(154*lit) + ',' + Math.round(160*lit) + ',1)';
      var step = Math.sin(tw*2.2 + A[1])*ah*0.08;
      c.strokeStyle = suit; c.lineCap = 'round'; c.lineWidth = ah*0.14;
      c.beginPath(); c.moveTo(px - ah*0.05, py - ah*0.42); c.lineTo(px - ah*0.06 - step, py); c.moveTo(px + ah*0.05, py - ah*0.42); c.lineTo(px + ah*0.06 + step, py); c.stroke();   // legs
      c.fillStyle = sh2; c.fillRect(px - face*ah*0.2, py - ah*0.82, ah*0.13, ah*0.32);                                                             // backpack
      c.fillStyle = suit; c.beginPath(); c.moveTo(px - ah*0.13, py - ah*0.42); c.lineTo(px + ah*0.13, py - ah*0.42); c.lineTo(px + ah*0.12, py - ah*0.8); c.lineTo(px - ah*0.12, py - ah*0.8); c.closePath(); c.fill();   // body
      c.lineWidth = ah*0.1; c.beginPath(); c.moveTo(px + face*ah*0.1, py - ah*0.76); c.lineTo(px + face*ah*0.2, py - ah*0.5); c.stroke();      // arm
      c.beginPath(); c.arc(px, py - ah*0.9, ah*0.12, 0, Math.PI*2); c.fill();                                                                // helmet
      var vg = c.createLinearGradient(px, py - ah*0.98, px + face*ah*0.12, py - ah*0.84); vg.addColorStop(0, 'rgba(255,214,120,' + (0.6 + 0.4*lit).toFixed(2) + ')'); vg.addColorStop(1, 'rgba(120,80,20,' + (0.6 + 0.4*lit).toFixed(2) + ')');
      c.fillStyle = vg; c.beginPath(); c.ellipse(px + face*ah*0.04, py - ah*0.9, ah*0.075, ah*0.065, 0, 0, Math.PI*2); c.fill();             // gold visor
    });
  }
  // insulation flakes blown off the descent stage at ignition, falling back on ballistic arcs (no air on the Moon)
  if (F && F.debris > 0){
    var g2 = 1.62*sc*lh/3.5, t2 = F.t*1.6;
    for (var q2 = 0; q2 < 36; q2++){
      var a2 = -Math.PI*(0.08 + 0.84*((q2*0.618) % 1)), v2 = (0.5 + ((q2*0.377) % 1))*lh*1.4;
      var px2 = ax + Math.cos(a2)*v2*t2, py2 = ay - lh*0.72*sc + Math.sin(a2)*v2*t2 + 0.5*g2*t2*t2;
      if (py2 > by) continue;
      c.fillStyle = q2 % 3 ? 'rgba(232,196,96,' + (0.9*F.debris).toFixed(3) + ')' : 'rgba(220,224,230,' + (0.9*F.debris).toFixed(3) + ')';
      c.save(); c.translate(px2, py2); c.rotate(q2 + t2*4); c.fillRect(-2, -1, 4, 2); c.restore();
    }
  }
}
function autoAz(site, fi){
  var sk = skyInterp(site, fi);
  var d = wrap180(sk.earthAz - sk.sunAz);
  if (Math.abs(d) < look.fov - 16) return (sk.sunAz + d/2 + 360) % 360;
  return sk.sunEl - hzAt(prepSite(site), sk.sunAz) > 0 ? sk.sunAz : sk.earthAz;
}
