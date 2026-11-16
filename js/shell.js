/* shell.js: OWNER coordinator. The top bar and the page layout (panel open/closed).
   Time, play, speed and the Sun/Earth status are in the bottom panel (drawer.js), not here. */
(function(){
  const $ = s => document.querySelector(s);
  function top(){
    const st = App.state;
    // site chip (Eren 15 Nov): "<short> <name> · mast N m"; Tudor's sites have short = name, a custom spot says so
    const s = App.sites[st.site], chip = $('#siteChip');
    if (chip && s){ const nm = s.custom ? 'Your spot (approximate)' : (s.short && s.short !== s.name ? s.short + ' ' + s.name : s.name);
      chip.textContent = nm + ' · mast ' + st.mast + ' m'; chip.title = 'Selected: ' + nm + ', ' + st.mast + ' m mast. Click to show it in the details panel'; }
    $('#body').classList.toggle('closed', !st.panelOpen);
    const b = $('#panelBtn');
    b.textContent = st.panelOpen ? 'DETAILS ▸' : '◂ DETAILS';
    b.title = st.panelOpen ? 'Hide the details panel' : 'Show the details panel';
    b.setAttribute('aria-expanded', st.panelOpen); b.classList.toggle('on', !st.panelOpen);
  }
  function theme(){
    const light = App.state.theme === 'light', b = $('#themeBtn');
    if (light) document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme;
    // icon button: shows the theme you switch TO (☾ in light, ☀ in dark)
    b.textContent = light ? '☾' : '☀'; const lab = light ? 'Switch to dark theme' : 'Switch to light theme';
    b.setAttribute('aria-label', lab); b.title = lab;
    try { localStorage.setItem('spn-theme', App.state.theme); } catch (e) {}
  }
  $('#themeBtn').onclick = () => App.set({theme: App.state.theme === 'light' ? 'dark' : 'light'}, 'shell');
  App.on((keys, source) => { if (keys.has('panelOpen') || keys.has('mast') || keys.has('site') || keys.has('spot')) top(); if (keys.has('theme')) theme(); });
  { const chip = $('#siteChip'); if (chip) chip.onclick = () => App.set({panelOpen: true}, 'shell'); }
  /* data line + (i) (Eren 15 Nov): dates come from the data files themselves, never typed in */
  function dataLine(){
    const w = $('#dWhen'), tip = $('#dataTip'); if (!w || !tip) return;
    const d = x => x ? new Date(x).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}) : null;
    const a = d(App.eph && App.eph.generated_utc), b = d(App.sitesJson && App.sitesJson.generated_utc);
    w.textContent = ' · precomputed ' + (a && b && a !== b ? a.replace(/ \d{4}$/, '') + ' and ' + b : (a || b || ''));
    tip.innerHTML = '<span><b>Precomputed data files</b> (the page reads them; nothing runs on a server):</span>' +
      '<span><b>Sun and Earth positions</b>: data/subpoints.json, NASA JPL Horizons, 6-hour steps, 2026-2035' + (a ? ', made ' + a : '') + '.</span>' +
      '<span><b>Horizon masks</b>: data/sites.json, from the NASA LOLA south-pole elevation model (PGDA product 90). Named sites use exact masks: 20 m terrain within 10 km, 80 m beyond' + (b ? ', made ' + b : '') + '.</span>' +
      '<span><b>Terrain for the 3D views and your own spot</b>: data/heights.bin, data/cap_heights.bin (coarser LOLA grids; your spot is approximate).</span>' +
      '<span><b>Permanent shadow</b>: data/psr.json (PGDA product 90). <b>Flat, smooth terrain</b>: data/zones.json (team analysis).</span>';
  }
  // Missions button: opens Adrian's mission.html with the current site, landing day and limits (format from the mission-page session).
  // land uses slice(0,10): the full App.iso string would be read as local time. A custom spot opens the page on its defaults.
  // Missions slide-in panel: mission.html in an iframe. The src changes ONLY when the URL changes
  // (a reload restarts the flight and the weather fetch). Closes on the button, Esc, or the page's own ✕ CLOSE (postMessage).
  const missionBtn = $('#missionBtn'), mPanel = $('#missionPanel'), mFrame = $('#missionFrame');   // guard: a cached old index.html lacks them
  // fly (optional, from App.flyMission): {type: 'robotic' | 'crewed', d: landing day} -> adds &td=0, crewed uses App.PRESETS.crew
  function missionUrl(fly){
    // type: the Fly button's choice, else the type chosen in the panel (App.state.kind). Same type as chosen -> the user's own limits;
    // the other type -> that type's preset (bug fix 15 Nov: crew was inferred from the sliders and a 7-day crew reset to 6).
    const st = App.state, s = App.sites[st.site], q = [], kind = st.kind || 'robotic';
    const T = fly ? (fly.type === 'crewed' ? 'crew' : 'robotic') : kind, crew = T === 'crew';
    const lim = T === kind ? st.lim : Object.assign({}, App.PRESETS[T], {relay: st.lim.relay}), d = fly ? fly.d : Math.max(st.selDay, 0);
    if (s && !s.custom){
      q.push('site=' + encodeURIComponent(s.short), 'land=' + App.iso(st.jd0 + d).slice(0, 10));
    }
    q.push('type=' + (crew ? 'crewed' : 'robotic'), 'len=' + lim.len, 'sun=' + lim.sun, 'earth=' + lim.earth, 'night=' + lim.night);
    if (fly) q.push('td=0');
    q.push('mast=' + st.mast, 'relay=' + (lim.relay ? 1 : 0));
    return 'mission.html?' + q.join('&');
  }
  function missions(open, fly){
    if (!mPanel) return;
    // Same URL as last time: no reload, but the page plays the launch again each time the panel opens (Adrian, 16 Nov)
    if (open){
      const u = missionUrl(fly), wasOpen = mPanel.classList.contains('open');
      if (mFrame.getAttribute('src') !== u) mFrame.setAttribute('src', u);
      else if ((fly || !wasOpen) && mFrame.contentWindow) mFrame.contentWindow.postMessage({spn: 'replay-launch'}, location.origin);
    }
    mPanel.classList.toggle('open', open); mPanel.setAttribute('aria-hidden', !open);
    // Planner | Missions switch (Eren 15 Nov): the active page is pressed; Missions keeps today's open/close behaviour
    missionBtn.setAttribute('aria-expanded', open); missionBtn.setAttribute('aria-pressed', open);
    const pl = $('#plannerBtn'); if (pl) pl.setAttribute('aria-pressed', !open);
    if (!open && mPanel.contains(document.activeElement)) (pl || missionBtn).focus();
  }
  if (missionBtn && mPanel){
    missionBtn.onclick = () => missions(!mPanel.classList.contains('open'));
    { const pl = $('#plannerBtn'); if (pl) pl.onclick = () => missions(false); }
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && mPanel.classList.contains('open')) missions(false); });
    window.addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.spn === 'close-missions') missions(false); });
    App.on(keys => { if (keys.has('theme') && mFrame.contentWindow) mFrame.contentWindow.postMessage({spn: 'theme', theme: App.state.theme}, location.origin); });
    /* App.flyMission('robotic' | 'crewed'): Adrian's "Fly it" from the calendar (Eren 15 Nov). Landing day = the selected day,
       else the first day passing the current limits (else day 0). Opens the Missions panel; named sites only. */
    App.flyMission = type => {
      const st = App.state, s = App.sites[st.site]; if (!s || s.custom) return;
      let d = st.selDay; if (d < 0){ const w = App.wins(st.site); d = Math.max(0, w.findIndex(o => !o.fail.length)); }
      missions(true, {type: type === 'crewed' ? 'crewed' : 'robotic', d});
    };
  }
  $('#panelBtn').onclick =() => App.set({panelOpen: !App.state.panelOpen}, 'shell');
  App.ready.then(() => { top(); theme(); dataLine(); });
  /* loading screen (Eren 15 Nov): hide when App.ready has resolved AND view-moon.js says the Moon is ready
     (flag first: 'moon-ready' may already have fired). Hard stop after 20 s, also in CSS, so a WebGL failure never traps the page. */
  const loader = document.getElementById('loader');
  if (loader){
    let gone = false;
    const hide = () => { if (gone) return; gone = true; loader.classList.add('done'); setTimeout(() => { loader.hidden = true; }, 400); };
    const moon = new Promise(res => { if (window.__moonReady) return res(); document.addEventListener('moon-ready', res, {once: true}); });
    Promise.all([App.ready, moon]).then(hide, hide);
    setTimeout(hide, 20000);
  }
})();
