/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): the south
   pole map: site picks and custom sites. */
/* =====================================================================
   south pole map
   ===================================================================== */
var mapC = $('#map'), mctx = mapC.getContext('2d'), MW = 1, MH = 1, MAXCOLAT = 10, GL = 36, GR = 12, GT = 18, GB = 18;
function mapXY(lat, lon){
  if (mapMode === 'globe') return [GL + (lon + 180)/360*(MW - GL - GR), GT + (90 - lat)/180*(MH - GT - GB)];
  var R = MW/2 - 26, r = (90 + lat)/MAXCOLAT*R, a = lon*DEG;
  return [MW/2 + r*Math.sin(a), MW/2 - r*Math.cos(a)];
}
function inMap(s){ return mapMode === 'globe' || s.lat <= -90 + MAXCOLAT; }
function drawMap(){
  var globe = mapMode === 'globe';
  mapC.classList.toggle('globe', globe);
  var dpr = Math.min(window.devicePixelRatio || 1, 2), w = mapC.clientWidth || 360, h = globe ? Math.round(w/2) : w;
  if (mapC.width !== Math.round(w*dpr) || mapC.height !== Math.round(h*dpr)){ mapC.width = Math.round(w*dpr); mapC.height = Math.round(h*dpr); }
  MW = w; MH = h;
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mctx.fillStyle = tok('--space'); mctx.fillRect(0, 0, w, h);
  mctx.strokeStyle = 'rgba(200,210,220,.18)'; mctx.lineWidth = 1;
  mctx.font = '500 10.5px ' + tok('--f-mono');
  if (globe){
    var x0 = GL, x1 = w - GR, y0 = GT, y1 = h - GB;
    mctx.fillStyle = '#1B1D21'; mctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    var nx0 = mapXY(0, -90)[0], nx1 = mapXY(0, 90)[0];
    mctx.fillStyle = '#26292E'; mctx.fillRect(nx0, y0, nx1 - nx0, y1 - y0);
    for (var lo = -180; lo <= 180; lo += 30){ var px = mapXY(0, lo)[0]; mctx.beginPath(); mctx.moveTo(px, y0); mctx.lineTo(px, y1); mctx.stroke(); }
    for (var la = -90; la <= 90; la += 30){ var py = mapXY(la, 0)[1]; mctx.beginPath(); mctx.moveTo(x0, py); mctx.lineTo(x1, py); mctx.stroke(); }
    mctx.fillStyle = 'rgba(200,210,220,.6)'; mctx.textBaseline = 'top'; mctx.textAlign = 'center';
    mctx.fillText('near side (faces Earth)', (nx0 + nx1)/2, y0 + 4);
    mctx.fillText('far side', (x0 + nx0)/2, y0 + 4); mctx.fillText('far side', (nx1 + x1)/2, y0 + 4);
    mctx.textBaseline = 'bottom';
    [[-180, '180°'], [-90, '90°W'], [0, '0°'], [90, '90°E'], [180, '180°']].forEach(function(o){ mctx.textAlign = o[0] === -180 ? 'left' : o[0] === 180 ? 'right' : 'center'; mctx.fillText(o[1], mapXY(0, o[0])[0], h - 3); });
    mctx.textAlign = 'right'; mctx.textBaseline = 'middle';
    [[60, '60°N'], [0, '0°'], [-60, '60°S']].forEach(function(o){ mctx.fillText(o[1], x0 - 4, mapXY(o[0], 0)[1]); });
  } else {
    var R = w/2 - 26, g = mctx.createRadialGradient(w/2, w/2, 0, w/2, w/2, R);
    g.addColorStop(0, '#2A2C30'); g.addColorStop(1, '#16181C');
    mctx.fillStyle = g; mctx.beginPath(); mctx.arc(w/2, w/2, R, 0, Math.PI*2); mctx.fill();
    mctx.fillStyle = 'rgba(200,210,220,.55)';
    [2.5, 5, 7.5, 10].forEach(function(c){ mctx.beginPath(); mctx.arc(w/2, w/2, c/MAXCOLAT*R, 0, Math.PI*2); mctx.stroke(); mctx.textAlign = 'left'; mctx.textBaseline = 'bottom'; mctx.fillText((90 - c) + '°S', w/2 + 3, w/2 - c/MAXCOLAT*R - 1); });
    for (var l = 0; l < 360; l += 45){ var p = mapXY(-80, l); mctx.beginPath(); mctx.moveTo(w/2, w/2); mctx.lineTo(p[0], p[1]); mctx.stroke(); }
    mctx.textBaseline = 'middle';
    [[0, '0° · Earth ↑'], [90, '90°E'], [180, '180° (far side)'], [-90, '90°W']].forEach(function(o){
      var p = mapXY(-90 + MAXCOLAT + 1.3, o[0]); mctx.textAlign = o[0] === 90 ? 'right' : o[0] === -90 ? 'left' : 'center';
      mctx.fillStyle = o[0] === 0 ? tok('--earth-fill') : 'rgba(200,210,220,.6)';
      var px = o[0] === 90 ? Math.min(p[0], w - 4) : o[0] === -90 ? Math.max(p[0], 4) : p[0];
      mctx.fillText(o[1], px, clamp(p[1], 10, w - 10));
    });
    mctx.fillStyle = 'rgba(228,232,236,.8)'; mctx.beginPath(); mctx.arc(w/2, w/2, 2.5, 0, Math.PI*2); mctx.fill();
  }
  var shown = SITES.filter(inMap), placed = [];
  shown.forEach(function(s){ var p = mapXY(s.lat, s.lon); placed.push([p[0] - 8, p[1] - 8, 16, 16]); });
  function overlaps(r){ for (var i = 0; i < placed.length; i++){ var o = placed[i]; if (r[0] < o[0] + o[2] && r[0] + r[2] > o[0] && r[1] < o[1] + o[3] && r[1] + r[3] > o[1]) return true; } return false; }
  function picked(s){ return picks.crewed.indexOf(s.id) >= 0 || picks.robotic.indexOf(s.id) >= 0; }
  var order = shown.slice().sort(function(a, b){ return (picked(a) ? 0 : 1) - (picked(b) ? 0 : 1); });
  var labelAt = {};
  mctx.font = '500 11px ' + tok('--f-mono');
  order.forEach(function(s){
    var p = mapXY(s.lat, s.lon), txt = s.name.replace(' (ice)', ''), tw = mctx.measureText(txt).width, th = 13, best = null;
    var cands = [[11, -th/2], [-11 - tw, -th/2], [11, -th/2 - 13], [11, -th/2 + 13], [-11 - tw, -th/2 - 13], [-11 - tw, -th/2 + 13], [-tw/2, -th - 9], [-tw/2, 9], [11, -th/2 - 26], [11, -th/2 + 26], [-11 - tw, -th/2 - 26], [-11 - tw, -th/2 + 26]];
    for (var c = 0; c < cands.length; c++){
      var r = [p[0] + cands[c][0], p[1] + cands[c][1], tw, th];
      if (r[0] < 2 || r[0] + tw > w - 2 || r[1] < 2 || r[1] + th > h - 2) continue;
      if (!overlaps(r)){ best = r; break; }
    }
    if (!best) best = null;
    if (best) placed.push(best);
    labelAt[s.id] = best ? {r: best, txt: txt} : null;
  });
  shown.forEach(function(s){
    var p = mapXY(s.lat, s.lon), ic = picks.crewed.indexOf(s.id), ir = picks.robotic.indexOf(s.id);
    var isT = target[active] === s.id && (active === 'crewed' ? ic : ir) >= 0;
    if (ic < 0 && ir < 0){
      mctx.strokeStyle = '#8F99A5'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc(p[0], p[1], 5, 0, Math.PI*2); mctx.stroke();
    } else if (ic >= 0 && ir >= 0){
      mctx.fillStyle = tok('--crew-fill'); mctx.beginPath(); mctx.arc(p[0], p[1], 7, Math.PI/2, Math.PI*1.5); mctx.fill();
      mctx.fillStyle = tok('--robot-fill'); mctx.beginPath(); mctx.arc(p[0], p[1], 7, -Math.PI/2, Math.PI/2); mctx.fill();
    } else {
      mctx.fillStyle = ic >= 0 ? tok('--crew-fill') : tok('--robot-fill'); mctx.beginPath(); mctx.arc(p[0], p[1], 7, 0, Math.PI*2); mctx.fill();
    }
    if (isT){ mctx.strokeStyle = '#FFFFFF'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(p[0], p[1], 10.5, 0, Math.PI*2); mctx.stroke(); }
    var la = labelAt[s.id]; if (!la) return;
    mctx.font = '500 11px ' + tok('--f-mono'); mctx.textBaseline = 'middle'; mctx.textAlign = 'left';
    var lx = la.r[0], ly = la.r[1] + la.r[3]/2;
    if (Math.abs(ly - p[1]) > 8 || lx > p[0] + 14 || lx + la.r[2] < p[0] - 14){
      mctx.strokeStyle = 'rgba(200,210,220,.35)'; mctx.lineWidth = 1; mctx.beginPath(); mctx.moveTo(p[0], p[1]);
      mctx.lineTo(lx < p[0] ? lx + la.r[2] : lx, ly); mctx.stroke();
    }
    mctx.fillStyle = picked(s) ? '#E4E8EC' : 'rgba(200,210,220,.62)';
    mctx.fillText(la.txt, lx, ly);
  });
  $('#mapCaption').textContent = globe
    ? 'Click a site to add or remove it for the mission selected above (up to 5 each). Click empty ground to create a site. The middle of the map is the side that always faces Earth.'
    : 'Click a site to add or remove it for the mission selected above (up to 5 each). Click empty ground to create a site. The top of the map faces Earth (0° longitude).';
}
function addCustom(name, lat, lon){
  customN++;
  var s = {id: 'custom' + customN, g: 'Custom', name: name || ('Custom ' + customN), lat: +lat.toFixed(4), lon: +lon.toFixed(4), kind: 'custom',
           horizon: Math.abs(lat) > 80 ? 0.5 : 0.0, ref: 'Added by you', custom: true};
  SITES.push(s);
  if (!togglePick(s.id)){ recompute(); renderAll(); }
}
mapC.addEventListener('click', function(e){
  var rect = mapC.getBoundingClientRect(), x = (e.clientX - rect.left)/rect.width*MW, y = (e.clientY - rect.top)/rect.height*MH;
  var hit = null, bd = 14;
  SITES.filter(inMap).forEach(function(s){ var p = mapXY(s.lat, s.lon), d = Math.hypot(p[0] - x, p[1] - y); if (d < bd){ bd = d; hit = s; } });
  if (hit){ togglePick(hit.id); return; }
  if (mapMode === 'globe'){
    if (x < GL || x > MW - GR || y < GT || y > MH - GB) return;
    addCustom('', 90 - (y - GT)/(MH - GT - GB)*180, (x - GL)/(MW - GL - GR)*360 - 180);
  } else {
    var R = MW/2 - 26, dx = x - MW/2, dy = MW/2 - y, r = Math.hypot(dx, dy);
    if (r > R) return;
    addCustom('', -90 + r/R*MAXCOLAT, Math.atan2(dx, dy)/DEG);
  }
});
var msgEl = $('#msg');
function togglePick(id){
  var list = picks[active], i = list.indexOf(id);
  msgEl.textContent = '';
  if (i >= 0) list.splice(i, 1);
  else {
    if (list.length >= 5){ msgEl.textContent = 'Already 5 ' + active + ' sites. Remove one first.'; return false; }
    list.push(id);
  }
  recompute(); renderAll();
  return true;
}

