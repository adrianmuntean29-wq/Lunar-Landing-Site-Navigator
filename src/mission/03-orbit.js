/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): orbital
   mechanics: transfer orbits, delta-v and propellant. */
/* =====================================================================
   orbital mechanics
   ===================================================================== */
function circV(mu, r){ return Math.sqrt(mu/r); }
/* conic with periapsis r1 that reaches r2 after T days (elliptic, prograde) */
function transfer(r1, r2, Tdays){
  var mu = C.muE, T = Tdays*86400, e0 = (r2 - r1)/(r2 + r1);
  function tof(e){
    var a = r1/(1 - e), cosE = clamp((1 - r2/a)/e, -1, 1), E = Math.acos(cosE);
    return Math.sqrt(a*a*a/mu)*(E - e*Math.sin(E));
  }
  var tH = tof(e0), e;
  if (T >= tH) e = e0;
  else {
    var lo = e0, hi = 0.99999;
    if (T <= tof(hi)) e = hi;
    else { for (var k = 0; k < 90; k++){ var mid = (lo + hi)/2; if (tof(mid) > T) lo = mid; else hi = mid; } e = (lo + hi)/2; }
  }
  var a = r1/(1 - e), p = a*(1 - e*e), h = Math.sqrt(mu*p), cosNu = clamp((p/r2 - 1)/e, -1, 1), nu2 = Math.acos(cosNu);
  return {e: e, a: a, p: p, nu2: nu2, vr: mu/h*e*Math.sin(nu2), vt: mu/h*(1 + e*cosNu), vp: mu/h*(1 + e),
          tof: tof(e)/86400, tH: tH/86400};
}
function keplerE(M, e){
  var E = e < 0.8 ? M : Math.PI;
  for (var k = 0; k < 60; k++){ var f = E - e*Math.sin(E) - M, fp = 1 - e*Math.cos(E), d = f/fp; E -= d; if (Math.abs(d) < 1e-12) break; }
  return E;
}
/* position on a transfer conic, tau seconds after periapsis: {r, nu} */
function onConic(tr, tau){
  var n = Math.sqrt(C.muE/(tr.a*tr.a*tr.a)), E = keplerE(n*tau, tr.e);
  return {r: tr.a*(1 - tr.e*Math.cos(E)), nu: 2*Math.atan2(Math.sqrt(1 + tr.e)*Math.sin(E/2), Math.sqrt(1 - tr.e)*Math.cos(E/2))};
}
/* one stage: payload carried, Δv, Isp, dry/propellant ratio k */
function stage(payload, dv, isp, k){
  var R = Math.exp(dv/(isp*C.g0)), den = 1 - k*(R - 1);
  if (den <= 0.02) return null;
  var mf = payload/den, mi = mf*R;
  return {wet: mi, prop: mi - mf, dry: k*(mi - mf)};
}

function budget(key, tMs){
  var P = PROFILES[key], L = LAUNCH_SITES[launchIdx], tL = tMs === undefined ? launchMs : tMs;
  var r1 = C.RE + P.parkingAlt, rL = C.RM + P.lloAlt;
  var arr = tL + (tliDays(key) + Math.min(P.tof, 5))*86400000, mArr = moonRADec(arr);
  var incl = Math.max(Math.abs(L.lat), Math.abs(mArr.dec) + 0.3), sinAz = clamp(Math.cos(incl*DEG)/Math.cos(L.lat*DEG), -1, 1);
  var vLEO = circV(C.muE, r1), vRot = 0.46510*Math.cos(L.lat*DEG)*sinAz;
  var tr = transfer(r1, C.dEM, P.tof);   /* drawing + timeline: mean distance */
  var dArr = arrivalDist(key, tL), trD = transfer(r1, dArr, P.tof), vM = Math.sqrt(C.muE*(2/dArr - 1/384748));   /* Δv: real distance on arrival */
  var vinf = Math.hypot(trD.vr, trD.vt - vM);
  var vLLO = circV(C.muM, rL);
  var dv = {};
  dv.ascent = vLEO + C.launchLosses - vRot;
  dv.tli = trD.vp - vLEO;
  dv.mcc = P.midcourse*(key === 'crewed' ? 2 : 1);
  dv.loi = Math.sqrt(vinf*vinf + 2*C.muM/rL) - vLLO;
  dv.descent = vLLO + P.descentLoss + P.hover;
  dv.lunarAscent = key === 'crewed' ? vLLO + P.ascentLoss + P.rendezvous : 0;
  dv.tei = key === 'crewed' ? dv.loi : 0;
  dv.space = dv.tli + dv.mcc + dv.loi + dv.descent + dv.lunarAscent + dv.tei;
  var m = 1 + P.reserve, E = P.eng, M = P.mass, mass = {ok: true};
  if (key === 'crewed'){
    var asc = stage(M.cabin, dv.lunarAscent*m, E.asc.isp, E.asc.k);
    var desc = asc && stage(asc.wet + M.cargo, dv.descent*m, E.desc.isp, E.desc.k);
    var lander = desc ? desc.wet : NaN, D = 2, ok = !!desc;
    var RT = Math.exp((dv.tei + P.midcourse)*m/(E.sm.isp*C.g0)), RL = Math.exp((dv.loi + P.midcourse)*m/(E.sm.isp*C.g0));
    var bTEI, bLOI;
    for (var it = 0; it < 80 && ok; it++){
      var aTEI = M.capsule + D; bTEI = aTEI*RT; var aLOI = bTEI + lander; bLOI = aLOI*RL;
      var nd = E.sm.k*((bTEI - aTEI) + (bLOI - aLOI));
      if (!isFinite(nd) || nd > 1e5){ ok = false; break; }
      D = nd;
    }
    var tli = ok && stage(bLOI, dv.tli, E.tli.isp, E.tli.k);
    mass = {ok: !!tli, leo: tli ? tli.wet : Infinity, lander: lander, stack: bLOI, landed: M.cabin + M.cargo,
            note: 'capsule ' + M.capsule + ' t, crew cabin ' + M.cabin + ' t, cargo ' + M.cargo + ' t'};
  } else {
    var ld = stage(M.rover, (dv.loi + dv.mcc + dv.descent)*m, E.lander.isp, E.lander.k);
    var tl = ld && stage(ld.wet, dv.tli, E.tli.isp, E.tli.k);
    mass = {ok: !!tl, leo: tl ? tl.wet : Infinity, lander: ld ? ld.wet : NaN, stack: ld ? ld.wet : NaN, landed: M.rover,
            note: 'rover / payload ' + M.rover + ' t'};
  }
  return {key: key, P: P, L: L, r1: r1, rL: rL, vLEO: vLEO, vRot: vRot, tr: tr, D: dArr, decArr: mArr.dec, az: Math.asin(sinAz)/DEG, vinf: vinf, vLLO: vLLO, dv: dv, mass: mass,
          entry: key === 'crewed' ? Math.sqrt(C.muE*(2/(C.RE + 120) - 1/tr.a)) : 0,
          incl: incl, launchOK: true};
}

