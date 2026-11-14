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
  App.on((keys, source) => { if (keys.has('panelOpen') || keys.has('mast')) top(); });
  $('#panelBtn').onclick = () => App.set({panelOpen: !App.state.panelOpen}, 'shell');
  App.ready.then(top);
})();
