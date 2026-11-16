/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): drawing
   the flight in 3D (orthographic, canvas 2D). */
/* =====================================================================
   3D drawing (orthographic, canvas 2D)
   ===================================================================== */
var sc = $('#sc'), ctx = sc.getContext('2d'), vp = $('#vp'), W = 1, H = 1, DPR = 1;
var stars = []; (function(){ var a = 7; function r(){ a = (a*16807) % 2147483647; return a/2147483647; } for (var i = 0; i < 260; i++) stars.push([r(), r(), r()*0.9 + 0.1]); })();
function viewSetup(){
  var t = met, M = mission, mp = moonPos(t, M), center, span, bE, bM;
  if (view === 'earth'){ center = [0, 0, 0]; span = 48000; bE = 1; bM = 1; }
  else if (view === 'moon'){ center = mp; span = 7600; bE = 1; bM = 1; }
  else { center = mul(mp, 0.5); span = C.dEM*1.25; bE = 3.2; bM = 5.5; }
  var scale = Math.min(W, H)/span*cam.zoom;
  return {t: t, center: center, scale: scale, bE: bE, bM: bM, mp: mp, ax: bodyAxes(t, M)};
}
var VS;
/* where a path sample is drawn: inertial in System/Earth views, Moon-fixed (attached to today's Moon) in the Moon view */
function placeSample(st, ts, V){
  if (st.f === 'M') return view === 'moon' ? add(V.mp, fromBody(st.v, V.ax)) : inertial(st, ts);
  if (view !== 'moon') return st.v;
  var rel = toBody(sub(st.v, moonPos(ts, mission)), bodyAxes(ts, mission));
  return add(V.mp, fromBody(rel, V.ax));
}
function exag(p, V, mpS){
  if (V.bE === 1 && V.bM === 1) return p;
  var mp = mpS || V.mp;
  var r = len(p), L = 40000, kE = 1 + (V.bE - 1)/(1 + (r/L)*(r/L));
  var pe = mul(p, kE);
  var d = sub(p, mp), rd = len(d), Lm = 9000, wM = 1/(1 + (rd/Lm)*(rd/Lm));
  if (wM < 1e-4) return pe;
  var me = mul(mp, 1 + (V.bE - 1)/(1 + (C.dEM/L)*(C.dEM/L)));
  var pm = add(me, mul(d, 1 + (V.bM - 1)*wM));
  return add(mul(pe, 1 - wM), mul(pm, wM));
}
function proj(p, mpS){
  var V = VS, q = sub(exag(p, V, mpS), exag(V.center, V));
  var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  var x1 = q[0]*cy - q[1]*sy, y1 = q[0]*sy + q[1]*cy, z1 = q[2];
  return [W/2 + x1*V.scale, H/2 - (y1*sp + z1*cp)*V.scale, -y1*cp + z1*sp];
}
function drawSphere(c, r, color, sunDir, label){
  var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  var sx = sunDir[0]*cy - sunDir[1]*sy, syy = sunDir[0]*sy + sunDir[1]*cy, sz = sunDir[2];
  var hx = sx, hy = -(syy*sp + sz*cp);
  var g = ctx.createRadialGradient(c[0] + hx*r*0.55, c[1] + hy*r*0.55, r*0.05, c[0], c[1], r*1.05);
  g.addColorStop(0, color[0]); g.addColorStop(0.55, color[1]); g.addColorStop(1, color[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], Math.max(r, 1.5), 0, Math.PI*2); ctx.fill();
  if (label){ ctx.fillStyle = tok('--space-muted'); ctx.font = '600 11.5px ' + tok('--f-mono'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, c[0] + Math.max(r, 3) + 6, c[1]); }
}
function render(){
  if (!mission) return;
  VS = viewSetup();
  var V = VS, M = mission, colMission = M.key === 'crewed' ? tok('--crew-fill') : tok('--robot-fill');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = tok('--space'); ctx.fillRect(0, 0, W, H);
  for (var i = 0; i < stars.length; i++){ ctx.globalAlpha = stars[i][2]*0.55; ctx.fillStyle = '#C8D0DA'; ctx.fillRect(stars[i][0]*W, stars[i][1]*H, 1.1, 1.1); }
  ctx.globalAlpha = 1;
  var eC = proj([0, 0, 0]), mC = proj(V.mp), rE = C.RE*V.bE*V.scale, rM = C.RM*V.bM*V.scale;
  // Moon orbit
  ctx.strokeStyle = 'rgba(200,210,220,.16)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath();
  for (var k = 0; k <= 180; k++){ var a = k/180*Math.PI*2, pp = proj([C.dEM*Math.cos(a), C.dEM*Math.sin(a), 0]); if (k) ctx.lineTo(pp[0], pp[1]); else ctx.moveTo(pp[0], pp[1]); }
  ctx.stroke(); ctx.setLineDash([]);
  // path points
  var pts = path.map(function(o){
    return {p: proj(placeSample(o.s, o.t, V), view === 'moon' ? V.mp : moonPos(o.t, M)), t: o.t, brk: !!o.brk};
  });
  if (view === 'system'){
    var ghost = proj(moonPos(M.tLOI, M), moonPos(M.tLOI, M));
    ctx.strokeStyle = 'rgba(228,232,236,.35)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ghost[0], ghost[1], Math.max(rM, 4), 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    if (Math.hypot(ghost[0] - mC[0], ghost[1] - mC[1]) > rM*2.5){
      ctx.font = '500 10.5px ' + tok('--f-mono'); ctx.fillStyle = tok('--space-muted'); ctx.textBaseline = 'top';
      var gw = ctx.measureText('Moon at arrival').width, gx = ghost[0] + Math.max(rM, 4) + 4;
      if (gx + gw > W - 8){ ctx.textAlign = 'right'; gx = ghost[0] - Math.max(rM, 4) - 4; } else ctx.textAlign = 'left';
      ctx.fillText('Moon at arrival', gx, ghost[1] + 4);
    }
  }
  function behind(pt){
    var dx = pt[0] - eC[0], dy = pt[1] - eC[1];
    if (dx*dx + dy*dy < rE*rE && pt[2] < eC[2]) return true;
    dx = pt[0] - mC[0]; dy = pt[1] - mC[1];
    if (dx*dx + dy*dy < rM*rM*0.98 && pt[2] < mC[2]) return true;
    return false;
  }
  function strokeRuns(wantBehind){
    var styleKey = null;
    for (var j = 1; j < pts.length; j++){
      var a = pts[j - 1], b = pts[j], mid = [(a.p[0] + b.p[0])/2, (a.p[1] + b.p[1])/2, (a.p[2] + b.p[2])/2];
      if (b.brk || behind(mid) !== wantBehind) { if (styleKey){ ctx.stroke(); styleKey = null; } continue; }
      var past = b.t <= V.t, key = past ? 'p' : 'f';
      if (key !== styleKey){
        if (styleKey) ctx.stroke();
        ctx.beginPath(); ctx.moveTo(a.p[0], a.p[1]);
        ctx.strokeStyle = colMission; ctx.globalAlpha = (past ? 1 : 0.42)*(wantBehind ? 0.35 : 1);
        ctx.lineWidth = past ? 2 : 1.3; ctx.setLineDash(past ? [] : [5, 5]);
        styleKey = key;
      }
      ctx.lineTo(b.p[0], b.p[1]);
    }
    if (styleKey) ctx.stroke();
    ctx.globalAlpha = 1; ctx.setLineDash([]);
  }
  strokeRuns(true);
  var bodies = [{c: eC, r: rE, col: ['#9CC9FF', '#2D6FB8', '#0B1E36'], label: 'Earth', d: eC[2]}, {c: mC, r: rM, col: ['#E9E6E0', '#9A978F', '#2A2A2A'], label: 'Moon', d: mC[2]}];
  bodies.sort(function(a, b){ return a.d - b.d; });
  bodies.forEach(function(b){ drawSphere(b.c, b.r, b.col, M.sun, b.label); });
  // launch site on Earth, south pole + site on Moon
  var L = M.B.L, rot = C.wE*V.t, s0 = norm(add(mul(M.n, Math.cos(M.u0)), mul(M.q, Math.sin(M.u0))));
  var siteE = [s0[0]*Math.cos(rot) - s0[1]*Math.sin(rot), s0[0]*Math.sin(rot) + s0[1]*Math.cos(rot), s0[2]];
  var pL = proj(mul(siteE, C.RE)); if (pL[2] >= eC[2] || len([pL[0] - eC[0], pL[1] - eC[1], 0]) > rE*0.98) mark(pL, '#FF6B5B', view === 'earth' ? (L.name.split(' (')[0]) : '');
  var siteI = add(V.mp, fromBody(mul(M.siteB, C.RM), V.ax)), pS = proj(siteI);
  if (pS[2] >= mC[2] - rM*0.02) mark(pS, colMission, view === 'moon' ? M.site.name : '');
  var pole = proj(add(V.mp, [0, 0, -C.RM]));
  if (view === 'moon' && pole[2] >= mC[2] - rM*0.02){ ctx.strokeStyle = 'rgba(228,232,236,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(pole[0], pole[1], 4, 0, Math.PI*2); ctx.stroke(); }
  strokeRuns(false);
  // events
  var ev = [[M.tTLI, 'TLI'], [M.tLOI, 'LOI'], [M.tLand, 'Landing']];
  if (M.key === 'crewed') ev.push([M.tTEI, 'TEI'], [M.tEnd, 'Entry']);
  ev.forEach(function(e){
    var st = stateAt(e[0]), pe = proj(placeSample(st, e[0], V), view === 'moon' ? V.mp : moonPos(e[0], M));
    if (behind(pe)) return;
    ctx.fillStyle = tok('--space-ink'); ctx.beginPath(); ctx.arc(pe[0], pe[1], 2.6, 0, Math.PI*2); ctx.fill();
    ctx.font = '500 10.5px ' + tok('--f-mono'); ctx.fillStyle = tok('--space-muted'); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(e[1], pe[0] + 5, pe[1] - 3);
  });
  // spacecraft
  var cur = stateAt(V.t), cI = cur.f === 'I' ? cur.v : add(V.mp, fromBody(cur.v, V.ax)), pc = proj(cI);
  ctx.fillStyle = colMission; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(pc[0], pc[1], 9, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(pc[0], pc[1], 4, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#05070A'; ctx.lineWidth = 1.2; ctx.stroke();
  updateHud(cI, V);
}
function mark(p, color, label){
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0], p[1], 3.6, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#05070A'; ctx.lineWidth = 1; ctx.stroke();
  if (label){ ctx.font = '600 11px ' + tok('--f-mono'); ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, p[0] + 7, p[1]); }
}
var hudEl = $('#hud');
function updateHud(pI, V){
  var M = mission, t = V.t, dt = 30, a = inertial(stateAt(Math.max(0, t - dt)), Math.max(0, t - dt)), b = inertial(stateAt(Math.min(M.tEnd, t + dt)), Math.min(M.tEnd, t + dt));
  var speed = len(sub(b, a))/(Math.min(M.tEnd, t + dt) - Math.max(0, t - dt) || 1);
  var dE = len(pI) - C.RE, dM = len(sub(pI, V.mp)) - C.RM;
  hudEl.innerHTML =
    '<span><b>' + fmtDate(launchMs + t*1000) + '</b></span>' +
    '<span>T+ <b>' + dhm(t) + '</b></span>' +
    '<span><b>' + phaseAt(t) + '</b></span>' +
    '<span>Earth alt <b>' + Math.round(dE).toLocaleString('en-US') + '</b> km</span>' +
    '<span>Moon alt <b>' + Math.round(Math.max(0, dM)).toLocaleString('en-US') + '</b> km</span>' +
    '<span>v <b>' + speed.toFixed(2) + '</b> km/s</span>';
  $('#scaleNote').textContent = view === 'system' ? 'Earth ×3.2 and Moon ×5.5 so they are visible; distances true' : 'True scale';
  $('#metOut').textContent = 'T+ ' + dhm(t);
}

