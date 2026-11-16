/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): small
   helpers: DOM lookup, number formatting, vector math. */
/* =====================================================================
   helpers
   ===================================================================== */
var DEG = Math.PI/180;
function $(s){ return document.querySelector(s); }
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
function fmt(v, d){ return (v < 0 ? '−' : '') + Math.abs(v).toFixed(d); }
function sgn(v, d){ return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d); }
function pct(v){ return Math.round(v*100) + '%'; }
function t1(v){ return v.toLocaleString('en-US', {maximumFractionDigits: 1, minimumFractionDigits: 1}); }
function v3(x, y, z){ return [x, y, z]; }
function add(a, b){ return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b){ return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul(a, s){ return [a[0]*s, a[1]*s, a[2]*s]; }
function dot(a, b){ return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function len(a){ return Math.sqrt(dot(a, a)); }
function norm(a){ var l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }
function cross(a, b){ return [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]]; }
function slerp(a, b, s){
  var d = clamp(dot(a, b), -1, 1), w = Math.acos(d);
  if (w < 1e-6) return a;
  var sw = Math.sin(w);
  return add(mul(a, Math.sin((1 - s)*w)/sw), mul(b, Math.sin(s*w)/sw));
}
function ease(s){ return s*s*(3 - 2*s); }
function tok(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function dhm(sec){
  var d = Math.floor(sec/86400), h = Math.floor(sec % 86400/3600), m = Math.floor(sec % 3600/60);
  return d + ' d ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

