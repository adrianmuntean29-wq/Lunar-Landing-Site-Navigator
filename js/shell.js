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
  function missionUrl(){
    const st = App.state, s = App.sites[st.site], lim = st.lim, q = [];
    if (s && !s.custom){
      q.push('site=' + encodeURIComponent(s.short), 'land=' + App.iso(st.jd0 + Math.max(st.selDay, 0)).slice(0, 10));
    }
    q.push('type=robotic', 'len=' + lim.len, 'sun=' + lim.sun, 'earth=' + lim.earth, 'night=' + lim.night,
           'mast=' + st.mast, 'relay=' + (lim.relay ? 1 : 0));
    return 'mission.html?' + q.join('&');
  }
  function missions(open){
    if (!mPanel) return;
    if (open){ const u = missionUrl(); if (mFrame.getAttribute('src') !== u) mFrame.setAttribute('src', u); }
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
  }
  $('#panelBtn').onclick =() => App.set({panelOpen: !App.state.panelOpen}, 'shell');
  App.ready.then(() => { top(); theme(); });
})();
