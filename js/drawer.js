/* drawer.js: OWNER "bottom panel" chat. Fills #drawer only: everything about TIME, for the site picked elsewhere.
   Time row (always visible): play, speed, clock, Sun/Earth now, period (first landing date + span).
   Tabs (Eren, 2026-11-14): CALENDAR (year at a glance, layer levers), YOUR MISSION (the chosen landing, hour by hour),
   LAUNCH SLIP (what if we are 0-30 days late), NEXT EVENTS (next sunset/sunrise/Earthset/Earthrise from the clock).
   Layout rule (Eren): clickable things on top, the picture in the middle, text that changes at the bottom.
   Reads App.state; changes it only with App.set. All good-day rules come from core.js (App.wins / App.series). */
(function(){
  const root = document.querySelector('#drawer'), $ = s => root.querySelector(s);
  root.innerHTML = `
    <div class="trow" id="trow"><button class="btn tplay" id="tPlay" type="button">▶ PLAY</button><select class="btn" id="tSpeed" aria-label="Playback speed"><option value="0.25">6 h/s</option><option value="1" selected>1 d/s</option><option value="5">5 d/s</option></select>
      <span><span class="k">TIME</span> <b id="tNow">…</b></span><span class="tsun"><span class="k">SUN</span> <b id="tSunS">…</b></span><span class="tearth"><span class="k">EARTH</span> <b id="tEarthS">…</b></span>
      <span class="period" title="First landing date of the period, and how many years to show">FROM <input class="tokd" id="start" type="date" min="2026-01-01" max="2030-12-31"> SPAN <select class="btn" id="span" aria-label="Span"><option value="1">1 y</option><option value="2">2 y</option><option value="3">3 y</option><option value="5">5 y</option></select></span></div>
    <div class="tabs dtabs" role="tablist" id="dtabs"><button role="tab" data-d="price" aria-selected="true">CALENDAR</button><button role="tab" data-d="ms" aria-selected="false">YOUR MISSION</button><button role="tab" data-d="slip" aria-selected="false">LAUNCH SLIP</button><button role="tab" data-d="nx" aria-selected="false">NEXT EVENTS</button><span class="ctl" data-for="price"><span class="seg" id="cMode"><button type="button" data-c="all">ALL</button><button type="button" data-c="sun">SUN</button><button type="button" data-c="earth">EARTH</button><button type="button" data-c="mis">MISSIONS</button></span></span><span class="sp"></span><span class="ctl" data-for="price"><span class="yp"><button class="pnav" data-n="-12" aria-label="Earlier year">‹</button><b id="ylab"></b><button class="pnav" data-n="12" aria-label="Later year">›</button></span></span>
      <button class="btn" id="hide" type="button">HIDE</button></div>
    <div class="dbody" id="dbody">
      <div data-pane="price"><div class="cal" id="pcal"><p class="hist" id="hist" hidden></p><div class="yg" id="yg"></div><div class="cbot"><div class="b1"><b class="site" data-site></b><span class="cleg" id="cleg"></span><small class="mlab" id="mlab"></small></div><p class="caldet" data-det>Point at a day to see your mission on the calendar; click to choose it.</p></div></div></div>
      <div data-pane="ms" hidden><div class="cal"><canvas id="msc"></canvas><div class="cbot"><div class="b1" id="msSum"></div><p class="caldet" id="msDet">Drag across the lanes to move the clock through your mission.</p></div></div></div>
      <div data-pane="slip" hidden><div class="cal"><div class="sl" id="slip"></div><div class="cbot"><div class="b1" id="slSum"></div><p class="caldet" id="slDet">Point at a box to see that landing day; click to choose it.</p></div></div></div>
      <div data-pane="nx" hidden><div class="cal"><div class="nx" id="nx"></div><div class="cbot"><div class="b1" id="nxSum"></div><p class="caldet">Counted from the clock above (hourly steps, real terrain horizon). Press PLAY to watch them count down; click a card to jump there.</p></div></div></div>
    </div>`;

  /* other missions (missions.js, owned by the missions chat): extra reasons shown on days; they do not change core's good-day rules */
  const MWORD = {keepout: "too close to another mission's hardware", coordinate: 'another mission plans to land nearby then: coordinate'};
  const S = () => App.state;
  const mFail = (i, d) => (window.Missions && (S().missions || {}).on) ? Missions.dayFail(i, d) : [];
  const view = {tab: 'price', pcM: 0, on: {sun: true, earth: true, mis: true}};
  const pick = d => App.set({selDay: d, t: d}, 'drawer');
  const mText = (i, d) => mFail(i, d).map(f => ' · <span class="mw">⚑ ' + MWORD[f] + '</span>').join('');
  const pc = (v, lim) => (Math.round(v) >= lim && v < lim ? v.toFixed(1) : v.toFixed(0)) + '%';   // 49.6 vs 50 shows "49.6%", never "50% (need 50%)"
  const why = (o) => o.fail.map(f => f === 'sun' ? 'sunlight ' + pc(o.sun, S().lim.sun) + ' (need ' + S().lim.sun + '%)' : f === 'earth' ? 'Earth contact ' + pc(o.earth, S().lim.earth) + ' (need ' + S().lim.earth + '%)' : 'darkness ' + o.night + ' h (allow ' + S().lim.night + ' h)').join(', ');
  const sentence = o => '<b>' + App.dayDate(o.d) + '</b>: ' + (o.fail.length ? '<span class="no">not good</span> · ' + why(o)
                   : '<span class="ok">good day to land</span> · sunlight ' + o.sun.toFixed(0) + '%, Earth ' + o.earth.toFixed(0) + '%, darkness ' + o.night + ' h');
  const siteName = () => { const s = App.sites[S().site]; return s.custom ? s.name + ' (' + s.label + ')' : s.name; };   // custom spot: always say it is approximate
  const dt = jd => App.date(jd + 1e-6).toLocaleString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'}) + ' UTC';
  /* the landing day the mission/slip tabs talk about: the chosen one, else the next good day from the clock */
  function chosen(){
    const st = S(), w = App.wins(st.site);
    if (st.selDay >= 0 && w[st.selDay]) return {d: st.selDay, auto: false};
    for (let d = Math.max(0, Math.floor(st.t)); d < w.length; d++) if (!w[d].fail.length) return {d, auto: true};
    for (let d = 0; d < w.length; d++) if (!w[d].fail.length) return {d, auto: true};
    return null;
  }
  const autoNote = c => c.auto ? ' <span class="mut">(no day chosen yet: showing the next good day; choose one in the Calendar)</span>' : '';

  /* ---------- CALENDAR: year at a glance, with layer levers ----------
     12 rows = 12 months, 31 columns = day of month. SUN / EARTH / MISSIONS are independent on/off levers; ALL turns all on (or all off).
       SUN on    yellow = enough sunlight AND darkness within your limit (core's 'sun' and 'night' checks pass)
       EARTH on  blue   = enough Earth contact (core's 'earth' check passes; relay on = always)
       both on   cell split corner to corner: top-left yellow, bottom-right blue; both coloured = good day to land
       MISSIONS  dot in the map's mission colour = another mission nearby (Missions.dayFail), drawn on top
     Hover any day: outlines the days your mission would be on the surface. Click: choose it. */
  // theme tokens (14 Nov): HTML/SVG cells take var() strings and follow the theme on their own; canvases read the computed value via tok()
  const COL = {sun: 'var(--cell-sun)', earth: 'var(--cell-earth)', off: 'var(--cell-off)', mis: 'var(--mis)'};   // project palette (base.css, 20:20): calm fills for cells
  const tok = n => getComputedStyle(root).getPropertyValue(n).trim();
  /* split cell: an SVG diagonal (smooth edge; the old CSS gradient stair-stepped on the 28x16 px cells, Eren chose draft D 14 Nov) */
  const TRI = '<svg class="tri" viewBox="0 0 28 16" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,0 28,0 0,16" fill="var(--a)"/><polygon points="28,0 28,16 0,16" fill="var(--b)"/><line x1="28" y1="0" x2="0" y2="16" stroke="var(--panel)" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>';
  function legend(){
    const on = view.on, lim = S().lim, p = [];
    if (on.sun && on.earth) p.push('<span class="sw3" style="--a:' + COL.sun + ';--b:' + COL.earth + '">' + TRI + '</span><span>top: sunlight · bottom: Earth contact · both coloured = good day to land</span>');
    else if (on.sun) p.push('<span class="sw2" style="background:' + COL.sun + '"></span><span>sunlight at least ' + lim.sun + '% and darkness at most ' + lim.night + ' h</span>');
    else if (on.earth) p.push(lim.relay ? '<span>relay satellite on: Earth contact not needed</span>' : '<span class="sw2" style="background:' + COL.earth + '"></span><span>Earth contact at least ' + lim.earth + '%</span>');
    if (on.mis) p.push((S().missions || {}).on ? '<span class="mdot"></span><span>another mission nearby</span>' : '<span class="mut">other-missions layer is off (map controls)</span>');
    if (!p.length) p.push('<span class="mut">all layers off: turn on SUN, EARTH or MISSIONS above</span>');
    p.push('<span class="nowsw"></span><span>today (the clock)</span>');
    return p.join('<span class="mut">·</span>');
  }
  function head(){ const on = view.on; return on.sun && on.earth ? 'good days' : on.sun ? 'sunlit days' : on.earth ? 'Earth days' : on.mis ? 'days flagged' : ''; }
  /* [counts for the right column, inline style, extra class]; levers decide which halves show */
  function cellStyle(o, on){
    on = on || view.on;
    const sOk = !o.fail.includes('sun') && !o.fail.includes('night'), eOk = !o.fail.includes('earth');
    if (on.sun && on.earth) return [sOk && eOk, '--a:' + (sOk ? COL.sun : COL.off) + ';--b:' + (eOk ? COL.earth : COL.off), ''];
    if (on.sun) return [sOk, '--a:' + (sOk ? COL.sun : COL.off), ' one'];
    if (on.earth) return [eOk, '--a:' + (eOk ? COL.earth : COL.off), ' one'];
    return [false, '--a:' + COL.off, ' one'];
  }
  function priceCal(){
    const st = S(), w = App.wins(st.site), d0 = App.date(st.jd0), months = Math.ceil(st.days/30.44), onlyMis = view.on.mis && !view.on.sun && !view.on.earth;
    view.pcM = Math.max(0, Math.min(Math.max(0, months - 12), view.pcM)); view.anyM = false;
    let h = '<span></span><div class="yd">' + Array.from({length: 31}, (_, k) => '<span>' + ((k + 1) % 5 === 0 || k === 0 ? k + 1 : '') + '</span>').join('') + '</div><span class="yc">' + head() + '</span>';
    for (let r = 0; r < 12; r++){ const k = view.pcM + r, Y = d0.getUTCFullYear() + Math.floor((d0.getUTCMonth() + k)/12), M = (d0.getUTCMonth() + k) % 12;
      const nd = new Date(Date.UTC(Y, M + 1, 0)).getUTCDate(); let cs = '', n = 0, any = false;
      for (let dd = 1; dd <= 31; dd++){ const di = dd > nd ? -1 : Math.round(App.jd(new Date(Date.UTC(Y, M, dd))) - st.jd0), o = di >= 0 ? w[di] : null;
        if (!o){ cs += '<span class="pd e"></span>'; continue; } any = true;
        const mf = view.on.mis ? mFail(st.site, di) : [], cs2 = cellStyle(o);
        if (mf.length) view.anyM = true; if (onlyMis ? mf.length : cs2[0]) n++;
        cs += '<span class="pd' + cs2[2] + (di === st.selDay ? ' sel' : '') + '" data-d="' + di + '" style="' + cs2[1] + '">' + (cs2[2] ? '' : TRI) + (mf.length ? '<i></i>' : '') + '</span>'; }
      h += '<span class="ym">' + new Date(Date.UTC(Y, M, 1)).toLocaleString('en', {month: 'short', timeZone: 'UTC'}) + (M === 0 || r === 0 ? ' <i>' + Y + '</i>' : '') + '</span><div class="yd">' + cs + '</div><span class="yc">' + (any && head() ? '<b>' + n + '</b>' : '') + '</span>'; }
    $('#yg').innerHTML = h; view.nowD = null; nowMark();
    const kind = App.sites[st.site].kind || '', hist = /^historic/.test(kind);   // coordinator 14 Nov: historic targets are for comparison only
    $('#hist').hidden = !hist; $('#pcal').classList.toggle('hasHist', hist); $('#hist').textContent = hist ? "Historic target, for comparison: landing here now would be inside IM-2's own keep-out." : '';
    const yb = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + view.pcM + 11, 1)), ys = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + view.pcM, 1));
    const fm = x => x.toLocaleString('en', {month: 'short', year: 'numeric', timeZone: 'UTC'}); $('#ylab').textContent = ys.getUTCMonth() === 0 ? String(ys.getUTCFullYear()) : fm(ys) + ' to ' + fm(yb);
    root.querySelectorAll('#dtabs .yp .pnav').forEach(b => b.style.visibility = (+b.dataset.n < 0 ? view.pcM > 0 : view.pcM + 12 < months) ? 'visible' : 'hidden');
    const allOn = view.on.sun && view.on.earth && view.on.mis; root.querySelectorAll('#cMode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === 'all' ? allOn : !!view.on[b.dataset.c]));
    $('#cleg').innerHTML = legend();
    $('#mlab').textContent = $('#mlab').title = view.anyM && window.Missions ? Missions.LABEL : '';
  }
  function spanAt(d){ root.querySelectorAll('#yg .sp').forEach(x => x.classList.remove('sp')); if (d == null) return;
    for (let k = d; k < d + S().lim.len; k++){ const x = root.querySelector('#yg .pd[data-d="' + k + '"]'); if (x) x.classList.add('sp'); } }

  /* ---------- YOUR MISSION: the chosen landing, hour by hour ----------
     Two lanes over the mission's hours: sunlight (Sun centre above the terrain = same test as core's darkness) and Earth contact.
     The longest dark spell is bracketed and labelled. White line = the clock; drag to move it. */
  const MSG = {l: 120, r: 14, t: 26, lh: 30, gap: 14};
  function mission(){
    const cv = $('#msc'); if (!cv.clientWidth) return;
    const st = S(), c = chosen(), dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; cv.width = W*dpr; cv.height = H*dpr;
    const x = cv.getContext('2d'); x.scale(dpr, dpr); x.clearRect(0, 0, W, H);
    if (!c){ $('#msSum').innerHTML = '<b class="site">' + siteName() + ':</b> <span class="mut">no good landing day in this period with your limits.</span>'; return; }
    const o = App.wins(st.site)[c.d], z = App.series(st.site), len = st.lim.len, h0 = c.d*24, HH = len*24, pw = W - MSG.l - MSG.r, X = h => MSG.l + h/HH*pw;
    MSG.lh = Math.max(20, Math.floor((H - MSG.t - MSG.gap - 22)/2));   // lanes fill the height the drawer gives
    view.ms = {d: c.d, h0, HH, pw};
    let run = 0, best = 0, bestEnd = -1;
    for (let h = 0; h < HH; h++){ if (z.sun[h0 + h] < 0.5){ run++; if (run > best){ best = run; bestEnd = h; } } else run = 0; }
    const lanes = [['Sunlight', [tok('--sun'), tok('--cell-sun')], h => z.sun[h0 + h] >= 0.5, o.sun], ['Earth contact', [tok('--earth'), tok('--cell-earth')], h => !!z.earth[h0 + h], o.earth]];
    x.textBaseline = 'middle';
    lanes.forEach(([name, col, on, pct], i) => { const y = MSG.t + i*(MSG.lh + MSG.gap);
      x.fillStyle = tok('--ink'); x.font = '500 12px "IBM Plex Sans"'; x.fillText(name, 0, y + MSG.lh/2 - 7);
      x.fillStyle = col[0]; x.font = '600 13px "IBM Plex Mono"'; x.fillText(pct.toFixed(0) + '%', 0, y + MSG.lh/2 + 8);
      x.fillStyle = tok('--lane'); x.fillRect(MSG.l, y, pw, MSG.lh); x.fillStyle = col[1];   // text in --sun/--earth, lane fill in the calm cell colour
      let a = -1; for (let h = 0; h <= HH; h++){ const v = h < HH && on(h); if (v && a < 0) a = h; if (!v && a >= 0){ x.fillRect(X(a), y, Math.max(1, X(h) - X(a)), MSG.lh); a = -1; } } });
    const yB = MSG.t + 2*MSG.lh + MSG.gap;
    // day grid + dates
    x.font = '500 10px "IBM Plex Mono"'; x.textBaseline = 'top';
    for (let k = 0; k <= len; k++){ const xx = X(k*24); x.fillStyle = tok('--grid'); x.fillRect(xx, MSG.t, 1, yB - MSG.t);
      if (k < len && (len <= 20 || k % 2 === 0)){ x.fillStyle = tok('--muted'); x.fillText(App.date(st.jd0 + c.d + k).toLocaleString('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'}), xx + 3, yB + 4); } }
    // longest darkness bracket over the sunlight lane
    x.textBaseline = 'bottom'; x.font = '600 11px "IBM Plex Sans"';
    if (best > 0){ const a = X(bestEnd - best + 1), b = X(bestEnd + 1), yy = MSG.t - 6;
      x.strokeStyle = tok('--ink'); x.lineWidth = 1; x.beginPath(); x.moveTo(a, yy + 4); x.lineTo(a, yy); x.lineTo(b, yy); x.lineTo(b, yy + 4); x.stroke();
      const lab = 'longest darkness ' + best + ' h', tw = x.measureText(lab).width; x.fillStyle = tok('--ink'); x.fillText(lab, Math.min(Math.max(MSG.l, (a + b)/2 - tw/2), MSG.l + pw - tw), yy - 2); }
    else { x.fillStyle = tok('--muted'); x.fillText('no darkness during this mission', MSG.l, MSG.t - 6); }
    // clock
    const th = st.t*24 - h0; if (th >= 0 && th <= HH){ const cx = X(th); x.fillStyle = tok('--ink'); x.fillRect(cx - 1, MSG.t - 3, 2, yB - MSG.t + 6); }
    $('#msSum').innerHTML = '<b class="site">' + siteName() + ':</b> land ' + sentence(o) + mText(st.site, c.d) + autoNote(c);
    msReadout(th >= 0 && th <= HH ? th : null);
  }
  function msReadout(th){
    const st = S(), m = view.ms; if (!m) return;
    if (th == null){ $('#msDet').innerHTML = 'The clock is outside this mission. Drag across the lanes (or press PLAY after choosing the day) to move through it.'; return; }
    const z = App.series(st.site), h = Math.min(m.HH - 1, Math.max(0, Math.floor(th))), day = Math.floor(h/24) + 1;
    $('#msDet').innerHTML = '<b>Day ' + day + ' of ' + st.lim.len + '</b>, ' + dt(st.jd0 + (m.h0 + h)/24) + ': ' + (z.sun[m.h0 + h] >= 0.5 ? '<span class="tsunc">Sun up</span>' : '<span class="mut">Sun behind terrain</span>') + ', ' + (z.earth[m.h0 + h] ? '<span class="tearc">Earth in view</span>' : '<span class="mut">no Earth contact</span>');
  }

  /* ---------- LAUNCH SLIP: what if the landing moves 0-30 days later ---------- */
  const SLIPN = 31;
  function slip(){
    const st = S(), c = chosen(), w = App.wins(st.site), all = {sun: true, earth: true};
    if (!c){ $('#slip').innerHTML = ''; $('#slSum').innerHTML = '<b class="site">' + siteName() + ':</b> <span class="mut">no good landing day in this period with your limits.</span>'; return; }
    let h = '';
    for (let k = 0; k < SLIPN; k++){ const d = c.d + k, o = w[d];
      if (!o){ h += '<span class="sb e"><b>+' + k + '</b><small>outside period</small></span>'; continue; }
      const cs = cellStyle(o, all), mf = mFail(st.site, d);
      h += '<span class="sb' + (k === 0 ? ' sel' : '') + '" data-d="' + d + '"><span class="pd' + cs[2] + '" style="' + cs[1] + '">' + (cs[2] ? '' : TRI) + (mf.length ? '<i></i>' : '') + '</span><b>' + (k ? '+' + k : '0') + '</b><small>' + (k % 5 === 0 ? App.date(st.jd0 + d).toLocaleString('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'}) : '&nbsp;') + '</small></span>'; }
    $('#slip').innerHTML = h;
    // summary: how long the window holds, first bad day, next good day after it
    const ok = d => w[d] && !w[d].fail.length;
    let s = '<b class="site">' + siteName() + ':</b> ';
    if (ok(c.d)){ let k = 0; while (k + 1 < SLIPN && ok(c.d + k + 1)) k++;
      s += App.dayDate(c.d).replace(/ \d{4}$/, '') + ' still works with up to <b class="okb">' + k + ' day' + (k === 1 ? '' : 's') + ' of delay</b>';
      const bad = c.d + k + 1;
      if (w[bad]){ s += '. ' + (k + 1) + ' days late: <span class="no">fails</span> (' + why(w[bad]) + ')'; let n = bad; while (w[n] && !ok(n)) n++;
        s += w[n] ? '. Next good day: <b>+' + (n - c.d) + ' days</b> (' + App.dayDate(n).replace(/ \d{4}$/, '') + ')' : '. No other good day before the period ends.'; }
      else s += ' (to the end of the period).';
    } else s += App.dayDate(c.d) + ' is not a good day (' + why(w[c.d]) + ').';
    $('#slSum').innerHTML = s + autoNote(c);
  }

  /* ---------- NEXT EVENTS: next sunset / sunrise / Earthset / Earthrise from the clock ---------- */
  function events(){
    const st = S(), z = App.series(st.site), n = z.sun.length, h0 = Math.floor(st.t*24), out = [];
    for (const [body, on, up, down] of [['sun', h => z.sun[h] >= 0.5, 'SUNRISE', 'SUNSET'], ['earth', h => !!z.earth[h], 'EARTHRISE', 'EARTHSET']]){
      let cur = on(Math.min(n - 1, h0)), found = 0;
      for (let h = h0 + 1; h < n && found < 4; h++){ const v = on(h); if (v !== cur){ out.push({body, h, name: v ? up : down, rising: v}); cur = v; found++; } } }
    out.sort((a, b) => a.h - b.h);
    // how long each state lasts = time to the next event of the same body
    out.forEach(e => { const nx = out.find(f => f.body === e.body && f.h > e.h); e.lasts = nx ? nx.h - e.h : null; });
    const show = out.slice(0, 6);
    $('#nx').innerHTML = show.length ? show.map(e => { const dh = e.h - st.t*24;
      return '<button type="button" class="ev ' + e.body + (e.rising ? ' up' : ' down') + '" data-h="' + e.h + '"><span class="en">' + (e.body === 'sun' ? '☀' : '⊕') + ' ' + e.name + '</span><b>' + App.plainH(dh) + '</b><small>' + dt(st.jd0 + e.h/24) + '</small><small class="el">' +
        (e.lasts == null ? '' : (e.body === 'sun' ? (e.rising ? 'sunlit for ' : 'dark for ') : (e.rising ? 'in contact for ' : 'no contact for ')) + App.plainH(e.lasts).replace(/^in /, '')) + '</small></button>'; }).join('')
      : '<p class="mut">No Sun or Earth change in the next 60 days at this site.</p>';
    const x = App.stateAt(App.sites[st.site], st.jd0 + st.t);
    $('#nxSum').innerHTML = '<b class="site">' + siteName() + ':</b> now ' + (x.sunLit >= 0.5 ? '<span class="tsunc">Sun up</span>' : '<span class="mut">Sun behind terrain</span>') + ', ' + (x.earthVis ? '<span class="tearc">Earth in view</span>' : '<span class="mut">Earth below the horizon</span>') + ' · ' + dt(st.jd0 + st.t);
  }

  /* ---------- time row: clock, play, speed, Sun/Earth now, period ---------- */
  function clock(){
    const st = S(), jd = st.jd0 + st.t, x = App.stateAt(App.sites[st.site], jd);
    $('#tNow').textContent = App.iso(jd) + ' UTC';
    const su = $('#tSunS'), ea = $('#tEarthS');
    su.textContent = x.sunLit >= 0.5 ? 'UP' : 'BEHIND TERRAIN'; su.title = 'Sun ' + x.su.el.toFixed(2) + '° high, terrain ' + x.sunHz.toFixed(2) + '° (azimuth ' + x.su.az.toFixed(0) + '°)';
    ea.textContent = x.earthVis ? 'IN VIEW' : 'BELOW HORIZON'; ea.title = 'Earth ' + x.ea.el.toFixed(2) + '° high, terrain ' + x.earthHz.toFixed(2) + '° (azimuth ' + x.ea.az.toFixed(0) + '°)';
    $('#tPlay').textContent = st.playing ? '❚❚ PAUSE' : '▶ PLAY'; $('#tPlay').classList.toggle('on', st.playing);
    $('#tSpeed').value = String(st.speed);
    nowMark();
  }
  /* Today marker (Eren via New Frontend, 14 Nov): the clock's day (App.state.t) gets a magenta bar on its calendar cell and its
     month name turns magenta. Separate from the selected-day outline, so both show on one cell. Runs from clock(), also while playing. */
  function nowMark(){
    const d = Math.floor(S().t); if (d === view.nowD) return; view.nowD = d;
    root.querySelectorAll('#yg .now').forEach(x => x.classList.remove('now'));
    const c = root.querySelector('#yg .pd[data-d="' + d + '"]'); if (!c) return;
    c.classList.add('now'); const m = c.parentElement.previousElementSibling; if (m) m.classList.add('now');
    c.title = 'Today on the clock: ' + App.dayDate(d);
  }
  function period(){ const st = S(); $('#start').value = App.date(st.jd0).toISOString().slice(0, 10); $('#span').value = String(Math.round(st.days/365));
    root.querySelectorAll('[data-site]').forEach(e => e.textContent = siteName() + ':');
    $('#hide').textContent = st.drawerOpen ? 'HIDE' : 'SHOW'; root.classList.toggle('hid', !st.drawerOpen); }
  function ctl(){ root.querySelectorAll('#dtabs .ctl').forEach(e => e.hidden = e.dataset.for !== view.tab); }
  const DRAW = {price: priceCal, ms: mission, slip, nx: events};
  function active(){ DRAW[view.tab](); }

  App.ready.then(() => {
    let lastClock = 0, lastTab = 0;
    App.on((keys, source) => {
      if (source === 'play'){ const now = performance.now();   // only time moved: throttle
        if (now - lastClock > 100){ lastClock = now; clock(); }
        if ((view.tab === 'ms' || view.tab === 'nx') && now - lastTab > 200){ lastTab = now; active(); }
        return; }
      clock(); period(); active();
      if (keys.has('theme')) setTimeout(active, 0); });   // shell flips <html data-theme> in its own listener: redraw canvases after it
    $('#tPlay').onclick = () => App.set({playing: !S().playing}, 'drawer');
    $('#tSpeed').onchange = e => App.set({speed: +e.target.value}, 'drawer');
    $('#dtabs').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; view.tab = b.dataset.d;
      root.querySelectorAll('#dtabs [data-d]').forEach(c => c.setAttribute('aria-selected', c === b));
      root.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== view.tab); ctl(); active(); });
    $('#span').onchange = e => App.set({days: 365*(+e.target.value), t: 0, selDay: -1}, 'drawer');
    $('#start').onchange = e => { const d = new Date(e.target.value + 'T00:00:00Z'); if (!isNaN(d)) App.set({jd0: App.jd(d), t: 0, selDay: -1}, 'drawer'); };
    $('#hide').onclick = () => App.set({drawerOpen: !S().drawerOpen}, 'drawer');
    // calendar
    $('#pcal').addEventListener('click', e => { const c = e.target.closest('.pd[data-d]'); if (c) pick(+c.dataset.d); });
    $('#pcal').addEventListener('mouseover', e => { const c = e.target.closest('.pd[data-d]'); if (!c) return; const d = +c.dataset.d, len = S().lim.len; spanAt(d);
      root.querySelector('[data-pane=price] [data-det]').innerHTML = sentence(App.wins(S().site)[d]) + ' · on the surface ' + len + ' days, until ' + App.dayDate(d + len - 1) + mText(S().site, d); });
    $('#pcal').addEventListener('mouseleave', () => spanAt(null));
    root.querySelectorAll('#dtabs .yp .pnav').forEach(b => b.onclick = () => { view.pcM += +b.dataset.n; priceCal(); });
    $('#cMode').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; const k = b.dataset.c, on = view.on;
      if (k === 'all'){ const all = on.sun && on.earth && on.mis; on.sun = on.earth = on.mis = !all; } else on[k] = !on[k];   // levers: each stays as clicked
      priceCal(); };
    // your mission: drag to move the clock; hover reads out the hour
    const msc = $('#msc'); let drag = false;
    const msH = ev => { const m = view.ms; if (!m) return null; const r = msc.getBoundingClientRect(); return Math.max(0, Math.min(m.HH - 0.01, (ev.clientX - r.left - MSG.l)/m.pw*m.HH)); };
    const msSeek = ev => { const h = msH(ev); if (h != null) App.set({t: (view.ms.h0 + h)/24}, 'drawer'); };
    msc.addEventListener('pointerdown', ev => { drag = true; msc.setPointerCapture(ev.pointerId); msSeek(ev); });
    msc.addEventListener('pointermove', ev => { if (drag) msSeek(ev); else { const h = msH(ev); if (h != null) msReadout(h); } });
    msc.addEventListener('pointerup', () => drag = false);
    // launch slip: choose a later day
    $('#slip').addEventListener('click', e => { const b = e.target.closest('.sb[data-d]'); if (b) pick(+b.dataset.d); });
    $('#slip').addEventListener('mouseover', e => { const b = e.target.closest('.sb[data-d]'); if (b) $('#slDet').innerHTML = sentence(App.wins(S().site)[+b.dataset.d]) + mText(S().site, +b.dataset.d); });
    // next events: jump the clock to an event
    $('#nx').addEventListener('click', e => { const b = e.target.closest('.ev[data-h]'); if (b) App.set({t: +b.dataset.h/24}, 'drawer'); });
    new ResizeObserver(() => active()).observe($('#dbody'));
    ctl(); clock(); period(); active();
  });
})();
