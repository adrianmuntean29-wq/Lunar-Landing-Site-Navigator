/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): the
   mission timeline and the 3D flight path (Earth-centred, Moon orbit in the XY plane). */
/* =====================================================================
   mission timeline + 3D path (km, Earth-centred, Moon orbit in XY plane)
   ===================================================================== */
var OMEGA = -2.25;
function moonAngle(t, M){ return M.thArr + 2*Math.PI/(C.siderealMonth*86400)*(t - M.tLOI); }
function moonPos(t, M){ var a = moonAngle(t, M); return [C.dEM*Math.cos(a), C.dEM*Math.sin(a), 0]; }
function bodyAxes(t, M){ var a = moonAngle(t, M); return {x: [-Math.cos(a), -Math.sin(a), 0], y: [Math.sin(a), -Math.cos(a), 0], z: [0, 0, 1]}; }
function toBody(v, ax){ return [dot(v, ax.x), dot(v, ax.y), dot(v, ax.z)]; }
function fromBody(b, ax){ return add(add(mul(ax.x, b[0]), mul(ax.y, b[1])), mul(ax.z, b[2])); }
function siteUnit(s){ var f = s.lat*DEG, l = s.lon*DEG; return [Math.cos(f)*Math.cos(l), Math.cos(f)*Math.sin(l), Math.sin(f)]; }

