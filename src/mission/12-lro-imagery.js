/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): real LRO
   images from NASA Moon Trek: tiles, the site seen from orbit, descent and ascent cameras. */
/* ---------- real imagery: LRO NAC south-pole mosaic (about 1 m/px) from NASA Moon Trek, loaded as map tiles ----------
   Polar stereographic (IAU 30120, sphere R = 1737.4 km): x = rho sin(lon), y = rho cos(lon), rho = 2R tan(45 deg + lat/2).
   Checked against the mosaic itself: Shackleton's permanently dark floor falls where this formula puts it.
   Tiles load from trek.nasa.gov while online; offline the views say so and everything else keeps working. */
var LRO = {base: 'https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_Mosaic_1mpp_SP/1.0.0/default/default028mm/', TL: 1095930, PX0: 8561.953125, maxZ: 12,
           half: 136700, tiles: {}, loaded: 0, failed: 0, fill: true};
/* LRO WAC south-pole mosaic (100 m/px) underneath: fills the NAC mosaic's gaps and, with "Fill shadows" on, its shadows */
var WAC = {base: 'https://trek.nasa.gov/tiles/Moon/SP/LRO_WAC_Mosaic_SPole60_100m_v02/1.0.0/default/default028mm/', maxZ: 5, tiles: {}};
var orbDirty = true;
function lroXY(lat, lon){ var rho = 2*1737400*Math.tan(Math.PI/4 + lat*DEG/2); return [rho*Math.sin(lon*DEG), rho*Math.cos(lon*DEG)]; }
function lroCovers(x, y, margin){ return Math.abs(x) < LRO.half - (margin || 0) && Math.abs(y) < LRO.half - (margin || 0); }
/* NAC tiles get a second copy whose near-black (shadow) pixels are transparent, so the WAC shows through only there */
function keyShadows(img){
  try {
    var k = document.createElement('canvas'); k.width = img.naturalWidth; k.height = img.naturalHeight;
    var x = k.getContext('2d'); x.drawImage(img, 0, 0);
    var d = x.getImageData(0, 0, k.width, k.height), p = d.data;
    for (var i = 0; i < p.length; i += 4){ var a = (p[i] - 3)/9; p[i + 3] = Math.round(p[i + 3]*(a < 0 ? 0 : a > 1 ? 1 : a)); }
    x.putImageData(d, 0, 0); return k;
  } catch (err) { return img; }
}
function lroTile(z, r, c, layer){
  var Lr = layer || LRO, k = z + '/' + r + '/' + c, t = Lr.tiles[k];
  if (t) return t.ok ? (Lr === LRO && LRO.fill ? t.key : t.img) : null;
  t = Lr.tiles[k] = {img: new Image(), ok: false};
  t.img.crossOrigin = 'anonymous';
  t.img.onload = function(){ if (Lr === LRO) t.key = keyShadows(t.img); t.ok = true; LRO.loaded++; orbDirty = true; };
  t.img.onerror = function(){ LRO.failed++; orbDirty = true; };
  t.img.src = Lr.base + z + '/' + r + '/' + c + '.png';
  return null;
}
/* draws the mosaic with world point (cx, cy) at the centre of a w x h box, mpp metres per CSS pixel */
function drawLRO(c, w, h, cx, cy, mpp, dpr){
  /* finest level whose pixels are no larger than a screen pixel (a 15% tolerance avoids fetching 4x the tiles for a 1% gain) */
  var zWant = clamp(Math.ceil(Math.log(LRO.PX0/(mpp/(dpr || 1)))/Math.LN2 - 0.2), 0, LRO.maxZ), drawn = 0;
  var wx0 = cx - w/2*mpp, wx1 = cx + w/2*mpp, wyT = cy + h/2*mpp, wyB = cy - h/2*mpp;
  c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.filter = 'brightness(1.3)';
  var zw = Math.min(WAC.maxZ, zWant);
  for (var z = Math.max(0, zw - 2); z <= zw; z++){
    var T = 256*LRO.PX0/Math.pow(2, z);
    var c0 = Math.floor((wx0 + LRO.TL)/T), c1 = Math.floor((wx1 + LRO.TL)/T), r0 = Math.floor((LRO.TL - wyT)/T), r1 = Math.floor((LRO.TL - wyB)/T);
    if ((c1 - c0 + 1)*(r1 - r0 + 1) > 40) continue;
    for (var r = r0; r <= r1; r++) for (var cc = c0; cc <= c1; cc++){
      var im = lroTile(z, r, cc, WAC); if (!im) continue;
      c.drawImage(im, (cc*T - LRO.TL - cx)/mpp + w/2, (cy - (LRO.TL - r*T))/mpp + h/2, T/mpp + 0.6, T/mpp + 0.6); drawn++;
    }
  }
  /* NAC (2 m per pixel) over the WAC: one level only, the finest the screen can show. A tile still loading borrows the matching
     quarter (or smaller part) of its nearest loaded parent tile, so nothing coarse is left showing once the sharp tiles arrive. */
  c.filter = 'brightness(1.3) contrast(1.06)';
  T = 256*LRO.PX0/Math.pow(2, zWant);
  c0 = Math.floor((wx0 + LRO.TL)/T); c1 = Math.floor((wx1 + LRO.TL)/T); r0 = Math.floor((LRO.TL - wyT)/T); r1 = Math.floor((LRO.TL - wyB)/T);
  if ((c1 - c0 + 1)*(r1 - r0 + 1) <= 260){
    for (r = r0; r <= r1; r++) for (cc = c0; cc <= c1; cc++){
      var tx = cc*T - LRO.TL, ty = LRO.TL - r*T, dx = (tx - cx)/mpp + w/2, dy = (cy - ty)/mpp + h/2, ds = T/mpp + 0.6;
      if (tx > LRO.half || tx + T < -LRO.half || ty - T > LRO.half || ty < -LRO.half) continue;
      im = lroTile(zWant, r, cc);
      if (im){ c.drawImage(im, dx, dy, ds, ds); drawn++; continue; }
      for (var up = 1; up <= 4 && zWant - up >= 0; up++){
        var pim = lroTile(zWant - up, r >> up, cc >> up); if (!pim) continue;
        var sub = 256 >> up, sx = (cc - ((cc >> up) << up))*sub, sy = (r - ((r >> up) << up))*sub;
        c.drawImage(pim, sx, sy, sub, sub, dx, dy, ds, ds); drawn++; break;
      }
    }
  }
  c.restore();
  return drawn;
}
/* map direction (canvas dx, dy) of a ground azimuth at a site: north points away from the pole, east clockwise from it */
function lroDir(site, az){
  var L = site.lon*DEG, n = [Math.sin(L), Math.cos(L)], e = [Math.cos(L), -Math.sin(L)], a = az*DEG;
  return [Math.cos(a)*n[0] + Math.sin(a)*e[0], -(Math.cos(a)*n[1] + Math.sin(a)*e[1])];
}
function lroStatus(){ return LRO.loaded === 0 && LRO.failed > 0 ? 'The LRO image could not load. It comes from NASA Moon Trek and needs an internet connection.' : LRO.loaded === 0 ? 'Loading the LRO image from NASA Moon Trek…' : ''; }
var orbC = $('#orb'), orbWrap = $('#orbWrap'), orbView = {w: 15000, dx: 0, dy: 0, site: null};
function scaleBar(c, x, y, mpp, maxPx, col){
  var steps = [50, 100, 250, 500, 1000, 2000, 5000, 10000, 20000], m = steps[0];
  for (var i = 0; i < steps.length; i++) if (steps[i]/mpp <= maxPx) m = steps[i];
  var px = m/mpp;
  c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x, y); c.lineTo(x + px, y); c.lineTo(x + px, y - 5); c.stroke();
  c.fillStyle = col; c.font = '500 11px ' + tok('--f-mono'); c.textAlign = 'center'; c.textBaseline = 'bottom';
  c.fillText(m >= 1000 ? m/1000 + ' km' : m + ' m', x + px/2, y - 4);
}
function arrowTo(c, x0, y0, d, len, col, label){
  var x1 = x0 + d[0]*len, y1 = y0 + d[1]*len, a = Math.atan2(d[1], d[0]);
  c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x0 + d[0]*14, y0 + d[1]*14); c.lineTo(x1, y1); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 10*Math.cos(a - 0.4), y1 - 10*Math.sin(a - 0.4)); c.lineTo(x1 - 10*Math.cos(a + 0.4), y1 - 10*Math.sin(a + 0.4)); c.closePath(); c.fill();
  c.font = '600 12px ' + tok('--f-mono'); var tw = c.measureText(label).width, lx = clamp(x1 + d[0]*14 - (d[0] < 0 ? tw : 0), 4, c.canvas.clientWidth - tw - 4), ly = clamp(y1 + d[1]*14, 14, c.canvas.clientHeight - 30);
  c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(lx - 4, ly - 9, tw + 8, 18); c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(label, lx, ly);
}
function drawOrbit(){
  orbDirty = false;
  var R = results[active].filter(function(r){ return r.site.id === target[active]; })[0];
  var dpr = Math.min(window.devicePixelRatio || 1, 2), w = orbWrap.clientWidth, h = orbWrap.clientHeight;
  if (!w || !h) return;
  if (orbC.width !== Math.round(w*dpr) || orbC.height !== Math.round(h*dpr)){ orbC.width = Math.round(w*dpr); orbC.height = Math.round(h*dpr); }
  var c = orbC.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  var hud = $('#orbHud');
  if (!R){ hud.innerHTML = '<span>Pick a site to see it from orbit</span>'; return; }
  var site = R.site, p = lroXY(site.lat, site.lon);
  if (orbView.site !== site.id){ orbView.site = site.id; orbView.dx = 0; orbView.dy = 0; }
  $('#orbWho').textContent = site.name;
  if (Math.abs(p[0]) > LRO.TL || Math.abs(p[1]) > LRO.TL){
    hud.innerHTML = '<span>' + escH(site.name) + ' is outside the LRO south-pole mosaics, which reach to 60° S.</span>';
    $('#orbNote').textContent = ''; return;
  }
  var mpp = orbView.w/w, cx = p[0] + orbView.dx, cy = p[1] + orbView.dy;
  c.imageSmoothingQuality = 'high';
  drawLRO(c, w, h, cx, cy, mpp, dpr);
  function S(x, y){ return [(x - cx)/mpp + w/2, (cy - y)/mpp + h/2]; }
  // other sites in view
  SITES.forEach(function(o){
    if (o.id === site.id) return;
    var q = lroXY(o.lat, o.lon), s2 = S(q[0], q[1]);
    if (s2[0] < -20 || s2[0] > w + 20 || s2[1] < -20 || s2[1] > h + 20) return;
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5; c.beginPath(); c.arc(s2[0], s2[1], 5, 0, Math.PI*2); c.stroke();
    c.font = '500 11px ' + tok('--f-mono'); c.fillStyle = 'rgba(255,255,255,.85)'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(o.name, s2[0] + 8, s2[1]);
  });
  // pole
  var sp = S(0, 0);
  if (sp[0] > -10 && sp[0] < w + 10 && sp[1] > -10 && sp[1] < h + 10){ c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(sp[0] - 6, sp[1]); c.lineTo(sp[0] + 6, sp[1]); c.moveTo(sp[0], sp[1] - 6); c.lineTo(sp[0], sp[1] + 6); c.stroke(); c.font = '500 11px ' + tok('--f-mono'); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillText('South pole', sp[0] + 8, sp[1] - 8); }
  // the site, Sun and Earth directions at the time shown
  var ss = S(p[0], p[1]), fi = Math.max(nowIndex(), R.iL), sk = skyInterp(site, fi), col = active === 'crewed' ? tok('--crew-fill') : tok('--robot-fill');
  var len = Math.min(w, h)*0.3;
  arrowTo(c, ss[0], ss[1], lroDir(site, sk.earthAz), len*0.85, '#A9D2FF', 'Earth ' + sgn(sk.earthEl, 1) + '°');
  arrowTo(c, ss[0], ss[1], lroDir(site, sk.sunAz), len, '#FFE3A3', 'Sun ' + sgn(sk.sunEl, 1) + '°');
  c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.arc(ss[0], ss[1], 9, 0, Math.PI*2); c.stroke();
  c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(ss[0], ss[1], 12.5, 0, Math.PI*2); c.stroke();
  // lunar north at the site
  var nd = lroDir(site, 0), nx = 30, ny = h - 108;
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(nx - nd[0]*14, ny - nd[1]*14); c.lineTo(nx + nd[0]*14, ny + nd[1]*14); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '600 11px ' + tok('--f-mono'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', nx + nd[0]*24, ny + nd[1]*24);
  scaleBar(c, 16, h - 62, mpp, Math.min(160, w*0.3), 'rgba(255,255,255,.9)');
  var st = lroStatus();
  hud.innerHTML = '<span><b>' + escH(site.name) + '</b> · ' + fmtDate(tabTime(0) + fi*3600000) + '</span>' +
    '<span class="' + (sk.sunEl - hzAt(prepSite(site), sk.sunAz) > 0 ? 'good' : 'bad') + '">Sun toward az ' + Math.round(sk.sunAz) + '°</span>' +
    '<span class="' + (sk.earthEl - hzAt(site, sk.earthAz) > -EARTH_R ? 'good' : 'bad') + '">Earth toward az ' + Math.round(sk.earthAz) + '°</span>' +
    (st ? '<span>' + st + '</span>' : '');
  $('#orbNote').textContent = 'LRO NAC south-pole mosaic (about 1 m/px) over the LRO WAC mosaic (100 m/px), brightened for display · NASA/GSFC/Arizona State University, via NASA Moon Trek · shadows in the photos are from when LRO took them, not from the date shown';
}
var orbBtns = Array.prototype.slice.call(document.querySelectorAll('[data-orbw]'));
function syncOrbBtns(){ orbBtns.forEach(function(b){ b.setAttribute('aria-pressed', Math.abs(+b.getAttribute('data-orbw') - orbView.w) < 1 ? 'true' : 'false'); }); }
function escH(t){ return String(t).replace(/[&<>"]/g, function(ch){ return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]; }); }
(function(){
  var drag = null;
  orbC.addEventListener('pointerdown', function(e){ try { orbC.setPointerCapture(e.pointerId); } catch (err) {} drag = {x: e.clientX, y: e.clientY, dx: orbView.dx, dy: orbView.dy}; orbC.style.cursor = 'grabbing'; });
  orbC.addEventListener('pointermove', function(e){ if (!drag) return; var mpp = orbView.w/orbWrap.clientWidth; orbView.dx = drag.dx - (e.clientX - drag.x)*mpp; orbView.dy = drag.dy + (e.clientY - drag.y)*mpp; orbDirty = true; });
  function end(){ drag = null; orbC.style.cursor = ''; }
  orbC.addEventListener('pointerup', end); orbC.addEventListener('pointercancel', end);
  orbC.addEventListener('wheel', function(e){ e.preventDefault(); orbView.w = clamp(orbView.w*Math.exp(e.deltaY*0.0015), 800, 80000); syncOrbBtns(); orbDirty = true; }, {passive: false});
  orbC.addEventListener('keydown', function(e){
    var step = orbView.w*0.1;
    if (e.key === 'ArrowLeft') orbView.dx -= step; else if (e.key === 'ArrowRight') orbView.dx += step; else if (e.key === 'ArrowUp') orbView.dy += step; else if (e.key === 'ArrowDown') orbView.dy -= step;
    else if (e.key === '+' || e.key === '=') orbView.w = clamp(orbView.w/1.25, 800, 80000); else if (e.key === '-') orbView.w = clamp(orbView.w*1.25, 800, 80000); else return;
    e.preventDefault(); syncOrbBtns(); orbDirty = true;
  });
  orbBtns.forEach(function(b){ b.addEventListener('click', function(){ orbView.w = +b.getAttribute('data-orbw'); syncOrbBtns(); orbDirty = true; }); });
  $('#orbCenter').addEventListener('click', function(){ orbView.dx = 0; orbView.dy = 0; orbDirty = true; });
  $('#orbFill').addEventListener('click', function(){ LRO.fill = !LRO.fill; this.setAttribute('aria-pressed', String(LRO.fill)); orbDirty = true; });
})();
/* descent camera: looking straight down during the landing replay, on the real LRO image */
function drawAscentCam(c, w, h, site, F){
  drawDownCam(c, w, h, site, F.alt, F.x, 'Ascent camera · real LRO image', F.engine ? (F.t > 0 ? Math.round(F.alt) + ' m up · ' : 'ignition · ') : 'ignition · ');
}
function drawDownCam(c, w, h, site, alt, off, title, sub){
  var p = lroXY(site.lat, site.lon); if (Math.abs(p[0]) > LRO.TL - 3000 || Math.abs(p[1]) > LRO.TL - 3000) return;
  var iw = Math.round(clamp(w*0.22, 160, 250)), ih = Math.round(iw*0.68), ix = w - iw - 12, iy = 52;
  var foot = Math.max(2*alt*Math.tan(35*DEG), 140), mpp = foot/iw, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var e = lroDir(site, 90), cx = p[0] + e[0]*off, cy = p[1] - e[1]*off;
  c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip(); c.translate(ix, iy);
  c.fillStyle = '#000'; c.fillRect(0, 0, iw, ih);
  var n = drawLRO(c, iw, ih, cx, cy, mpp, dpr);
  var tx = (p[0] - cx)/mpp + iw/2, ty = (cy - p[1])/mpp + ih/2;
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(iw/2 - 12, ih/2); c.lineTo(iw/2 + 12, ih/2); c.moveTo(iw/2, ih/2 - 12); c.lineTo(iw/2, ih/2 + 12); c.stroke();
  c.strokeStyle = '#7CF0A0'; c.lineWidth = 2; c.beginPath(); c.arc(tx, ty, 8, 0, Math.PI*2); c.stroke();
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, iw, 20); c.fillRect(0, ih - 20, iw, 20);
  c.font = '600 11px ' + tok('--f-mono'); c.fillStyle = '#E4E8EC'; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(title, 6, 10);
  c.font = '500 10.5px ' + tok('--f-mono'); c.fillText(sub + 'view ' + (foot >= 1000 ? (foot/1000).toFixed(1) + ' km' : Math.round(foot) + ' m') + ' wide', 6, ih - 10);
  if (!n){ c.fillStyle = '#9AA4AF'; c.textAlign = 'center'; c.fillText(LRO.failed && !LRO.loaded ? 'No image: needs internet' : 'Loading image…', iw/2, ih/2 + 24); }
  c.restore();
  c.strokeStyle = 'rgba(228,232,236,.5)'; c.lineWidth = 1; c.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
}
function drawDescentCam(c, w, h, site, LS){
  var p = lroXY(site.lat, site.lon); if (Math.abs(p[0]) > LRO.TL - 3000 || Math.abs(p[1]) > LRO.TL - 3000) return;
  var iw = Math.round(clamp(w*0.22, 160, 250)), ih = Math.round(iw*0.68), ix = w - iw - 12, iy = 52;
  var foot = Math.max(2*LS.alt*Math.tan(35*DEG), 140), mpp = foot/iw, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var d = Math.pow(LS.tau/LAND.pre, 1.2)*foot*0.32, e = lroDir(site, 270), cx = p[0] + e[0]*d, cy = p[1] - e[1]*d;   // coming in from the west, target drifting to the centre
  c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip(); c.translate(ix, iy);
  c.fillStyle = '#000'; c.fillRect(0, 0, iw, ih);
  var n = drawLRO(c, iw, ih, cx, cy, mpp, dpr);
  var tx = (p[0] - cx)/mpp + iw/2, ty = (cy - p[1])/mpp + ih/2;
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(iw/2 - 12, ih/2); c.lineTo(iw/2 + 12, ih/2); c.moveTo(iw/2, ih/2 - 12); c.lineTo(iw/2, ih/2 + 12); c.stroke();
  c.strokeStyle = '#7CF0A0'; c.lineWidth = 2; c.beginPath(); c.arc(tx, ty, 8 + 10*(1 - LS.af), 0, Math.PI*2); c.stroke();
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, iw, 20); c.fillRect(0, ih - 20, iw, 20);
  c.font = '600 11px ' + tok('--f-mono'); c.fillStyle = '#E4E8EC'; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText('Descent camera · real LRO image', 6, 10);
  c.font = '500 10.5px ' + tok('--f-mono'); c.fillText((LS.flying ? Math.round(LS.alt) + ' m up · ' : 'on the ground · ') + 'view ' + (foot >= 1000 ? (foot/1000).toFixed(1) + ' km' : Math.round(foot) + ' m') + ' wide', 6, ih - 10);
  if (!n){ c.fillStyle = '#9AA4AF'; c.textAlign = 'center'; c.fillText(LRO.failed && !LRO.loaded ? 'No image: needs internet' : 'Loading image…', iw/2, ih/2 + 24); }
  c.restore();
  c.strokeStyle = 'rgba(228,232,236,.5)'; c.lineWidth = 1; c.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
}
