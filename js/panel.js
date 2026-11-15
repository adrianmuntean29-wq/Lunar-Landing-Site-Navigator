/* panel.js: OWNER "right panel" chat. Fills #panel only: numbers and data, in plain language.
   One section per scene view (App.state.view): system = Orbit, globe = compare sites, region = plan a landing
   (verdict, other missions, sliders, why days fail), ground = standing there now.
   Reads App.state; changes it only with App.set. */
(function(){
  const $ = s => document.querySelector('#panel ' + s), root = document.querySelector('#panel');
  root.innerHTML = `
    <div class="tabs" id="ptabs"><span class="vt" id="vTitle"></span><span class="info-wrap psrc"><button type="button" class="info-i" aria-label="Where the numbers in this panel come from" aria-describedby="pSrcTip">i</button><span class="info-tip" id="pSrcTip" role="tooltip"></span></span><button class="x" id="closeP" type="button" aria-label="Close panel">×</button></div>
    <div class="scroll" id="pSystem" hidden>
      <div class="sitepick"><span>Date and time (UTC)</span><h2 id="oDate"></h2></div>
      <section class="facts">
        <div><span>Moon phase</span><b id="oPhase"></b></div>
        <div><span>Earth to Moon</span><b id="oEM"></b><small id="oEMr"></small></div>
        <div><span>Earth to Sun</span><b id="oES"></b></div>
      </section>
      <section class="blk">
        <h3>At <span class="siteName plain"></span> now</h3><small class="apx" hidden></small>
        <div class="stline"><span class="ic sunc">☀</span><div><b id="oSun"></b></div></div>
        <div class="stline"><span class="ic earthc">⊕</span><div><b id="oEarth"></b></div></div>
      </section>
      <p class="rl">A lunar day (sunrise to sunrise) lasts 29.5 Earth days. At the south pole the Sun circles the horizon once in that time.</p>
      <details class="how"><summary>About this view</summary><p>Click the Sun, Earth or Moon to focus; drag to turn, right-drag to move, scroll to zoom.</p><p>Sun, Earth and Moon at true size and true distance (the view centres on the Sun and shows Earth's yearly path). Earth's path from a standard solar-position formula (~0.01°); Moon positions: JPL Horizons table. Earth image: NASA Blue Marble. Stars decorative.</p><p>Gold lines = spin axes. Earth leans 23.4°, which gives it seasons. The Moon leans only 1.5°, so at its south pole the Sun always skims the horizon and crater rims decide light and shadow.</p></details>
    </div>
    <div class="scroll" id="pGround" hidden>
      <div class="sitepick"><span>Standing at</span><h2 class="siteName"></h2><small class="apx" hidden></small></div>
      <section class="blk">
        <h3>Now <span id="nowT"></span></h3>
        <div class="stline"><span class="ic sunc">☀</span><div><b id="nSun"></b><small id="nSunS"></small><small class="ht" id="nSunH"></small></div></div>
        <div class="stline"><span class="ic earthc">⊕</span><div><b id="nEarth"></b><small id="nEarthS"></small><small class="ht" id="nEarthH"></small></div></div>
        <div class="f2 gm"><span>Mast height</span><span class="seg" id="gMastSeg"><button type="button" data-v="0">0 m</button><button type="button" data-v="2">2 m</button><button type="button" data-v="10">10 m</button></span></div>
      </section>
      <section class="blk">
        <h3>Next 14 days</h3>
        <div class="strip"><div class="sl"><span class="sunc">☀ Sun</span><b id="g14s"></b></div><canvas id="g14" height="44"></canvas><div class="sl"><span class="earthc">⊕ Earth</span><b id="g14e"></b></div></div>
        <div class="ticks" id="g14t"></div>
        <p class="note" id="g14n"></p>
      </section>
      <section class="blk">
        <h3>Next darkness</h3>
        <p class="dark" id="gDark"></p>
        <p class="note">Can shift by up to a day near a ridge.</p>
      </section>
      <details class="how"><summary>About this view</summary><p>Drag to look around, scroll to zoom.</p><p>14-day strip: one column per hour. Sun % = average share of the Sun's disc above the terrain; Earth % = share of hours with Earth in view. Dark = less than half the Sun's disc visible.</p><p>Horizon = NASA LOLA terrain mask (360 directions). Height = angle above a flat, level horizon; the terrain decides if the Sun or Earth is actually visible.</p><p>Orange pins: other missions. Teal strip under the ridge: permanently shadowed areas (LOLA model) within 20 km. Direction only: from the mast they are beyond the horizon or inside crater floors, not in view.</p></details>
    </div>
    <div class="scroll" id="pMission" hidden>
      <!-- Plan a landing, 1-second layout (Eren 14 Nov ~21:15): one answer, one bar, four sliders; the rest folds or sits in (i) tips -->
      <div class="sitepick plHead"><h2 class="siteName"></h2><span id="plInfo"></span></div>
      <small class="apx plApx" hidden></small>
      <small class="plZone" id="plZone" hidden></small>
      <section class="verdict" id="verdict" aria-live="polite">
        <div class="vn"><b id="rN"></b><span id="rNs"></span></div>
        <div class="plStack" id="rStack" aria-hidden="true"></div>
        <div class="plLeg" id="rLeg"></div>
        <p id="rFirst"></p>
      </section>
      <section class="others" id="others" hidden><b id="oHead"></b><span id="oTip"></span></section>
      <section class="plMis">
        <div class="plRow"><h3>Your mission</h3><div class="kind" id="kindSeg"><button type="button" data-v="robotic" aria-pressed="true">Robotic · 13 d</button><button type="button" data-v="crew" aria-pressed="false">Crew · 6 d</button></div></div>
        <label class="slr"><span class="t">Mission length <b id="vLen"></b></span><input id="len" type="range" min="1" max="60"></label>
        <label class="slr"><span class="t">Sunlight <b id="vSun"></b></span><input id="sun" type="range" min="0" max="100"></label>
        <label class="slr"><span class="t"><span>Earth contact <span id="earthTip"></span></span><b id="vEarth"></b></span><input id="earth" type="range" min="0" max="100"></label>
        <label class="slr"><span class="t">Darkness <b id="vNight"></b></span><input id="night" type="range" min="0" max="240" step="6"></label>
      </section>
      <details class="how plMore"><summary id="plMoreS">More options</summary>
        <label class="chk2"><input type="checkbox" id="relay"> A relay satellite handles communication (ignore the Earth limit)</label>
        <div class="f2"><span>Solar panels and antenna height</span><span class="seg" id="mast"><button type="button" data-v="0">0 m</button><button type="button" data-v="2">2 m</button><button type="button" data-v="10">10 m</button></span></div>
        <div class="f2"><span>Must be near permanent shadow</span><span class="seg" id="psrf"><button type="button" data-v="0">no</button><button type="button" data-v="10">10 km</button><button type="button" data-v="5">5 km</button><button type="button" data-v="2">2 km</button></span></div>
        <p class="rl" id="rPsr"></p>
        <h4 class="plSub">Your own spot</h4><div class="spotf"></div>
      </details>
      <details class="how"><summary>How this is computed</summary><p>Sunlight: average share of the Sun's disc above the real terrain horizon (NASA LOLA). Darkness: the Sun's centre is below that horizon; when the Sun only grazes a ridge, the longest darkness can shift by up to a day. Earth contact: any part of Earth is above it (geometry only, not a radio link). Sun and Earth positions: JPL Horizons. Each day means a landing at 00:00 UTC.</p><p>The bar: each failed day is counted once, under its first reason (sunlight, then Earth, then darkness).</p><p>Limits: the Earth 25% default is the map mask used in a 2024 NASA presentation; sunlight, length and darkness are example values.</p></details>
      <details class="how"><summary>About this view</summary><p>Terrain: NASA LOLA heights (PGDA 90, Barker et al. 2023). The view centres on the selected site. Around each named site: 100 m grid, 50 × 50 km (from the 20 m map). Elsewhere: 240 m near the pole, 1.2 km out to 300 km. Your own spot has no close-up tile, so its ground is coarse. Heights ×2, and the ground curves with the Moon.</p><p>Shadows in this view are visual only; every number comes from the 360-direction horizon masks.</p></details>
    </div>
    <div class="scroll" id="pSites" hidden>
      <p class="rl lhead">Click a site to compare.</p>
      <div id="siteList" class="sitelist"></div>
      <div class="sec"><h3>YOUR OWN SPOT</h3><div class="spotf"></div></div>
      <div class="sec"><h3>DATA</h3><div class="prov" id="prov"></div></div>
      <details class="how"><summary>About this view</summary><p>3D terrain: LOLA polar heights (PGDA 90): 240 m grid within 57 km of the pole, 1.2 km grid out to 80° S (about 300 km). Heights ×2, edge eased into the globe. Shadows and fill light are visual only; all numbers come from the 360-direction horizon masks. Surface colour: NASA SVS CGI Moon Kit (made for looks, not science). Exact numbers only for the named sites; your own spot is approximate.</p></details>
    </div>`;

  /* Custom landing spot (Eren via engine, 14 Nov; core App.addSpot). Same form in the Plan and Moon views.
     Every number for a custom spot carries site.label + an (i): approximate horizon, up to ~20 points off in sun % (engine MEASURED). */
  const APX_TIP = 'Horizon from coarse terrain grids, not the exact masks of the named sites. It misses nearby bumps, so sun and Earth % can be far off. Distance to permanent shadow is not computed.';
  let tipN = 0;
  root.querySelectorAll('.spotf').forEach(f => { f.innerHTML = '<div class="addspot"><label>Latitude<br><input class="sLat" type="number" step="0.01" value="-89.2" aria-label="Latitude, degrees (negative = south)"></label><label>Longitude E<br><input class="sLon" type="number" step="0.1" value="120" aria-label="East longitude, degrees"></label><button class="btn sAdd" type="button">Add</button><button class="btn sDel" type="button" hidden>Remove</button></div><p class="note sMsg">Any spot within 290 km of the pole. Its horizon is approximate.</p>'; });
  // Tudor's zones, relabelled by Eren 2026-11-15 "Flat, smooth terrain (team analysis)" (exact engine check: at most ~51% sun inside them).
  // One line for the selected site in Compare sites. Never "candidate", never "NASA zones", never "ice".
  const zoneTip = () => 'Flat, smooth terrain (team analysis by Tudor). Most of it is dark most of the time.';   // coordinator wording 2026-11-15, same in every view
  const zoneLine = s => { const z = App.zoneAt && App.state.zones !== false ? App.zoneAt(s.lat, s.lon) : null; if (!z) return '';
    return '<div class="gzone">' + (z.inside ? 'Inside flat, smooth area ' + z.id : z.km.toFixed(1) + ' km from flat, smooth area ' + z.id) + ' ' + tip('About flat, smooth areas', zoneTip()) + '</div>'; };
  const tip = (label, text) => { const id = 'apxTip' + (tipN++); return '<span class="info-wrap"><button type="button" class="info-i" aria-label="' + label + '" aria-describedby="' + id + '">i</button><span class="info-tip left" id="' + id + '" role="tooltip">' + text + '</span></span>'; };
  // truncated horizon (coordinator 14 Nov, core site.truncated + edge_rays): missing far terrain can only raise the horizon
  const TRUNC_TXT = s => 'Part of the horizon is beyond our map: ' + s.edge_rays + ' of 360 directions reach the map edge before the terrain stops rising. Missing terrain can only hide the Sun or Earth more, so the true values can be lower, never higher.';
  /* 50 m ranges (Eren 14 Nov ~20:00, core site.range): exact horizons at 25 points, fixed at 2 m mast and 2027-2031. Custom spots: none. */
  const RANGE_TIP = s => 'Exact horizons at 25 points (the site, 8 at 25 m, 16 at 50 m), 2 m mast, 2027-2031. No slope check: some ring points may be too steep to land on.' +
    (/^best-lit/.test(s.kind || '') ?' This point was chosen as the best-lit one, so it sits at the top of its range.' : '') +
    (s.range.upper ? ' Part of the horizon is beyond our map, so these are upper bounds.' : '');
  function rangeLine(s){ const t = rangeText(s); return t ? '<span>' + t + '</span>' + (s.range.upper ? ' <span class="ub">Upper bound</span>' : '') + ' ' + tip('About this range', RANGE_TIP(s)) : ''; }
  function rangeText(s){
    const R = s.range; if (!R || s.custom) return '';
    const r = Math.round, a = R.r25.sun_pct, b = R.r50.sun_pct, st = App.state;
    const p25 = r(a.min) === r(a.max) ? r(a.max) + '%' : r(a.min) + '-' + r(a.max) + '%';
    let t = 'Within 25 m: ' + p25 + ' sun.';
    const lo = r(b.min) < r(a.min), hi = r(b.max) > r(a.max);
    t += lo && hi ? ' Within 50 m: ' + r(b.min) + '-' + r(b.max) + '%.' : lo ? ' Within 50 m: as low as ' + r(b.min) + '%.' : hi ? ' Within 50 m: up to ' + r(b.max) + '%.' : ' Same within 50 m.';
    const y0 = App.date(st.jd0).getUTCFullYear(), y1 = App.date(st.jd0 + st.days - 1).getUTCFullYear();
    if (st.mast !== R.mast || y0 + '-' + y1 !== R.period) t += ' (at ' + R.mast + ' m, ' + R.period + ')';
    return t;
  }
  const truncBit = s => s.truncated ? '<span class="ub">Upper bound: sun %, Earth % and good days</span> ' + tip('About upper bound', TRUNC_TXT(s)) : '';
  function approxLines(){
    const s = App.sites[App.state.site], cus = !!s.custom, tr = !!s.truncated;
    root.querySelectorAll('.apx').forEach(el => { el.hidden = !cus && !tr; if (el.hidden) return;
      el.innerHTML = (cus ? '<span>' + s.label.charAt(0).toUpperCase() + s.label.slice(1) + '</span> ' + tip('About approximate numbers', s.why ? s.why + ' Distance to permanent shadow is not computed.' : APX_TIP) : '') + truncBit(s); });
    const rl = rangeLine(s); root.querySelectorAll('.rng').forEach(el => { el.hidden = !rl; el.innerHTML = rl; });
    root.querySelectorAll('.sDel').forEach(b => b.hidden = !App.state.spot);
  }
  async function addSpot(f){
    const msg = f.querySelector('.sMsg'), btn = f.querySelector('.sAdd');
    btn.disabled = true; msg.classList.remove('err'); msg.textContent = 'Computing the horizon (about 1 s)...';
    try { const s = await App.addSpot(f.querySelector('.sLat').value, f.querySelector('.sLon').value); msg.textContent = 'Added and selected: ' + Math.abs(s.lat).toFixed(2) + '° S, ' + s.lon.toFixed(1) + '° E (' + s.label + ').'; }
    catch (e){ msg.classList.add('err'); msg.textContent = e.message; }
    finally { btn.disabled = false; }
  }
  const pressed = (sel, v) => root.querySelectorAll(sel + ' button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === String(v)));
  function sliders(){
    const st = App.state;
    [['len', 'vLen', v => v + ' days'], ['sun', 'vSun', v => 'at least ' + v + '%'], ['earth', 'vEarth', v => st.lim.relay ? 'not needed (relay)' : 'at least ' + v + '%'], ['night', 'vNight', v => v == 0 ? 'none' : 'up to ' + v + ' h']].forEach(([id, out, f]) => {
      const el = $('#' + id); el.value = st.lim[id]; el.style.setProperty('--p', (el.value - el.min)/(el.max - el.min)*100 + '%'); $('#' + out).textContent = f(+el.value); });
    $('#earth').disabled = st.lim.relay; $('#relay').checked = st.lim.relay;
    pressed('#mast', st.mast); pressed('#gMastSeg', st.mast); pressed('#psrf', st.psr);
    const pre = Object.entries(App.PRESETS).find(([k, p]) => ['len', 'sun', 'earth', 'night'].every(q => p[q] === st.lim[q]));
    pressed('#kindSeg', pre ? pre[0] : '');
    // folded options say their current values, so nothing hidden changes the answer unseen
    $('#plMoreS').textContent = 'More options: ' + st.mast + ' m mast' + (st.lim.relay ? ', relay' : '') + (st.psr ? ', within ' + st.psr + ' km of shadow' : '') + (st.spot ? ', your spot' : '');
  }
  function now(){
    const st = App.state, s = App.sites[st.site], j = st.jd0 + st.t, a = App.next(s, j, 'sun'), b = App.next(s, j, 'earth');
    $('#nowT').textContent = App.iso(j) + ' UTC';
    $('#nSun').textContent = a.now ? 'Sunlit' : 'In shadow';
    $('#nSun').closest('.stline').classList.toggle('off', !a.now); $('#nEarth').closest('.stline').classList.toggle('off', !b.now);
    $('#nSunS').textContent = a.h == null ? (a.now ? 'For 60+ days' : 'Dark for 60+ days') : (a.now ? 'Sets ' : 'Rises ') + App.plainH(a.h);
    $('#nEarth').textContent = b.now ? 'Earth in view' : 'Earth hidden';
    $('#nEarthS').textContent = b.h == null ? (b.now ? 'For 60+ days' : 'Hidden for 60+ days') : (b.now ? 'Sets ' : 'Rises ') + App.plainH(b.h) + (b.now ? '' : ', no direct radio until then');
  }
  // Heights and the Orbit facts (moved here from the middle screen on Eren's call, 14 Nov ~16:00).
  const deg = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '°';
  const km = v => Math.round(v).toLocaleString('en-US') + ' km';
  const dShort = jd => App.date(jd).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'});
  function heights(){
    const st = App.state, x = App.stateAt(App.sites[st.site], st.jd0 + st.t);
    const lvl = v => Math.abs(v).toFixed(2) + '° ' + (v >= 0 ? 'above' : 'below') + ' level';
    $('#nSunH').textContent = lvl(x.su.el) + ' · ' + (x.sunLit >= 0.5 ? 'clears the terrain' : 'behind terrain');
    $('#nEarthH').textContent = lvl(x.ea.el) + ' · ' + (x.earthVis ? 'clears the terrain' : 'behind terrain');
  }
  // Ground Level: next 14 days hour by hour + next dark spell (Eren 14 Nov). Same rules as core: dark = Sun disc < 0.5.
  const css = n => getComputedStyle(root).getPropertyValue(n).trim();
  function ahead(){
    const st = App.state, ser = App.series(st.site), H = ser.sun.length, h0 = Math.max(0, Math.floor(st.t*24)), n = Math.min(14*24, H - h0);
    const cv = $('#g14'), W = cv.clientWidth || 300, ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    cv.width = W*dpr; cv.height = 44*dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, 44);
    const bw = W/(14*24), sc = css('--cell-sun'), ec = css('--cell-earth'), off = css('--line');
    ctx.fillStyle = off; ctx.fillRect(0, 2, W, 16); ctx.fillRect(0, 26, W, 16);
    let s = 0, e = 0;
    for (let k = 0; k < n; k++){ const v = ser.sun[h0 + k], x = k*bw; s += v; e += ser.earth[h0 + k];
      if (v > 0){ ctx.globalAlpha = Math.max(.35, v); ctx.fillStyle = sc; ctx.fillRect(x, 2, bw + .5, 16); }
      if (ser.earth[h0 + k]){ ctx.globalAlpha = 1; ctx.fillStyle = ec; ctx.fillRect(x, 26, bw + .5, 16); } }
    ctx.globalAlpha = 1; ctx.fillStyle = css('--panel2'); for (let d = 1; d < 14; d++) ctx.fillRect(Math.round(d*24*bw), 0, 1, 44);   // day gaps
    $('#g14s').textContent = n ? Math.round(s/n*100) + '%' : '-'; $('#g14e').textContent = n ? Math.round(e/n*100) + '%' : '-';
    $('#g14t').innerHTML = [0, 7, 14].map(d => '<span>' + (d ? '+' + d + ' days' : 'now') + '</span>').join('');
    $('#g14n').textContent = n < 14*24 ? 'Data ends after ' + (n/24).toFixed(1) + ' days (end of the chosen period).' : ''; $('#g14n').hidden = n >= 14*24;
    // next dark spell
    let i = h0, txt;
    if (i < H && ser.sun[i] < 0.5){ let j = i; while (j < H && ser.sun[j] < 0.5) j++; let a = i; while (a > 0 && ser.sun[a - 1] < 0.5) a--;
      txt = '<b>Dark now.</b> The Sun comes back ' + (j < H ? App.plainH(j - h0) : 'after the end of the data') + '. This dark spell lasts about <b>' + (j - a) + ' h</b>' + (a === 0 || j >= H ? ' (cut by the data range)' : '') + '.'; }
    else { while (i < H && ser.sun[i] >= 0.5) i++;
      if (i >= H) txt = '<b>No darkness</b> until the end of the data (' + App.iso(st.jd0 + H/24).slice(0, 10) + ').';
      else { let j = i; while (j < H && ser.sun[j] < 0.5) j++; txt = 'Next dark spell starts <b>' + App.plainH(i - h0) + '</b> and lasts about <b>' + (j - i) + ' h</b>' + (j >= H ? ' (or longer: data ends)' : '') + '.'; } }
    $('#gDark').innerHTML = txt;
  }
  function orbit(){
    const st = App.state, j = st.jd0 + st.t, m = App.moonInfo(j), x = App.stateAt(App.sites[st.site], j);
    $('#oDate').textContent = App.iso(j);
    $('#oPhase').textContent = m.phase + ', ' + Math.round(m.lit*100) + '% lit';
    $('#oEM').textContent = km(m.earthKm);
    $('#oEMr').textContent = 'Closest ' + km(m.closest.km) + ' on ' + dShort(m.closest.jd) + ' · farthest ' + km(m.farthest.km) + ' on ' + dShort(m.farthest.jd) + ' (within 15 days)';
    $('#oES').textContent = (m.sunKm/1e6).toFixed(1) + ' million km';
    $('#oSun').textContent = x.sunLit >= 0.5 ? 'Sun up' : 'Sun down (behind the terrain)';
    $('#oEarth').textContent = x.earthVis ? 'Earth in view' : 'Earth hidden (no direct radio contact)';
    $('#oSun').closest('.stline').classList.toggle('off', x.sunLit < 0.5); $('#oEarth').closest('.stline').classList.toggle('off', !x.earthVis);
  }
  // Moon view (design A, Eren 14 Nov ~20:15): the map shows numbered markers; the expanded row of the selected site carries the live lines.
  function globeSite(){
    const g = $('#gSun'); if (!g) return;
    const st = App.state, s = App.sites[st.site], j = st.jd0 + st.t, a = App.next(s, j, 'sun'), b = App.next(s, j, 'earth');
    g.textContent = a.now ? 'Sun up' : 'Sun down';
    $('#gSunS').textContent = a.h == null ? 'no change within 60 days' : (a.now ? 'sets ' : 'rises ') + App.plainH(a.h);
    $('#gEarth').textContent = b.now ? 'Earth in view' : 'Earth hidden';
    $('#gEarthS').textContent = b.h == null ? 'no change within 60 days' : (b.now ? 'sets ' : 'rises ') + App.plainH(b.h);
    g.closest('.stline').classList.toggle('off', !a.now); $('#gEarth').closest('.stline').classList.toggle('off', !b.now);
  }
  function live(){ const v = App.state.view; if (v === 'system') orbit(); else if (v === 'ground'){ now(); heights(); ahead(); } else if (v === 'globe') globeSite(); }
  function result(){
    const st = App.state, s = App.sites[st.site], w = App.wins(st.site), ok = w.filter(o => !o.fail.length);
    const y0 = App.date(st.jd0).getUTCFullYear(), y1 = App.date(st.jd0 + st.days - 1).getUTCFullYear();
    const yr = y0 === y1 ? y0 : y0 + '-' + y1;
    $('#verdict').classList.toggle('none', !ok.length);
    $('#rN').textContent = ok.length; $('#rNs').textContent = 'of ' + w.length + ' landing days in ' + yr + ' work';
    $('#rFirst').innerHTML = ok.length ? 'First good day: <b>' + App.dayDate(ok[0].d) + '</b>' : 'No day works. Loosen a slider or open More options.';
    $('#rPsr').innerHTML = s.psr_km != null ? 'This site is <b>' + s.psr_km.toFixed(1) + ' km</b> from the nearest permanently shadowed area' + (st.psr ? (s.psr_km <= st.psr ? ', inside your ' + st.psr + ' km limit.' : ', <b>outside</b> your ' + st.psr + ' km limit.') : '.') : '';
    // one bar: good days, then each failed day under its first reason (sunlight, Earth, darkness); same counts as the old "why" bars
    const n = [0, 0, 0]; w.forEach(o => { if (o.fail.indexOf('sun') < 0){ n[0]++; if (o.fail.indexOf('earth') < 0){ n[1]++; if (o.fail.indexOf('night') < 0) n[2]++; } } });
    const segs = [['good', ok.length, 'var(--go)'], ['no sun', w.length - n[0], 'var(--sun)'], ['no Earth', n[0] - n[1], 'var(--earth)'], ['too dark', n[1] - n[2], 'var(--f-dark)']];
    $('#rStack').innerHTML = segs.map(g => g[1] ? '<i style="flex:' + g[1] + ';background:' + g[2] + '"></i>' : '').join('');
    $('#rLeg').innerHTML = segs.slice(1).filter(g => g[1]).map(g => '<span><i style="background:' + g[2] + '"></i>' + g[0] + ' ' + g[1] + '</span>').join('');
    // site (i): where the point comes from, its 25/50 m range, distance to permanent shadow
    const rt = rangeText(s);
    $('#plInfo').innerHTML = tip('About this site', (s.custom ? 'Your own spot (' + s.label + ').' : (s.kind ? s.kind.charAt(0).toUpperCase() + s.kind.slice(1) + '.' : '')) +
      (rt ? ' ' + rt + ' ' + RANGE_TIP(s) : '') + (s.psr_km != null ? ' ' + s.psr_km.toFixed(1) + ' km to the nearest permanently shadowed area.' : '') +
      (!s.custom && s.short === 'C1' && st.mast === '0' ? ' ' + 'At ground level this point is very sensitive: a 0.7° slope within 100 m blocks the low Sun in our 20 m terrain, so it reads 55.8% (5 years) where Gläser et al. 2018 report 76%. At 2 m (a panel on a mast) it clears: 85.6% vs 88.0%. Use the 2 m value.' : ''));
    // candidate zones (Tudor's team analysis; App.zoneAt from core.js once data/zones.json lands): one line + (i). Never "NASA" regions, never "ice".
    const zEl = $('#plZone'), za = typeof App.zoneAt === 'function' && st.zones !== false ? App.zoneAt(s.lat, s.lon) : null;
    zEl.hidden = !za; if (za){ const zn = za.zone || za, nm = 'flat, smooth area ' + zn.id, km = za.km ?? za.dist_km ?? za.distance_km;
      zEl.innerHTML = '<span>' + (za.inside ? 'Inside ' + nm : (km != null ? km.toFixed(1) + ' km from ' : 'Nearest: ') + nm) + '</span> ' +
        tip('About flat, smooth terrain zones', 'Flat, smooth terrain (team analysis by Tudor). Most of it is dark most of the time. Drawn in ArcGIS from LOLA slope and hillshade, PGDA 90 roughness and permanently shadowed regions; not NASA regions.'); }
  }
  function others(){
    const box = $('#others');
    if (!window.Missions || !(App.state.missions || {}).on){ box.hidden = true; return; }
    const m = Missions.summary(App.sites[App.state.site]), cut = m.text.indexOf('. ');
    box.hidden = m.ok; if (m.ok) return;   // 1-second layout: the line shows only when another mission matters
    box.classList.add('warn');
    $('#oHead').textContent = cut > 0 ? m.text.slice(0, cut + 1) : m.text;
    $('#oTip').innerHTML = tip('About other missions', (cut > 0 ? m.text.slice(cut + 2) + ' ' : '') + Missions.LABEL);
  }
  function siteList(){
    const st = App.state, sj = App.sitesJson;
    // design A: App.sites order, so row number = map marker number (i + 1, same rule as the scene). Custom spot keeps its number, labelled approximate.
    const rows = App.sites.map((s, i) => { const w = App.wins(i); return {i, s, ok: w.filter(o => !o.fail.length).length, n: w.length, rs: s.raw.reference_stats.by_mast[st.mast]}; });
    /* Red team 17:54 item 5: no bare one-decimal site %. Whole %, the mast height on the label, and the 0/2/10 m spread from the same data.
       A published value that disagrees by > 5 points (C1 at 0 m: 76 vs 56) gets an (i) on why bare-surface values are fragile. */
    const P = v => Math.round(v) + '%';
    // Connecting Ridge at 0 m (Eren 15 Nov, via Competitor Research): note, never hide. Engine logs 2026-11-14-1400 + 2026-11-15-1040 (MEASURED).
    const C1_TIP = 'At ground level this point is very sensitive: a 0.7° slope within 100 m blocks the low Sun in our 20 m terrain, so it reads 55.8% (5 years) where Gläser et al. 2018 report 76%. At 2 m (a panel on a mast) it clears: 85.6% vs 88.0%. Use the 2 m value.', c1 = s => !s.custom && s.short === 'C1';
    const SPREAD_TIP = 'Share of 2027 hours with the Sun (or Earth) in view at this exact point, from a mast of that height. Moving 20-40 m can change it by tens of points (our test at the studied sites), so read it as a guide, not an exact value.';
    const refBit = raw => { const all = raw.reference || [], ref = all.find(x => String(x.mast_m) === st.mast);
      if (!ref) return all.length ? 'published value only at ' + all.map(x => x.mast_m + ' m').join(', ') : 'no published value';
      let t = ref.paper + ' (' + ref.mast_m + ' m): ' + P(ref.sun_pct) + ' vs ours ' + P(ref.ours_5y_sun_pct) + ' (5 y)';
      if (Math.abs(ref.diff_points) > 5){ const ok = all.find(x => x !== ref && Math.abs(x.diff_points) <= 5);
        t += ' ' + tip('Why the published value differs', 'At the bare surface, a slope too small to see on the map changes this value a lot, so one point can disagree with a paper by tens of points.' + (ok ? ' With a ' + ok.mast_m + ' m mast the paper and we agree: ' + P(ok.sun_pct) + ' vs ' + P(ok.ours_5y_sun_pct) + '.' : '')); }
      return t; };
    const misOn = window.Missions && (st.missions || {}).on;
    const y0 = App.date(st.jd0).getUTCFullYear();
    const row = r => { const s = r.s, raw = s.raw, sel = r.i === st.site, out = st.psr && raw.psr_km > st.psr, bm = raw.reference_stats.by_mast;
      const m = misOn ? Missions.summary(s) : null, hist = /^historic/.test(s.kind || '');
      /* Eren ~21:45: "nobody should need more than 1 second". Row = number, name, good days + bar; one ⚠ only when something is off.
         Selected row = now (Sun/Earth), 4 big numbers, mission warning, plan button; everything else under "More detail". */
      // Tudor's sites (2026-11-15): a short kind tag in the row, the full kind on hover and under More detail
      const KSHORT = {'best-lit flat point in team terrain zone (Tudor)': 'flat + lit (Tudor)', 'team proposed site (Tudor)': "Tudor's site"}, ks = KSHORT[s.kind];
      const le = s.truncated ? '≤ ' : '', warns = [];
      if (m && !m.ok) warns.push('another mission plans to land nearby');
      if (hist) warns.push('historic target, for comparison only');   // ⚠ only for things a planner must act on; "best case" is the ≤ sign, your spot is the ★
      const wn = warns.length ? '<span class="wn" title="' + warns.join('; ') + '" aria-label="Warning: ' + warns.join('; ') + '">⚠</span>' : '';
      const ddTip = s.truncated ? ' title="Best case: part of the horizon is outside our map, so the real number can only be lower"' : s.custom ? ' title="Your spot: ' + s.label + ', approximate"' : '';
      let h = '<div class="srow' + (sel ? ' sel' : '') + (out ? ' out' : '') + '" data-i="' + r.i + '" role="button" tabindex="0" aria-pressed="' + sel + '">' +
        '<div class="rh"><span class="num">' + (s.custom ? '★' : r.i + 1) + '</span><span class="nm">' + s.name + (ks ? ' <em class="kindtag ktud" title="' + s.kind + '">' + ks + '</em>' : '') + '</span>' + wn + '<span class="dd"' + ddTip + '><b>' + (s.custom ? '~ ' : le) + r.ok + '</b> good days</span></div>' +
        '<div class="gbar" title="' + r.ok + ' of ' + r.n + ' landing days in ' + y0 + ' work"><i style="width:' + (r.n ? r.ok/r.n*100 : 0).toFixed(1) + '%"></i></div>';
      if (sel){ const poleKm = 2*1737.4*Math.tan((90 + raw.lat)/2*Math.PI/180), cut = m ? m.text.indexOf('. ') : -1;
        h += '<div class="rx">' +
          '<div class="gnow"><div class="stline"><span class="ic sunc">☀</span><div><b id="gSun"></b><small id="gSunS"></small></div></div>' +
          '<div class="stline"><span class="ic earthc">⊕</span><div><b id="gEarth"></b><small id="gEarthS"></small></div></div></div>' +
          '<div class="gnums g4"><div class="t-sun"><span>Sunlight</span><b>' + le + P(r.rs.sun_pct) + '</b></div><div class="t-earth"><span>Earth in view</span><b>' + le + P(r.rs.earth_pct) + '</b></div>' +
          '<div class="t-night"><span>Longest night</span><b>' + r.rs.longest_night_h + ' h</b></div><div class="t-psr"><span>To permanent shadow</span><b>' + (s.psr_km != null ? s.psr_km.toFixed(1) + ' km' : 'unknown') + '</b>' + (out ? '<small>outside your shadow filter</small>' : '') + '</div></div>' +
          '<div class="gfor">' + st.mast + ' m mast · ' + y0 + (s.custom ? ' · approximate' : '') + (s.truncated ? ' · best case' : '') + (c1(s) && st.mast === '0' ? ' ' + tip('About Connecting Ridge at ground level', C1_TIP) : '') + '</div>' +
          zoneLine(s) +
          (m && !m.ok ? '<div class="gmis warn"><b>⚠ ' + (cut > 0 ? m.text.slice(0, cut + 1) : m.text) + '</b></div>' : '') +
          '<button class="go" type="button" id="gPlan">Plan a landing here <span aria-hidden="true">→</span></button>' +
          '<details class="gmore"><summary>More detail</summary>' +
          (s.custom ? '' : '<div class="q"><em class="kindtag' + (hist ? ' hist' : '') + '">' + (s.kind || '') + '</em></div>') +
          '<div class="q">' + Math.abs(raw.lat).toFixed(4) + '° S, ' + raw.lon_e.toFixed(2) + '° E · ' + poleKm.toFixed(1) + ' km from the pole</div>' +
          (s.range && !s.custom ? '<div class="q">' + rangeLine(s) + '</div>' : '') +
          '<div class="q">Sun in ' + y0 + ' with a 0 / 2 / 10 m mast: ' + ['0', '2', '10'].map(k => Math.round(bm[k].sun_pct)).join(' / ') + '% ' + tip('About these percentages', SPREAD_TIP) + (c1(s) ? ' ' + tip('About Connecting Ridge at ground level', C1_TIP) : '') + '</div>' +
          '<div class="q">' + (s.custom ? s.label + ' ' + tip('About approximate numbers', s.why || APX_TIP) : refBit(raw)) + (s.truncated ? ' · ' + truncBit(s) : '') + '</div>' +
          (m ? '<div class="q">' + (m.ok ? 'Other missions: none too close. ' : (cut > 0 ? m.text.slice(cut + 2) + ' ' : '')) + Missions.LABEL + '</div>' : '') +
          '</details></div>'; }
      return h + '</div>'; };
    $('#siteList').innerHTML = rows.map(row).join('');
    globeSite();
    $('#prov').innerHTML = 'Terrain masks: ' + sj.versions.dem + '; near field ' + sj.versions.dem_near + '; computed ' + sj.generated_utc + '<br>Sun/Earth: JPL Horizons DE441 table, computed ' + App.eph.generated_utc + '<br>Permanent shadow: PGDA 90 outlines, ' + App.psr.polygons.length + ' regions ≥ 1 km²<br>All numbers are precomputed by our engine; this page does not run new terrain calculations for the named sites.';
  }
  // One panel section per scene view (Eren 14 Nov): the view tabs on the Moon decide what the panel answers.
  /* source (i) next to the panel title (Eren 15 Nov, via coordinator): one per view, every number cited from the vault logs */
  const SRC = {
    system: '<span><b>Where these numbers come from</b> (date, Moon phase, distances, Sun and Earth at the site):</span>' + '<span><b>Sun and Earth positions</b>: NASA JPL Horizons, a 6-hour table for 2026-2035.</span>' + '<span><b>Distances and Moon phase</b>: from the same JPL Horizons table.</span>' + '<span><b>Terrain horizon</b>: NASA LOLA south-pole elevation model (PGDA product 90, Barker et al. 2023), 20 m terrain within 10 km of a named site, 80 m beyond.</span>' + '<span><b>Checked (our tests)</b>: Sun within 0.0003° and Earth within 0.0055° of JPL Horizons computed for an observer at the site; page and our Python engine agree on 10,589 of 10,590 landing days (10 sites, 3 mast heights, 2027); Shackleton rim at ground level 79.1% sunlight vs 81.0% in Gläser et al. 2018, Connecting Ridge at 2 m 85.6% vs 88.0% (same paper).</span>',
    globe: '<span><b>Where these numbers come from</b> (good days, sunlight %, Earth %, longest night, ranges, distance to shadow):</span>' + '<span><b>Sun and Earth positions</b>: NASA JPL Horizons, a 6-hour table for 2026-2035.</span>' + '<span><b>Terrain horizon</b>: NASA LOLA south-pole elevation model (PGDA product 90, Barker et al. 2023), 20 m terrain within 10 km of a named site, 80 m beyond.</span>' + '<span><b>25 m / 50 m ranges</b>: the same exact method at 25 points round the site, 2 m mast, 2027-2031, no slope check.</span>' + '<span><b>Permanent shadow</b>: NASA LOLA permanently shadowed regions map (PGDA product 90). A model of shadow, not a map of ice.</span>' + '<span><b>Flat, smooth terrain</b>: team analysis by Tudor, not NASA regions.</span>' + '<span><b>Checked (our tests)</b>: Sun within 0.0003° and Earth within 0.0055° of JPL Horizons computed for an observer at the site; page and our Python engine agree on 10,589 of 10,590 landing days (10 sites, 3 mast heights, 2027); Shackleton rim at ground level 79.1% sunlight vs 81.0% in Gläser et al. 2018, Connecting Ridge at 2 m 85.6% vs 88.0% (same paper).</span>' + '<span><b>Your own spot</b>: same method on coarse 240 m / 640 m terrain, approximate, can differ by up to about 20 points.</span>',
    region: '<span><b>Where these numbers come from</b> (good days, why days fail, your limits):</span>' + '<span><b>Sun and Earth positions</b>: NASA JPL Horizons, a 6-hour table for 2026-2035.</span>' + '<span><b>Terrain horizon</b>: NASA LOLA south-pole elevation model (PGDA product 90, Barker et al. 2023), 20 m terrain within 10 km of a named site, 80 m beyond.</span>' + '<span><b>Limits</b>: Earth contact 25% is the visibility mask used in a 2024 NASA presentation (Dwyer Cianciolo, NTRS 20240009596); mission length, sunlight and darkness are example values.</span>' + '<span><b>Other missions and keep-out</b>: sources in the other-missions (i).</span>' + '<span><b>Checked (our tests)</b>: Sun within 0.0003° and Earth within 0.0055° of JPL Horizons computed for an observer at the site; page and our Python engine agree on 10,589 of 10,590 landing days (10 sites, 3 mast heights, 2027); Shackleton rim at ground level 79.1% sunlight vs 81.0% in Gläser et al. 2018, Connecting Ridge at 2 m 85.6% vs 88.0% (same paper).</span>' + '<span><b>Your own spot</b>: same method on coarse 240 m / 640 m terrain, approximate, can differ by up to about 20 points.</span>',
    ground: '<span><b>Where these numbers come from</b> (Sun and Earth now, heights, next 14 days, next darkness):</span>' + '<span><b>Sun and Earth positions</b>: NASA JPL Horizons, a 6-hour table for 2026-2035.</span>' + '<span><b>Terrain horizon</b>: NASA LOLA south-pole elevation model (PGDA product 90, Barker et al. 2023), 20 m terrain within 10 km of a named site, 80 m beyond.</span>' + '<span><b>Permanent shadow</b>: NASA LOLA permanently shadowed regions map (PGDA product 90). A model of shadow, not a map of ice.</span>' + '<span><b>Checked (our tests)</b>: Sun within 0.0003° and Earth within 0.0055° of JPL Horizons computed for an observer at the site; page and our Python engine agree on 10,589 of 10,590 landing days (10 sites, 3 mast heights, 2027); Shackleton rim at ground level 79.1% sunlight vs 81.0% in Gläser et al. 2018, Connecting Ridge at 2 m 85.6% vs 88.0% (same paper).</span>' + '<span><b>Your own spot</b>: same method on coarse 240 m / 640 m terrain, approximate, can differ by up to about 20 points.</span>'
  };
  const VIEWS = {system: ['#pSystem', 'Orbit'], globe: ['#pSites', 'Compare sites'], region: ['#pMission', 'Plan a landing'], ground: ['#pGround', 'On the ground']};
  function showView(){
    const v = VIEWS[App.state.view] ? App.state.view : 'region';
    Object.entries(VIEWS).forEach(([k, [sel]]) => $(sel).hidden = k !== v);
    $('#vTitle').textContent = VIEWS[v][1]; $('#pSrcTip').innerHTML = SRC[v];
  }
  let lastNow = 0;
  function render(keys, source){
    const light = keys && [...keys].every(k => ['t', 'selDay', 'playing', 'speed', 'panelOpen', 'drawerOpen'].includes(k));
    if (light){ if (performance.now() - lastNow > 250){ lastNow = performance.now(); live(); } return; }   // only the time moved: update the live numbers of the visible view
    showView(); approxLines(); root.querySelectorAll('.siteName').forEach(h => h.textContent = App.sites[App.state.site].name); sliders(); now(); heights(); if (App.state.view === 'ground') ahead(); orbit(); globeSite(); result(); others(); siteList();
  }

  // Fold any section to its heading (Eren 14 Nov): chevron on each .blk heading; the verdict card never folds.
  root.querySelectorAll('.blk > h3').forEach(h => {
    h.setAttribute('role', 'button'); h.tabIndex = 0; h.setAttribute('aria-expanded', String(!h.parentElement.classList.contains('shut')));
    h.insertAdjacentHTML('beforeend', '<i class="chev" aria-hidden="true"></i>');
    const flip = () => { const shut = h.parentElement.classList.toggle('shut'); h.setAttribute('aria-expanded', !shut); };
    h.onclick = flip; h.onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); flip(); } };
  });
  App.ready.then(() => {
    $('#earthTip').innerHTML = tip('About the Earth limit', 'Share of the stay with Earth above the terrain (direct radio possible). The 25% default is the map mask used in a 2024 NASA presentation. Sunlight, length and darkness defaults are example values.');
    $('#kindSeg').onclick = e => { const b = e.target.closest('button'); if (b) App.set({lim: App.PRESETS[b.dataset.v]}, 'panel'); };
    ['len', 'sun', 'earth', 'night'].forEach(k => $('#' + k).oninput = e => App.set({lim: {[k]: +e.target.value}}, 'panel'));
    $('#relay').onchange = e => App.set({lim: {relay: e.target.checked}}, 'panel');
    $('#mast').onclick = e => { const b = e.target.closest('button'); if (b) App.set({mast: b.dataset.v}, 'panel'); };
    $('#psrf').onclick = e => { const b = e.target.closest('button'); if (b) App.set({psr: +b.dataset.v}, 'panel'); };
    $('#siteList').onclick = e => { if (e.target.closest('#gPlan')){ App.set({view: 'region'}, 'panel'); return; }
      if (e.target.closest('.rx')) return;   // clicks inside the open details (i, text) do not reselect
      const c = e.target.closest('.srow'); if (c && +c.dataset.i !== App.state.site) App.set({site: +c.dataset.i, selDay: -1}, 'panel'); };
    $('#siteList').onkeydown = e => { const c = e.target.closest('.srow'); if (c && e.target === c && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); App.set({site: +c.dataset.i, selDay: -1}, 'panel'); } };
    $('#gMastSeg').onclick = e => { const b = e.target.closest('button'); if (b) App.set({mast: b.dataset.v}, 'panel'); };
    root.querySelectorAll('.spotf').forEach(f => { f.querySelector('.sAdd').onclick = () => addSpot(f); f.querySelector('.sDel').onclick = () => { App.clearSpot(); f.querySelector('.sMsg').textContent = 'Removed.'; };
      f.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') addSpot(f); }); });
    $('#closeP').onclick =() => App.set({panelOpen: false}, 'panel');
    App.on(render); App.on(keys => { if (keys.has('theme')) setTimeout(() => { if (App.state.view === 'ground') ahead(); }, 0); });   // canvas strip reads tokens after shell flips data-theme
    render();
  });
})();
