/* shell.js: OWNER coordinator. The top bar and the page layout (panel open/closed).
   Time, play, speed and the Sun/Earth status are in the bottom panel (drawer.js), not here. */
(function(){
  const $ = s => document.querySelector(s);
  function top(){
    const st = App.state;
    $('#tMast').textContent = 'MAST ' + st.mast + ' M';
    $('#body').classList.toggle('closed', !st.panelOpen);
    const b = $('#panelBtn');
    b.textContent = st.panelOpen ? 'DETAILS ▸' : '◂ DETAILS';
    b.title = st.panelOpen ? 'Hide the details panel' : 'Show the details panel';
    b.setAttribute('aria-expanded', st.panelOpen); b.classList.toggle('on', !st.panelOpen);
  }
  function theme(){
    const light = App.state.theme === 'light', b = $('#themeBtn');
    if (light) document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme;
    b.textContent = light ? 'DARK' : 'LIGHT'; b.setAttribute('aria-pressed', light);
    b.title = light ? 'Switch back to the dark theme' : 'Switch to a light theme (better on projectors)';
    try { localStorage.setItem('spn-theme', App.state.theme); } catch (e) {}
  }
  $('#themeBtn').onclick = () => App.set({theme: App.state.theme === 'light' ? 'dark' : 'light'}, 'shell');
  App.on((keys, source) => { if (keys.has('panelOpen') || keys.has('mast')) top(); if (keys.has('theme')) theme(); });
  // Missions button: opens Adrian's mission.html with the current site, landing day and limits (format from the mission-page session).
  // land uses slice(0,10): the full App.iso string would be read as local time. A custom spot opens the page on its defaults.
  // Missions slide-in panel: mission.html in an iframe. The src changes ONLY when the URL changes
  // (a reload restarts the flight and the weather fetch). Closes on the button, Esc, or the page's own ✕ CLOSE (postMessage).
  const missionBtn = $('#missionBtn'), mPanel = $('#missionPanel'), mFrame = $('#missionFrame');   // guard: a cached old index.html lacks them
  // fly (optional, from App.flyMission): {type: 'robotic' | 'crewed', d: landing day} -> adds &td=0, crewed uses App.PRESETS.crew
  function missionUrl(fly){
    const st = App.state, s = App.sites[st.site], q = [], crew = fly && fly.type === 'crewed';
    const lim = crew ? Object.assign({}, App.PRESETS.crew, {relay: st.lim.relay}) : st.lim, d = fly ? fly.d : Math.max(st.selDay, 0);
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
    if (open){ const u = missionUrl(fly); if (mFrame.getAttribute('src') !== u) mFrame.setAttribute('src', u); }
    mPanel.classList.toggle('open', open); mPanel.setAttribute('aria-hidden', !open);
    missionBtn.setAttribute('aria-expanded', open); missionBtn.classList.toggle('on', open);
    missionBtn.textContent = open ? '✕ MISSIONS' : '☰ MISSIONS';
    if (!open && mPanel.contains(document.activeElement)) missionBtn.focus();
  }
  if (missionBtn && mPanel){
    missionBtn.onclick = () => missions(!mPanel.classList.contains('open'));
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
  App.ready.then(() => { top(); theme(); });
})();
