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
  $('#panelBtn').onclick = () => App.set({panelOpen: !App.state.panelOpen}, 'shell');
  App.ready.then(() => { top(); theme(); });
})();
