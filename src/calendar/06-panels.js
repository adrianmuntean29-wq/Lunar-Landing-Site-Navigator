/* Landing calendar, runs inside startApp() and shares its scope with the other files here (see tools/build_js.py): map
   legend, readout line and the site cards. */
/* ---------- legend, readout, sites panel ---------- */
var legendEl = $('#legend');
function renderLegend(){
  if (state.mode === 0) legendEl.innerHTML = '<span><i class="sw lit"></i>Sunlit</span><span><i class="sw dark"></i>Shadow</span><span>' + (MAPKEY === 'pole' ? '4 km grid, a circle every 0.25° of latitude' : '20 km grid, a circle every 1° of latitude') + '</span>';
  else if (state.mode === 1) legendEl.innerHTML = '<span><i class="grad sun"></i>0% → 100% of the year in sunlight</span><span>Average over 365 days</span>';
  else legendEl.innerHTML = '<span><i class="grad earth"></i>0% → 100% of the year with Earth visible</span><span>Average over 365 days</span>';
  if (zonesOn && TERR) legendEl.insertAdjacentHTML('beforeend', '<span><i class="sw zone"></i>Flat, smooth terrain (Tudor, team analysis)</span>');
}
function pct(v){ return Math.round(v*100) + '%'; }
function nightText(d, clipped){ return d >= DAYS - 0.5 ? 'whole span' : (clipped ? '≥ ' : '') + (d < 2 ? num(d*24, 0) + ' h' : num(d, d < 10 ? 1 : 0) + ' days'); }
/* Data-quality line: named sites have published references; custom spots and flat horizons say so. */
function qualityText(s){
  var q = [];
  if (s.flat) q.push('flat horizon (terrain mask not loaded)');
  else if (s.meta && s.meta.approx) q.push('approximate mask, 600 m terrain');
  else q.push('LOLA mask' + (s.meta && s.meta.dem_near ? ', 20 m near field' : ''));
  if (s.meta && s.meta.err_m != null) q.push('height error ±' + num(s.meta.err_m, 1) + ' m');
  if (s.meta && s.meta.effres_m != null) q.push('effective resolution ' + num(s.meta.effres_m, 0) + ' m');
  if (s.meta && s.meta.psr_km != null) q.push('nearest permanent shadow ' + num(s.meta.psr_km, 1) + ' km away (LOLA model, not a map of ice)');
  if (s.meta && s.meta.truncated) q.push((s.meta.edge_rays || 'some') + ' of 360 directions reach the edge of the terrain map, so the horizon may be low there and sunlight is an upper bound');
  q.push(s.studied ? 'published site' : 'no published reference');
  if (s.meta && s.meta.validated === false) q.push('engine result not yet validated');
  return q.join(' · ');
}
var sitesEl = $('#sites');
function renderSites(){
  sitesEl.innerHTML = '';
  sites.forEach(function(s, i){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'site';
    b.setAttribute('aria-pressed', i === sel ? 'true' : 'false');
    b.innerHTML =
      '<span class="site-id">' + s.id + '</span>' +
      '<span><span class="site-name"></span><span class="site-note"></span></span>' +
      '<span class="stats">' +
        '<span class="st"><span class="st-k">Sun</span><span class="st-v sun">' + pct(s.pSun) + '</span><span class="bar sun"><b style="width:' + pct(s.pSun) + '"></b></span></span>' +
        '<span class="st"><span class="st-k">Earth</span><span class="st-v earth">' + pct(s.pEarth) + '</span><span class="bar earth"><b style="width:' + pct(s.pEarth) + '"></b></span></span>' +
        '<span class="st"><span class="st-k">Both</span><span class="st-v">' + pct(s.pBoth) + '</span></span>' +
        '<span class="st"><span class="st-k" title="Longest period with the Sun centre below the horizon">Max. night</span><span class="st-v">' + nightText(s.night, s.nightClipped) + '</span></span>' +
      '</span>';
    b.querySelector('.site-name').textContent = s.name;
    b.querySelector('.site-note').textContent = s.note + ' · ' + num(Math.abs(s.lat), 4) + '° S, ' + num(s.lon, 2) + '° E · ' + qualityText(s);
    b.addEventListener('click', function(){ select(i); });
    sitesEl.appendChild(b);
  });
}
function select(i){ sel = i; $('#hName').textContent = sites[i].name; dirty.sites = true; dirty.charts = true; dirty.view = true; lastHead = -1; schedulePlan(); }
var readoutEl = $('#readout');
function renderReadout(){
  var s = sites[sel], st = siteState(s, state.t);
  readoutEl.innerHTML = '<span class="m">From ' + s.name + ':</span> ' +
    '<span class="s">Sun ' + sgn(st.sunEl, 2) + '° (' + (st.sunLit > 0.5 ? 'lit' : s.flat ? 'below the horizon' : 'hidden by terrain') + ')</span> · ' +
    '<span class="e">Earth ' + sgn(st.earthEl, 2) + '° (' + (st.earthVis > 0 ? 'visible' : 'hidden') + ')</span>';
}

