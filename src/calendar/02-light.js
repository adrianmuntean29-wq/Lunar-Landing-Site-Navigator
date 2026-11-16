/* Landing calendar, runs inside startApp() and shares its scope with the other files here (see tools/build_js.py): the
   Sun and Earth seen from the pole, and the per-point horizon maps that light the 3D terrain. */
/* ---------- Sun & Earth seen from the pole (drives the 3D demo terrain) ----------
   At the pole, azimuth 0 points along longitude 0 (grid -z) and 90 along 90 E (grid +x).
   Points off the pole get the small-offset correction el + c*cos(az_body - az_point). */
function sunAt(t){ return azel(-90, 0, ephAt(state.jd0 + t).sun, true); }
function earthAt(t){ return azel(-90, 0, ephAt(state.jd0 + t).earth); }
function relAz(az){ var r = ((az + 180) % 360 + 360) % 360 - 180; return r; }

/* ---------- horizon maps for every vertex (progressive) ---------- */
var HZ = new Float32Array(NV*NAZ), BDX = new Float32Array(NAZ), BDZ = new Float32Array(NAZ);
for (var b = 0; b < NAZ; b++){ BDX[b] = Math.sin(b*2*Math.PI/NAZ); BDZ[b] = -Math.cos(b*2*Math.PI/NAZ); }
var hzDone = 0, meanDone = 0, stage = 0;
var sunMean = new Float32Array(NV), earthMean = new Float32Array(NV);
var light = new Float32Array(NV).fill(1), layer = new Float32Array(NV);

function lightAt(t, out){
  var s = sunAt(t), f = s.az/360*NAZ, i0 = Math.floor(f) % NAZ, fr = f - Math.floor(f), i1 = (i0 + 1) % NAZ;
  var ca = Math.cos(s.az*DEG), sa = Math.sin(s.az*DEG), inv = 1/(2*SUN_R);
  for (var v = 0; v < NV; v++){
    var base = v*NAZ, hz = HZ[base + i0]*(1 - fr) + HZ[base + i1]*fr;
    var el = s.el + ca*ezV[v] + sa*exV[v];
    out[v] = clamp((el - hz + SUN_R)*inv, 0, 1);
  }
}
function meanStep(t){
  var s = sunAt(t), e = earthAt(t);
  var fs = s.az/360*NAZ, s0 = Math.floor(fs) % NAZ, sr = fs - Math.floor(fs), s1 = (s0 + 1) % NAZ;
  var fe = e.az/360*NAZ, e0 = Math.floor(fe) % NAZ, er = fe - Math.floor(fe), e1 = (e0 + 1) % NAZ;
  var cs = Math.cos(s.az*DEG), ss = Math.sin(s.az*DEG), ce = Math.cos(e.az*DEG), se = Math.sin(e.az*DEG), inv = 1/(2*SUN_R);
  for (var v = 0; v < NV; v++){
    var base = v*NAZ;
    var hs = HZ[base + s0]*(1 - sr) + HZ[base + s1]*sr;
    var he = HZ[base + e0]*(1 - er) + HZ[base + e1]*er;
    sunMean[v] += clamp((s.el + cs*ezV[v] + ss*exV[v] - hs + SUN_R)*inv, 0, 1);
    if (e.el + ce*ezV[v] + se*exV[v] > he) earthMean[v] += 1;
  }
}

