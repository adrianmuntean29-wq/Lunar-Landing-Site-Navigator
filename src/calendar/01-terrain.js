/* Landing calendar, runs inside startApp() and shares its scope with the other files here (see tools/build_js.py): map
   sizes, constants and the 3D terrain grid (LOLA heights, or the generated fallback). */
var DEG = Math.PI/180, R_MOON = 1737.4, INV2R = 1/(2*R_MOON);
/* Two map sizes. "sites" (default) is a 230 x 230 km block that holds all ten sites of data/sites.json, on the engine's
   640 m LOLA grid; "pole" is the original 48 x 48 km close-up on the 240 m grid. The choice lives in the URL (#map=pole). */
var MAPS = {
  sites: {cx: 55, cz: -63, half: 115, n: 241, grid: 20, ring: 1, name: 'All sites', size: '230 × 230 km'},
  pole:  {cx: 0, cz: 0, half: 24, n: 129, grid: 4, ring: 0.25, name: 'Close-up of the pole', size: '48 × 48 km'}
};
var MAPKEY = /(^|[#&])map=pole(&|$)/.test(location.hash) || !REGION ? 'pole' : 'sites', MAP = MAPS[MAPKEY];
var NAZ = 64, MAX_D = 46, SUN_R = 0.267, EARTH_R = 0.95;
var N = MAP.n, NV = N*N, HALF = MAP.half, CELL = 2*HALF/(N - 1), CX = MAP.cx, CZ = MAP.cz;
var OFF = MAPKEY === 'pole' ? 64 : Math.ceil(MAX_D/CELL), BIG_N = N + 2*OFF, HALF_BIG = HALF + OFF*CELL;
var SC = HALF/24;   // view scale against the original 48 km map (camera distance, labels)
var TERR = MAPKEY === 'pole' ? LOLA : REGION;
var MAST = 0.010, GROUND = 0.002, YEAR = 365, SPD = 8, MEAN_S = 730;
var DAYS = 365;   // planner time span in days (1, 2, 3 or 5 years); YEAR stays 365 for the 3D yearly averages

function $(s){ return document.querySelector(s); }
function num(v, d){ return v.toFixed(d); }
function sgn(v, d){ return (v < 0 ? '−' : '+') + num(Math.abs(v), d); }
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }

/* ---------- terrain ---------- */
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var rand = mulberry32(1114);
var LAT = new Float32Array(65536);
for (var q = 0; q < LAT.length; q++) LAT[q] = rand()*2 - 1;
function vnoise(x, y){
  var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  var u = xf*xf*(3 - 2*xf), v = yf*yf*(3 - 2*yf);
  var a = LAT[((yi & 255) << 8) | (xi & 255)], b = LAT[((yi & 255) << 8) | ((xi + 1) & 255)];
  var c = LAT[(((yi + 1) & 255) << 8) | (xi & 255)], d = LAT[(((yi + 1) & 255) << 8) | ((xi + 1) & 255)];
  var ab = a + (b - a)*u, cd = c + (d - c)*u;
  return ab + (cd - ab)*v;
}
function fbm(x, y, oct){
  var s = 0, amp = 1, f = 1, n = 0;
  for (var o = 0; o < oct; o++){ s += amp*vnoise(x*f + o*17.3, y*f - o*9.1); n += amp; amp *= 0.5; f *= 2.02; }
  return s/n;
}
var MAIN = {x:-1.6, z:1.2, R:10.4, depth:3.4, rim:1.25};
var MASSIF = {x:4.2, z:-15};
var craters = [MAIN, {x:19.5, z:15.5, R:8.6, depth:2.5, rim:0.5}, {x:-28, z:-24, R:9.5, depth:2.6, rim:0.5}, {x:-21, z:31, R:6, depth:1.9, rim:0.4}];
for (var k = 0; k < 36; k++){
  var Rk = 0.55*Math.pow(9, Math.pow(rand(), 1.7));
  craters.push({x:(rand()*2 - 1)*46, z:(rand()*2 - 1)*46, R:Rk, depth:0.4*Rk, rim:0.09*Rk});
}
var peaks = [{x:4.2, z:-15, h:2.8, s:4.4}, {x:10.5, z:-10, h:1.4, s:2.8}, {x:-15.5, z:10.5, h:1.2, s:3.6}, {x:-33, z:4, h:2.2, s:6}, {x:30, z:-30, h:1.8, s:7}];
function terrain(x, z){
  var h = 0.24*fbm(x/12 + 3.1, z/12 - 7.3, 4) + 0.08*fbm(x/3.2 + 11, z/3.2 + 5, 4) + 0.02*fbm(x/0.8, z/0.8, 3);
  for (var i = 0; i < peaks.length; i++){
    var p = peaks[i], dx = x - p.x, dz = z - p.z, e = (dx*dx + dz*dz)/(2*p.s*p.s);
    if (e < 9) h += p.h*Math.exp(-e)*(0.85 + 0.45*fbm(x/2.4 + p.x, z/2.4 + p.z, 3));
  }
  for (var j = 0; j < craters.length; j++){
    var c = craters[j], cx = x - c.x, cz = z - c.z, r = Math.sqrt(cx*cx + cz*cz)/c.R;
    if (r > 3) continue;
    h += r < 1 ? -c.depth + (c.depth + c.rim)*r*r : c.rim*Math.exp(-(r - 1)*3);
  }
  return h;
}
/* scene km: +x toward 90 E, -z toward 0 E (Earth side); heights.bin: +x toward 90 E, +y toward 0 E, metres */
function lolaAt(x, z){
  var m = TERR.m, A0 = TERR.h, fc = (x*1000 - m.xmin)/m.px - 0.5, fr = (m.ymax + z*1000)/m.px - 0.5;
  fc = clamp(fc, 0, m.nx - 1.001); fr = clamp(fr, 0, m.ny - 1.001);
  var i = fc | 0, j = fr | 0, u = fc - i, w = fr - j, k = j*m.nx + i, A = A0;
  function g(q){ var v = A[q]; return v === v ? v : 0; }
  return ((g(k)*(1 - u) + g(k + 1)*u)*(1 - w) + (g(k + m.nx)*(1 - u) + g(k + m.nx + 1)*u)*w)/1000;
}
var H = new Float32Array(BIG_N*BIG_N), HMAX = -1e9;
for (var gj = 0; gj < BIG_N; gj++) for (var gi = 0; gi < BIG_N; gi++){
  var hv = TERR ? lolaAt(CX - HALF_BIG + gi*CELL, CZ - HALF_BIG + gj*CELL) : terrain(-HALF_BIG + gi*CELL, -HALF_BIG + gj*CELL);
  H[gj*BIG_N + gi] = hv; if (hv > HMAX) HMAX = hv;
}
function hAt(x, z){
  var fx = (x - CX + HALF_BIG)/CELL, fz = (z - CZ + HALF_BIG)/CELL;
  fx = clamp(fx, 0, BIG_N - 1.0001); fz = clamp(fz, 0, BIG_N - 1.0001);
  var i = fx | 0, j = fz | 0, u = fx - i, w = fz - j, kk = j*BIG_N + i;
  return (H[kk]*(1 - u) + H[kk + 1]*u)*(1 - w) + (H[kk + BIG_N]*(1 - u) + H[kk + BIG_N + 1]*u)*w;
}
function horizonDir(x0, z0, h0, dx, dz, step0, grow){
  var best = -1e9, d = step0, lim = HMAX - h0;
  while (d < MAX_D){
    var x = x0 + dx*d, z = z0 + dz*d;
    var fx = (x - CX + HALF_BIG)/CELL, fz = (z - CZ + HALF_BIG)/CELL;
    if (fx < 0 || fz < 0 || fx >= BIG_N - 1 || fz >= BIG_N - 1) break;
    var i = fx | 0, j = fz | 0, u = fx - i, w = fz - j, kk = j*BIG_N + i;
    var hh = (H[kk]*(1 - u) + H[kk + 1]*u)*(1 - w) + (H[kk + BIG_N]*(1 - u) + H[kk + BIG_N + 1]*u)*w;
    var s = (hh - d*d*INV2R - h0)/d;
    if (s > best) best = s;
    if (lim/d < best) break;
    var st = d*grow; d += st > step0 ? st : step0;
  }
  return best < -1e8 ? -90 : Math.atan(best)/DEG;
}

/* render-grid vertex data */
var vx = new Float32Array(NV), vz = new Float32Array(NV), vh = new Float32Array(NV);
var exV = new Float32Array(NV), ezV = new Float32Array(NV);
var nor = new Float32Array(NV*3), hill = new Float32Array(NV), tone = new Float32Array(NV);
var HMINr = 1e9, HMAXr = -1e9;
(function(){
  var L = [-0.45, 0.72, -0.53], ll = Math.hypot(L[0], L[1], L[2]); L = [L[0]/ll, L[1]/ll, L[2]/ll];
  for (var j = 0; j < N; j++) for (var i = 0; i < N; i++){
    var v = j*N + i, x = CX - HALF + i*CELL, z = CZ - HALF + j*CELL, kk = (j + OFF)*BIG_N + (i + OFF);
    var h = H[kk];
    vx[v] = x; vz[v] = z; vh[v] = h;
    if (h < HMINr) HMINr = h; if (h > HMAXr) HMAXr = h;
    var c = Math.hypot(x, z)/R_MOON/DEG, az = Math.atan2(x, -z);
    exV[v] = c*Math.sin(az); ezV[v] = c*Math.cos(az);
    var dhdx = (H[kk + 1] - H[kk - 1])/(2*CELL), dhdz = (H[kk + BIG_N] - H[kk - BIG_N])/(2*CELL);
    var nx = -dhdx, ny = 1, nz = -dhdz, nl = Math.hypot(nx, ny, nz);
    nor[v*3] = nx/nl; nor[v*3 + 1] = ny/nl; nor[v*3 + 2] = nz/nl;
    var ex = -dhdx*2.2, ez = -dhdz*2.2, el = Math.hypot(ex, 1, ez);
    hill[v] = clamp((ex*L[0] + L[1] + ez*L[2])/el, 0, 1);
    tone[v] = 0.5 + 0.5*fbm(x/(1.4*CELL/0.375) + 40, z/(1.4*CELL/0.375) - 12, 3);
  }
})();

