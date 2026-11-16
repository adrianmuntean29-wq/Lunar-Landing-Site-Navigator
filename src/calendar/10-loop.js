/* Landing calendar, runs inside startApp() and shares its scope with the other files here (see tools/build_js.py):
   resizing, theme changes and the animation loop. */
/* ---------- sizing & theme ---------- */
var framed = false;
function resize(){
  W = viewport.clientWidth; Hh = viewport.clientHeight;
  if (!framed && W > 0 && Hh > 0){ var asp = W/Hh; cam.dist = SC*(asp < 1.25 ? clamp(66*1.25/asp, 66, 140) : 66); framed = true; }
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W*dpr); canvas.height = Math.round(Hh*dpr);
  dirty.view = true; dirty.charts = true;
}
if (window.ResizeObserver){ new ResizeObserver(resize).observe(viewport); new ResizeObserver(function(){ dirty.charts = true; }).observe($('.rail')); }
window.addEventListener('resize', resize);
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(){ dirty.charts = true; }); } catch (err) {}
new MutationObserver(function(){ dirty.charts = true; }).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});

/* ---------- loop ---------- */
var statusEl = $('#status');
function work(){
  var t0 = performance.now();
  if (stage === 0){
    while (hzDone < NV && performance.now() - t0 < 24){
      var end = Math.min(NV, hzDone + 48);
      for (var v = hzDone; v < end; v++){
        var base = v*NAZ, h0 = vh[v] + GROUND;
        for (var b = 0; b < NAZ; b++) HZ[base + b] = horizonDir(vx[v], vz[v], h0, BDX[b], BDZ[b], CELL*0.75, 0.06);
      }
      hzDone = end;
    }
    statusEl.innerHTML = 'Computing the horizon for ' + NV.toLocaleString('en-US') + ' points… <b>' + Math.floor(hzDone/NV*100) + '%</b>';
    if (hzDone >= NV){ stage = 1; dirty.light = true; dirty.view = true; }
  } else if (stage === 1){
    while (meanDone < MEAN_S && performance.now() - t0 < 24){ meanStep((meanDone + 0.5)*YEAR/MEAN_S); meanDone++; }
    statusEl.innerHTML = 'Computing yearly averages… <b>' + Math.floor(meanDone/MEAN_S*100) + '%</b>';
    if (meanDone >= MEAN_S){
      for (var q = 0; q < NV; q++){ sunMean[q] /= MEAN_S; earthMean[q] /= MEAN_S; }
      stage = 2; statusEl.hidden = true;
      segBtns.forEach(function(o){ o.disabled = false; });
      dirty.layer = true; dirty.view = true;
    }
  }
}
var last = performance.now();
function frame(now){
  var dt = Math.min(0.1, (now - last)/1000); last = now;
  if (stage < 2) work();
  if (state.playing){ setT(state.t + dt*state.speed); }
  if (dirty.geo){ updateGeometry(); dirty.geo = false; }
  if (dirty.light && gl){
    if (stage >= 1) lightAt(state.t, light); else light.fill(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.light); gl.bufferSubData(gl.ARRAY_BUFFER, 0, light);
    dirty.light = false;
  }
  if (dirty.layer && gl){
    if (state.mode === 1) layer.set(sunMean); else if (state.mode === 2) layer.set(earthMean);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.layer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, layer);
    dirty.layer = false;
  }
  if (dirty.sites){ renderSites(); dirty.sites = false; }
  if (dirty.view){ updateVP(); draw(); updateLabels(); renderReadout(); renderHeadline(false); tOut.textContent = dateFromJd(state.jd0 + state.t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; dirty.view = false; }
  if (dirty.charts){ drawHorizon(); drawTimeline(); dirty.charts = false; }
  requestAnimationFrame(frame);
}
buildPins(); buildGeo(); renderLegend(); resize(); select(0);
window.__navigator = {get sites(){ return sites; }, state: state, get stage(){ return stage; }, sunMean: sunMean, earthMean: earthMean, light: light,
  siteState: siteState, nextChange: nextChange};
requestAnimationFrame(frame);