function buildMission(){
  var key = active, B = budgets[key], P = B.P, siteId = target[key];
  var R = results[key].filter(function(r){ return r.site.id === siteId; })[0] || null;
  var site = R ? R.site : SITES[0];
  var M = {key: key, B: B, site: site, R: R};
  var PLEO = 2*Math.PI*Math.sqrt(B.r1*B.r1*B.r1/C.muE);
  M.tAsc = 600;
  var duAsc = 2*Math.PI*M.tAsc/PLEO;
  M.u0 = Math.PI/2; M.uAscEnd = M.u0 + duAsc;
  M.tTLI = M.tAsc + (2*Math.PI - M.uAscEnd)/(2*Math.PI)*PLEO;
  M.PLEO = PLEO;
  M.tLOI = M.tTLI + B.tr.tof*86400;
  M.tLand = M.tLOI + P.lloBefore*86400;
  M.tDOI = M.tLand - 3600;
  M.tLift = M.tLand + P.stay*86400;
  if (key === 'crewed'){ M.tLLO2 = M.tLift + 3600; M.tTEI = M.tLift + P.lloAfter*86400; M.tEnd = M.tTEI + B.tr.tof*86400; }
  else M.tEnd = M.tLift;
  M.thArr = OMEGA + B.tr.nu2;
  var i = B.incl*DEG, n = [Math.cos(OMEGA), Math.sin(OMEGA), 0], mm = [-Math.sin(OMEGA), Math.cos(OMEGA), 0];
  M.n = n; M.q = add(mul(mm, Math.cos(i)), [0, 0, Math.sin(i)]);
  M.PLLO = 2*Math.PI*Math.sqrt(B.rL*B.rL*B.rL/C.muM);
  var mHat = norm(moonPos(M.tLOI, M)), tHat = cross([0, 0, 1], mHat);
  M.aHat = norm(add(mHat, tHat));
  M.phi0 = Math.PI*0.62;
  M.landMs = launchMs + M.tLand*1000;
  var axL = bodyAxes(M.tLand, M), sp = EPH.at(new Date(M.landMs)).sun, sLat = sp.lat*DEG, sLon = sp.lon*DEG;
  M.sun = norm(fromBody([Math.cos(sLat)*Math.cos(sLon), Math.cos(sLat)*Math.sin(sLon), Math.sin(sLat)], axL));
  M.siteB = siteUnit(site);
  var dirs = [];
  M.llo = function(t){ var ph = M.phi0 + 2*Math.PI*(t - M.tLOI)/M.PLLO; return add(mul(M.aHat, B.rL*Math.cos(ph)), [0, 0, B.rL*Math.sin(ph)]); };
  var dB = toBody(M.llo(M.tDOI), bodyAxes(M.tDOI, M));
  M.doiDir = norm(dB);
  var sB = M.siteB, aB = toBody(M.aHat, bodyAxes(M.tLift, M));
  var proj = norm(add(mul(aB, dot(sB, aB)), [0, 0, sB[2]]));
  M.ascDir = proj;
  M.phiAsc = Math.atan2(dot(fromBody(proj, bodyAxes(M.tLift, M)), [0, 0, 1]), dot(fromBody(proj, bodyAxes(M.tLift, M)), M.aHat));
  mission = M;
  buildPath();
}
function phaseAt(t){
  var M = mission;
  if (t < M.tAsc) return 'Ascent to orbit';
  if (t < M.tTLI) return 'Parking orbit';
  if (t < M.tLOI) return 'Translunar coast';
  if (t < M.tDOI) return 'Lunar orbit';
  if (t < M.tLand) return 'Powered descent';
  if (t < M.tLift || M.key !== 'crewed') return M.key === 'crewed' ? 'On the surface' : 'Surface operations';
  if (t < M.tLLO2) return 'Lunar ascent';
  if (t < M.tTEI) return 'Lunar orbit (return)';
  return 'Return to Earth';
}
/* returns {f: 'I' inertial | 'M' moon-body, v} */
function stateAt(t){
  var M = mission, B = M.B, tr = B.tr;
  t = clamp(t, 0, M.tEnd);
  if (t < M.tAsc){
    var s = ease(t/M.tAsc), u = M.u0 + (M.uAscEnd - M.u0)*t/M.tAsc, r = C.RE + (B.r1 - C.RE)*s;
    return {f: 'I', v: add(mul(M.n, r*Math.cos(u)), mul(M.q, r*Math.sin(u)))};
  }
  if (t < M.tTLI){
    var u2 = M.uAscEnd + (2*Math.PI - M.uAscEnd)*(t - M.tAsc)/(M.tTLI - M.tAsc);
    return {f: 'I', v: add(mul(M.n, B.r1*Math.cos(u2)), mul(M.q, B.r1*Math.sin(u2)))};
  }
  if (t < M.tLOI){
    var tau = t - M.tTLI, c = onConic(tr, tau), ang = OMEGA + c.nu;
    var p = [c.r*Math.cos(ang), c.r*Math.sin(ang), 0];
    var Tb = Math.min(8*3600, (M.tLOI - M.tTLI)*0.25), w = clamp((t - (M.tLOI - Tb))/Tb, 0, 1);
    if (w > 0){
      var tgt = add(moonPos(t, M), M.llo(M.tLOI));
      var far = add(moonPos(t, M), mul(norm(sub(p, moonPos(t, M))), Math.max(B.rL, len(sub(p, moonPos(t, M))))));
      p = add(mul(far, 1 - ease(w)), mul(tgt, ease(w)));
    }
    return {f: 'I', v: p};
  }
  if (t < M.tDOI) return {f: 'M', v: toBody(M.llo(t), bodyAxes(t, M))};
  if (t < M.tLand){
    var s3 = (t - M.tDOI)/(M.tLand - M.tDOI), d = slerp(M.doiDir, M.siteB, ease(s3)), rr = B.rL + (C.RM - B.rL)*ease(s3);
    return {f: 'M', v: mul(d, rr)};
  }
  if (M.key !== 'crewed' || t < M.tLift) return {f: 'M', v: mul(M.siteB, C.RM)};
  if (t < M.tLLO2){
    var s4 = (t - M.tLift)/(M.tLLO2 - M.tLift), d2 = slerp(M.siteB, M.ascDir, ease(s4)), r4 = C.RM + (B.rL - C.RM)*ease(s4);
    return {f: 'M', v: mul(d2, r4)};
  }
  var llo2 = function(tt){ var ph = M.phiAsc + 2*Math.PI*(tt - M.tLLO2)/M.PLLO; return add(mul(M.aHat, B.rL*Math.cos(ph)), [0, 0, B.rL*Math.sin(ph)]); };
  if (t < M.tTEI) return {f: 'M', v: toBody(llo2(t), bodyAxes(t, M))};
  var th = moonAngle(M.tTEI, M), wRet = th + tr.nu2, rem = M.tEnd - t, cc = onConic(tr, rem), a2 = wRet - cc.nu;
  var pr = [cc.r*Math.cos(a2), cc.r*Math.sin(a2), 0];
  var Tb2 = Math.min(8*3600, (M.tEnd - M.tTEI)*0.25), w2 = clamp(1 - (t - M.tTEI)/Tb2, 0, 1);
  if (w2 > 0){
    var mp = moonPos(t, M), start = add(mp, llo2(M.tTEI));
    var far2 = add(mp, mul(norm(sub(pr, mp)), Math.max(B.rL, len(sub(pr, mp)))));
    pr = add(mul(far2, 1 - ease(w2)), mul(start, ease(w2)));
  }
  return {f: 'I', v: pr};
}
function inertial(st, t){ return st.f === 'I' ? st.v : add(moonPos(t, mission), fromBody(st.v, bodyAxes(t, mission))); }
var path = [];
function buildPath(){
  var M = mission, out = [];
  function seg(t0, t1, n){ for (var k = 0; k < n; k++){ var t = t0 + (t1 - t0)*k/n; out.push({t: t, s: stateAt(t)}); } }
  seg(0, M.tAsc, 20); seg(M.tAsc, M.tTLI, 80);
  var nT = 500; for (var k = 0; k < nT; k++){ var f = k/nT, t = M.tTLI + (M.tLOI - M.tTLI)*(1 - Math.cos(f*Math.PI))/2; out.push({t: t, s: stateAt(t)}); }
  seg(M.tLOI, M.tDOI, Math.min(1400, Math.ceil((M.tDOI - M.tLOI)/M.PLLO*70)));
  seg(M.tDOI, M.tLand, 40);
  out.push({t: M.tLand, s: stateAt(M.tLand)});
  if (M.key === 'crewed'){
    out.push({t: M.tLift, s: stateAt(M.tLift), brk: true});
    seg(M.tLift, M.tLLO2, 30);
    seg(M.tLLO2, M.tTEI, Math.ceil((M.tTEI - M.tLLO2)/M.PLLO*70));
    for (var j = 0; j <= nT; j++){ var g = j/nT, tt = M.tTEI + (M.tEnd - M.tTEI)*(1 - Math.cos(g*Math.PI))/2; out.push({t: tt, s: stateAt(tt)}); }
  } else out.push({t: M.tEnd, s: stateAt(M.tEnd), brk: true});
  path = out;
  met = clamp(met, 0, M.tEnd);
}

