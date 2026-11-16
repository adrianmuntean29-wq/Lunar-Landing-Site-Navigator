/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): the Sun
   and Earth seen from a lunar site on real dates (JPL Horizons through js/sky.js, Meeus model outside the table),
   hourly series and the landing-day rule. */
/* =====================================================================
   Sun and Earth seen from a lunar site, real dates
   (ephemeris: Meeus, checked against JPL Horizons)
   ===================================================================== */
/* Low-precision lunar ephemeris (Meeus, Astronomical Algorithms, ch. 22, 25, 47, 53).
   Returns the selenographic sub-Earth and sub-solar points and the Earth–Moon distance for a UTC date. */
var EPH = (function(){
  var D2R = Math.PI/180;
  function n360(x){ x %= 360; return x < 0 ? x + 360 : x; }
  function jd(date){ return date.getTime()/86400000 + 2440587.5; }
  // main periodic terms of the Moon (Meeus table 47.A / 47.B), coefficients in 1e-6 deg and km
  // [D, M, M', F, sigmaL, sigmaR]
  var LR = [
    [0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],
    [0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],
    [2,0,1,0,53322,-170733],[2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],
    [0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],
    [4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],
    [2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
    [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],
    [2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],
    [0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],
    [2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],[3,0,-1,0,-892,3258],
    [2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],
    [2,1,-2,0,691,0],[2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],
    [4,-1,0,0,520,-1571],[1,0,-2,0,-487,-1739],[2,1,0,-2,-399,0],[0,0,2,-2,-381,-4421],
    [1,1,1,0,351,0],[3,0,-2,0,-340,0],[4,0,-3,0,330,0],[2,-1,2,0,327,0],
    [0,2,1,0,-323,1165],[1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752]
  ];
  // [D, M, M', F, sigmaB]
  var B = [
    [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],
    [2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],
    [2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],
    [2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],
    [0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],[0,1,1,-1,-1410],
    [0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833]
  ];
  function moon(T){
    var Lp = n360(218.3164477 + 481267.88123421*T - 0.0015786*T*T + T*T*T/538841 - T*T*T*T/65194000);
    var D = n360(297.8501921 + 445267.1114034*T - 0.0018819*T*T + T*T*T/545868 - T*T*T*T/113065000);
    var M = n360(357.5291092 + 35999.0502909*T - 0.0001536*T*T + T*T*T/24490000);
    var Mp = n360(134.9633964 + 477198.8675055*T + 0.0087414*T*T + T*T*T/69699 - T*T*T*T/14712000);
    var F = n360(93.2720950 + 483202.0175233*T - 0.0036539*T*T - T*T*T/3526000 + T*T*T*T/863310000);
    var A1 = n360(119.75 + 131.849*T), A2 = n360(53.09 + 479264.290*T), A3 = n360(313.45 + 481266.484*T);
    var E = 1 - 0.002516*T - 0.0000074*T*T;
    var sl = 0, sr = 0, sb = 0, i, t, arg, e;
    for (i = 0; i < LR.length; i++){
      t = LR[i]; arg = (t[0]*D + t[1]*M + t[2]*Mp + t[3]*F)*D2R;
      e = Math.abs(t[1]) === 1 ? E : Math.abs(t[1]) === 2 ? E*E : 1;
      sl += t[4]*e*Math.sin(arg); sr += t[5]*e*Math.cos(arg);
    }
    for (i = 0; i < B.length; i++){
      t = B[i]; arg = (t[0]*D + t[1]*M + t[2]*Mp + t[3]*F)*D2R;
      e = Math.abs(t[1]) === 1 ? E : Math.abs(t[1]) === 2 ? E*E : 1;
      sb += t[4]*e*Math.sin(arg);
    }
    sl += 3958*Math.sin(A1*D2R) + 1962*Math.sin((Lp - F)*D2R) + 318*Math.sin(A2*D2R);
    sb += -2235*Math.sin(Lp*D2R) + 382*Math.sin(A3*D2R) + 175*Math.sin((A1 - F)*D2R) + 175*Math.sin((A1 + F)*D2R) + 127*Math.sin((Lp - Mp)*D2R) - 115*Math.sin((Lp + Mp)*D2R);
    return {lon: n360(Lp + sl/1e6), lat: sb/1e6, dist: 385000.56 + sr/1000, F: F, D: D, M: M, Mp: Mp, E: E};
  }
  function sun(T){
    var L0 = n360(280.46646 + 36000.76983*T + 0.0003032*T*T), M = n360(357.52911 + 35999.05029*T - 0.0001537*T*T);
    var e = 0.016708634 - 0.000042037*T - 0.0000001267*T*T;
    var C = (1.914602 - 0.004817*T - 0.000014*T*T)*Math.sin(M*D2R) + (0.019993 - 0.000101*T)*Math.sin(2*M*D2R) + 0.000289*Math.sin(3*M*D2R);
    var lonT = L0 + C, nu = M + C, R = 1.000001018*(1 - e*e)/(1 + e*Math.cos(nu*D2R));
    var Om = 125.04 - 1934.136*T;
    return {lon: n360(lonT - 0.00569 - 0.00478*Math.sin(Om*D2R)), R: R*149597870.7};
  }
  function nutLon(T){
    var Om = 125.04452 - 1934.136261*T, L = 280.4665 + 36000.7698*T, Lp = 218.3165 + 481267.8813*T;
    return (-17.20*Math.sin(Om*D2R) - 1.32*Math.sin(2*L*D2R) - 0.23*Math.sin(2*Lp*D2R) + 0.21*Math.sin(2*Om*D2R))/3600;
  }
  var I = 1.54242;
  // selenographic coordinates of the point under a body at ecliptic (lam, bet) — Meeus 53.1 (optical libration)
  function seleno(lam, bet, Om, F, dPsi){
    var W = (lam - dPsi - Om)*D2R, b = bet*D2R, i = I*D2R;
    var A = Math.atan2(Math.sin(W)*Math.cos(b)*Math.cos(i) - Math.sin(b)*Math.sin(i), Math.cos(W)*Math.cos(b));
    var l = A/D2R - F, bb = Math.asin(-Math.sin(W)*Math.cos(b)*Math.sin(i) - Math.sin(b)*Math.cos(i))/D2R;
    l = n360(l); if (l > 180) l -= 360;
    return {lon: l, lat: bb};
  }
  // physical libration (Meeus 53, main terms) in degrees
  function physical(m, Om, T){
    var K1 = (119.75 + 131.849*T)*D2R, K2 = (72.56 + 20.186*T)*D2R;
    var Mr = m.M*D2R, Mpr = m.Mp*D2R, Fr = m.F*D2R, Dr = m.D*D2R, Omr = Om*D2R, E = m.E;
    var rho = -0.02752*Math.cos(Mpr) - 0.02245*Math.sin(Fr) + 0.00684*Math.cos(Mpr - 2*Fr) - 0.00293*Math.cos(2*Fr) - 0.00085*Math.cos(2*Fr - 2*Dr)
      - 0.00054*Math.cos(Mpr - 2*Dr) - 0.00020*Math.sin(Mpr + Fr) - 0.00020*Math.cos(Mpr + 2*Fr) - 0.00020*Math.cos(Mpr - Fr) + 0.00014*Math.cos(Mpr + 2*Fr - 2*Dr);
    var sig = -0.02816*Math.sin(Mpr) + 0.02244*Math.cos(Fr) - 0.00682*Math.sin(Mpr - 2*Fr) - 0.00279*Math.sin(2*Fr) - 0.00083*Math.sin(2*Fr - 2*Dr)
      + 0.00069*Math.sin(Mpr - 2*Dr) + 0.00040*Math.cos(Mpr + Fr) - 0.00025*Math.sin(2*Mpr) - 0.00023*Math.sin(Mpr + 2*Fr) + 0.00020*Math.cos(Mpr - Fr)
      + 0.00019*Math.sin(Mpr - Fr) + 0.00013*Math.sin(Mpr + 2*Fr - 2*Dr) - 0.00010*Math.cos(Mpr - 3*Fr);
    var tau = 0.02520*E*Math.sin(Mr) + 0.00473*Math.sin(2*Mpr - 2*Fr) - 0.00467*Math.sin(Mpr) + 0.00396*Math.sin(K1) + 0.00276*Math.sin(2*Mpr - 2*Dr)
      + 0.00196*Math.sin(Omr) - 0.00183*Math.cos(Mpr - Fr) + 0.00115*Math.sin(Mpr - 2*Dr) - 0.00096*Math.sin(Mpr - Dr) + 0.00046*Math.sin(2*Fr - 2*Dr)
      - 0.00039*Math.sin(Mpr - Fr) - 0.00032*Math.sin(Mpr - Mr - Dr) + 0.00027*Math.sin(2*Mpr - Mr - 2*Dr) + 0.00023*Math.sin(K2) - 0.00014*Math.sin(2*Dr)
      + 0.00014*Math.cos(2*Mpr - 2*Fr) - 0.00012*Math.sin(Mpr - 2*Fr) - 0.00012*Math.sin(2*Mpr) + 0.00011*Math.sin(2*Mpr - 2*Mr - 2*Dr);
    return {rho: rho, sig: sig, tau: tau};
  }
  function at(date){
    var T = (jd(date) + 69.2/86400 - 2451545.0)/36525;
    var m = moon(T), s = sun(T), dPsi = nutLon(T);
    var Om = n360(125.0445479 - 1934.1362891*T + 0.0020754*T*T + T*T*T/467441 - T*T*T*T/60616000);
    var lamM = m.lon + dPsi;
    var e1 = seleno(lamM, m.lat, Om, m.F, dPsi);
    var ph = physical(m, Om, T);
    var A = Math.atan2(Math.sin((lamM - dPsi - Om)*D2R)*Math.cos(m.lat*D2R)*Math.cos(I*D2R) - Math.sin(m.lat*D2R)*Math.sin(I*D2R), Math.cos((lamM - dPsi - Om)*D2R)*Math.cos(m.lat*D2R))/D2R;
    var lpp = -ph.tau + (ph.rho*Math.cos(A*D2R) + ph.sig*Math.sin(A*D2R))*Math.tan(e1.lat*D2R);
    var bpp = ph.sig*Math.cos(A*D2R) - ph.rho*Math.sin(A*D2R);
    var lamH = s.lon + 180 + (m.dist/s.R)*(57.296)*Math.cos(m.lat*D2R)*Math.sin((s.lon - lamM)*D2R);
    var betH = (m.dist/s.R)*m.lat;
    var s1 = seleno(lamH, betH, Om, m.F, dPsi);
    var A0 = Math.atan2(Math.sin((lamH - dPsi - Om)*D2R)*Math.cos(betH*D2R)*Math.cos(I*D2R) - Math.sin(betH*D2R)*Math.sin(I*D2R), Math.cos((lamH - dPsi - Om)*D2R)*Math.cos(betH*D2R))/D2R;
    var l0pp = -ph.tau + (ph.rho*Math.cos(A0*D2R) + ph.sig*Math.sin(A0*D2R))*Math.tan(s1.lat*D2R);
    var b0pp = ph.sig*Math.cos(A0*D2R) - ph.rho*Math.sin(A0*D2R);
    function wrap(x){ x = n360(x); return x > 180 ? x - 360 : x; }
    return {
      earth: {lon: wrap(e1.lon + lpp), lat: e1.lat + bpp, dist: m.dist},
      sun: {lon: wrap(s1.lon + l0pp), lat: s1.lat + b0pp, dist: s.R},
      moonEcl: {lon: m.lon, lat: m.lat}
    };
  }
  return {at: at, jd: jd};
})();
/* ---------- team data: JPL Horizons table + LOLA horizon masks (the same files as the landing calendar) ---------- */
var HZD = null, MASKS = null, MASKMETA = null;
try { HZD = JSON.parse(document.getElementById('data-subpoints').textContent); } catch (err) {}
try { var SJ = JSON.parse(document.getElementById('data-sites').textContent); MASKS = {}; SJ.sites.forEach(function(o){ MASKS[o.id] = o; }); MASKMETA = {generated: SJ.generated_utc, versions: SJ.versions}; } catch (err) {}
/* every engine site in sites.json (ten since the evening of 14 Nov), not only the first four; id = the code in brackets,
   which is what the calendar links with (adapted from Eren's version of this page) */
if (MASKS) (function(){
  var at = 0; SITES.forEach(function(s, i){ if (s.eng) at = i + 1; });
  SJ.sites.forEach(function(o){
    if (SITES.some(function(s){ return s.eng === o.id; })) return;
    var m = o.name.match(/\((.*)\)/), hist = /^historic/.test(o.kind || ''), box = /site box/.test(o.kind || '');
    SITES.splice(at++, 0, {id: m ? m[1] : o.name, eng: o.id, g: hist ? 'Historic target' : (box || /^published/.test(o.kind || '')) ? 'Published site' : 'Team-proposed site' /* PLANNER PATCH 2026-11-15: engine sites that are not published (e.g. Tudor's K-N) are not labelled "Published site" */, name: o.name, lat: o.lat,
      lon: o.lon_e > 180 ? o.lon_e - 360 : o.lon_e, kind: box ? 'best-lit point in a NASA site box' : hist ? 'landing target' : 'site', horizon: 0,
      ref: box ? 'Our engine, inside NASA site box ' + (m ? m[1] : '') : hist ? 'IM-2 Athena target (LROC)' : (o.source || '')});
  });
})();
var mast = '2', relay = false, SUN_R = Sky.SUN_R, EARTH_R = Sky.EARTH_R;
/* Moon-centred Earth and Sun position (km, MOON_ME frame) at time ms: 4-point cubic on the 6 h Horizons table */
function horizonsAt(ms){ return HZD ? Sky.interp(HZD, ms/86400000 + 2440587.5) : null; }   // js/sky.js, shared with the calendar
function maskOf(st){ var m = st.eng && MASKS && MASKS[st.eng] && MASKS[st.eng].masks; return m ? (m[mast] || null) : null; }
/* terrain horizon (deg) toward azimuth az; mask bin k covers [k, k+1) deg and is looked up between bin centres */
function hzAt(st, az){ return st._mask ? Sky.horizon(st._mask, az) : st.horizon; }
function prepSite(st){ st._mask = maskOf(st); st._mastKey = st._mask ? mast : '-'; return st; }
function hzLabel(st){ prepSite(st); return st._mask ? 'LOLA horizon, ' + mast + ' m mast' : 'flat horizon ' + sgn(st.horizon, 1) + '° (assumed)'; }
/* visible fraction of the Sun's disc when its centre is alt degrees above the terrain (chord area, as the engine) */
function sunFrac(alt){ return Sky.sunFrac(alt); }
/* a good landing: the same example limits as the landing calendar (not NASA requirements) */
var LIMITS = {
  crewed: {sun: 95, earth: 25, night: 0, td: 0},   /* Earth 25%: the calendar's default, the value listed in a 2024 NASA presentation (NTRS 20240009596) */
  robotic: {sun: 70, earth: 25, night: 48, td: 0}
};
function failText(ev, key){
  var L = LIMITS[key];
  return ev.fail.map(function(f){
    return f === 'sun' ? 'too little sun (' + Math.round(ev.sun) + '%, needs ' + L.sun + '%)'
      : f === 'earth' ? 'too little Earth contact (' + Math.round(ev.earth) + '%, needs ' + L.earth + '%)'
      : f === 'night' ? 'a ' + Math.round(ev.night) + ' h night (limit ' + L.night + ' h)'
      : 'Sun ' + sgn(ev.td, 1) + '° at touchdown (needs ' + sgn(L.td, 1) + '°)';
  }).join(', ');
}
var TAB = null, seriesCache = {};
function buildTable(t0){
  if (TAB && TAB.t0 === t0) return;
  var n = MODEL.tableDays*24, su = new Float32Array(n*3), eu = new Float32Array(n*3), ed = new Float32Array(n), fromH = 0;
  for (var i = 0; i < n; i++){
    var hz = horizonsAt(t0 + i*3600000);
    if (hz){
      var sl = Math.hypot(hz.sun[0], hz.sun[1], hz.sun[2]), el2 = Math.hypot(hz.earth[0], hz.earth[1], hz.earth[2]);
      su[i*3] = hz.sun[0]/sl; su[i*3 + 1] = hz.sun[1]/sl; su[i*3 + 2] = hz.sun[2]/sl;
      eu[i*3] = hz.earth[0]/el2; eu[i*3 + 1] = hz.earth[1]/el2; eu[i*3 + 2] = hz.earth[2]/el2;
      ed[i] = el2; fromH++; continue;
    }
    var e = EPH.at(new Date(t0 + i*3600000)), a = e.sun, b = e.earth;
    var ca = Math.cos(a.lat*DEG), cb = Math.cos(b.lat*DEG);
    su[i*3] = ca*Math.cos(a.lon*DEG); su[i*3 + 1] = ca*Math.sin(a.lon*DEG); su[i*3 + 2] = Math.sin(a.lat*DEG);
    eu[i*3] = cb*Math.cos(b.lon*DEG); eu[i*3 + 1] = cb*Math.sin(b.lon*DEG); eu[i*3 + 2] = Math.sin(b.lat*DEG);
    ed[i] = b.dist;
  }
  TAB = {t0: t0, n: n, su: su, eu: eu, ed: ed, horizons: fromH === n, fromH: fromH};
  window.__tab0 = t0;
  seriesCache = {};
}
function siteFrame(s){
  var f = s.lat*DEG, l = s.lon*DEG;
  return {n: [Math.cos(f)*Math.cos(l), Math.cos(f)*Math.sin(l), Math.sin(f)], e: [-Math.sin(l), Math.cos(l), 0],
          no: [-Math.sin(f)*Math.cos(l), -Math.sin(f)*Math.sin(l), Math.cos(f)]};
}
/* Sun and Earth from the site at table hour i (degrees; azimuth clockwise from lunar north) */
function skyAt(s, i, fr){
  fr = fr || siteFrame(s); i = clamp(Math.round(i), 0, TAB.n - 1);
  var k = i*3, su = [TAB.su[k], TAB.su[k + 1], TAB.su[k + 2]], eu = [TAB.eu[k], TAB.eu[k + 1], TAB.eu[k + 2]], D = TAB.ed[i];
  var de = sub(mul(eu, D), mul(fr.n, C.RM)), dl = len(de);
  return {sunEl: Math.asin(clamp(dot(su, fr.n), -1, 1))/DEG, sunAz: (Math.atan2(dot(su, fr.e), dot(su, fr.no))/DEG + 360) % 360,
          earthEl: Math.asin(clamp(dot(de, fr.n)/dl, -1, 1))/DEG, earthAz: (Math.atan2(dot(de, fr.e), dot(de, fr.no))/DEG + 360) % 360};
}
function siteSeries(s){
  prepSite(s);
  var key = s.id + '|' + s.lat + '|' + s.lon + '|' + s.horizon + '|' + s._mastKey;
  if (seriesCache[key]) return seriesCache[key];
  var n = TAB.n, fr = siteFrame(s), N0 = fr.n, E0 = fr.e, NO = fr.no, RM = C.RM;
  var sunEl = new Float32Array(n), earthEl = new Float32Array(n), sunAlt = new Float32Array(n), earthAlt = new Float32Array(n);
  var sunF = new Float32Array(n), sunOK = new Uint8Array(n), earthOK = new Uint8Array(n), runs = [], rs = -1;
  for (var i = 0; i < n; i++){
    var k = i*3, a = TAB.su[k], b = TAB.su[k + 1], c = TAB.su[k + 2], D = TAB.ed[i];
    var se = Math.asin(clamp(a*N0[0] + b*N0[1] + c*N0[2], -1, 1))/DEG;
    var saz = Math.atan2(a*E0[0] + b*E0[1] + c*E0[2], a*NO[0] + b*NO[1] + c*NO[2])/DEG;
    var dx = TAB.eu[k]*D - N0[0]*RM, dy = TAB.eu[k + 1]*D - N0[1]*RM, dz = TAB.eu[k + 2]*D - N0[2]*RM, dl = Math.sqrt(dx*dx + dy*dy + dz*dz);
    var ee = Math.asin(clamp((dx*N0[0] + dy*N0[1] + dz*N0[2])/dl, -1, 1))/DEG;
    var eaz = Math.atan2(dx*E0[0] + dy*E0[1] + dz*E0[2], dx*NO[0] + dy*NO[1] + dz*NO[2])/DEG;
    sunEl[i] = se; earthEl[i] = ee;
    var sa = se - hzAt(s, saz), ea = ee - hzAt(s, eaz);
    sunAlt[i] = sa; earthAlt[i] = ea;
    sunF[i] = sunFrac(sa); sunOK[i] = sa > 0 ? 1 : 0; earthOK[i] = ea > -EARTH_R ? 1 : 0;
    if (!sunOK[i]){ if (rs < 0) rs = i; } else if (rs >= 0){ runs.push(rs, i); rs = -1; }
  }
  if (rs >= 0) runs.push(rs, n);
  var cs = new Float64Array(n + 1), ce = new Float64Array(n + 1);
  for (i = 0; i < n; i++){ cs[i + 1] = cs[i] + sunF[i]; ce[i + 1] = ce[i] + earthOK[i]; }
  var res = {sunEl: sunEl, earthEl: earthEl, sunAlt: sunAlt, earthAlt: earthAlt, sunF: sunF, sunOK: sunOK, earthOK: earthOK, runs: Int32Array.from(runs), cs: cs, ce: ce};
  seriesCache[key] = res;
  return res;
}
/* landing at table hour i for S hours: sunlight %, Earth contact %, longest night (h), Sun height at touchdown, failed limits */
function evalAt(Y, i, S, key){
  var L = LIMITS[key], n = Y.sunF.length;
  if (i < 0 || i + S > n) return null;
  var sun = (Y.cs[i + S] - Y.cs[i])/S*100, earth = (Y.ce[i + S] - Y.ce[i])/S*100;
  var runs = Y.runs, nr = runs.length/2, lo = 0, hi = nr;
  while (lo < hi){ var mid = (lo + hi) >> 1; if (runs[mid*2 + 1] <= i) lo = mid + 1; else hi = mid; }
  var night = 0, clipped = false;
  for (var r = lo; r < nr; r++){
    var a = runs[r*2], b = runs[r*2 + 1]; if (a >= i + S) break;
    var l = Math.min(b, i + S) - Math.max(a, i); if (l > night){ night = l; clipped = a < i || b > i + S; }
  }
  var td = Y.sunAlt[i], fail = [];
  if (sun < L.sun) fail.push('sun');
  if (!relay && earth < L.earth) fail.push('earth');
  if (night > L.night) fail.push('night');
  if (td < L.td) fail.push('td');
  return {sun: sun, earth: earth, night: night, clipped: clipped, td: td, fail: fail, ok: fail.length === 0};
}
function landIndex(k){ return Math.round(missionTimes(k).land*24 + (launchMs - TAB.t0)/3600000); }
function runLen(arr, i, want, max){ var j = i; while (j < max && arr[j] === want) j++; return j - i; }
function analyse(site, key){
  var Y = siteSeries(site), P = PROFILES[key], S = Math.max(1, Math.round(P.stay*24)), n = TAB.n;
  var iL = clamp(landIndex(key), 0, n - S - 1), end = Math.min(n - S, iL + MODEL.year*24);
  var valid = new Uint8Array(n), best = -1, bestVal = -1, windows = 0, prev = 0, next = -1;
  for (var s = iL; s < end; s++){
    var ev = evalAt(Y, s, S, key), o = !!(ev && ev.ok); valid[s] = o ? 1 : 0;
    if (o && !prev) windows++;
    prev = o ? 1 : 0;
    if (o && next < 0) next = s;
    if (o){ var v = (key === 'crewed' ? ev.earth : ev.sun)/100; if (v > bestVal){ bestVal = v; best = s; } }
  }
  var yEnd = Math.min(n, iL + MODEL.year*24), sS = 0, sE = 0, run = 0, longest = 0;
  for (var q = iL; q < yEnd; q++){ sS += Y.sunF[q]; sE += Y.earthOK[q]; if (!Y.sunOK[q]){ run++; if (run > longest) longest = run; } else run = 0; }
  var yl = Math.max(1, yEnd - iL), sunYear = sS/yl, earthYear = sE/yl, night = longest/24;
  var look = Math.min(n, iL + 60*24);
  var at = {sunEl: Y.sunEl[iL], earthEl: Y.earthEl[iL], sunAlt: Y.sunAlt[iL], earthAlt: Y.earthAlt[iL], sunUp: Y.sunOK[iL] === 1, earthUp: Y.earthOK[iL] === 1};
  at.sunNext = runLen(Y.sunOK, iL, Y.sunOK[iL], look); at.sunCapped = iL + at.sunNext >= look;
  at.earthNext = runLen(Y.earthOK, iL, Y.earthOK[iL], look); at.earthCapped = iL + at.earthNext >= look;
  var minSun = 99; for (var m = iL; m < iL + S; m++) minSun = Math.min(minSun, Y.sunAlt[m]);
  var evL = evalAt(Y, iL, S, key) || {sun: 0, earth: 0, night: 0, td: 0, fail: ['sun'], ok: false};
  var stay = {sun: evL.sun/100, earth: evL.earth/100, minSun: minSun, night: evL.night};
  var W = SCORE[key], score;
  if (key === 'crewed') score = windows === 0 ? 0 : W.windows*Math.min(1, windows/W.windowsFull) + W.earthStay*Math.max(0, bestVal) + W.sunYear*sunYear;
  else score = windows === 0 ? 0 : W.sunYear*sunYear + W.earthYear*earthYear + W.night*(1 - Math.min(1, night/W.nightFull));
  return {site: site, key: key, Y: {sunYear: sunYear, earthYear: earthYear, night: night, sunF: Y.sunF, earthOK: Y.earthOK},
          valid: valid, windows: windows, best: best, bestVal: Math.max(0, bestVal), next: next, iL: iL, S: S,
          at: at, stay: stay, ev: evL, viable: evL.ok, score: score};
}
function tabTime(i){ return TAB.t0 + i*3600000; }
var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(ms, withTime){
  var d = new Date(ms), s = d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  return withTime === false ? s : s + ', ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') + ' UTC';
}
function dh(hours){ var d = Math.floor(hours/24), h = Math.round(hours % 24); if (h === 24){ d++; h = 0; } return d ? d + ' d ' + h + ' h' : h + ' h'; }

