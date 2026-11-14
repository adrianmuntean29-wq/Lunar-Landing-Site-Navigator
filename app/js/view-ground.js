/* view-ground.js: Ground Level view ('ground'). OWNER: view-ground session. Registers with scene-core.js.
   Stand at the site: real Sun and Earth (true size, position, Earth phase) over the site's exact 360-bin mask horizon. */
import * as THREE from 'three';
import {$, D2R, renderer, view, cams, glowTex, register} from './scene-core.js';

let markGroup = null, markKey = '', marks = [];   // other missions + permanent-shadow directions
let sky, skyCam, sunCore, sunGlow, earthBall, skyLight, horizonMesh, ridgeLine, sunGhost, earthGhost, look = {yaw: 0, pitch: 2, fov: 40};
const OPEN_FOV = 16;   // opening zoom: ~27 px per degree on a 430 px pane, so a 1-3 deg gap between Sun and ridge is visible (true scale, no exaggeration)
const DSKY = 1000;
const dirv = (az, el) => new THREE.Vector3(Math.cos(el*D2R)*Math.sin(az*D2R), Math.sin(el*D2R), -Math.cos(el*D2R)*Math.cos(az*D2R));

function buildSky(){
  sky = new THREE.Scene(); sky.background = new THREE.Color('#000000');
  skyCam = new THREE.PerspectiveCamera(look.fov, 1, 0.1, 6000); cams.push(skyCam);
  const N = 3000, a = new Float32Array(N*3);   // decorative star field (not data)
  for (let i = 0; i < N; i++){ const u = Math.random()*2 - 1, t = Math.random()*Math.PI*2, r = Math.sqrt(1 - u*u); a[i*3] = 4000*r*Math.cos(t); a[i*3 + 1] = 4000*u; a[i*3 + 2] = 4000*r*Math.sin(t); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(a, 3));
  sky.add(new THREE.Points(sg, new THREE.PointsMaterial({color: '#8E96A0', size: 1.3, sizeAttenuation: false})));
  sunCore = new THREE.Mesh(new THREE.SphereGeometry(DSKY*Math.tan(0.2666*D2R), 32, 16), new THREE.MeshBasicMaterial({color: '#FFF7E6'})); sky.add(sunCore);
  sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex('rgba(255,240,200,0.9)', 'rgba(255,190,90,0.35)'), depthWrite: false, transparent: true})); sunGlow.scale.set(70, 70, 1); sky.add(sunGlow);
  earthBall = new THREE.Mesh(new THREE.SphereGeometry(DSKY*Math.tan(0.95*D2R), 48, 24), new THREE.MeshStandardMaterial({color: '#3E7CC9', roughness: 0.75, metalness: 0}));
  sky.add(earthBall); sky.add(new THREE.AmbientLight('#ffffff', 0.025));
  skyLight = new THREE.DirectionalLight('#FFFFFF', 3.2); sky.add(skyLight); sky.add(skyLight.target);
  // ghost outline = where a body sits while (part of) it is behind the terrain; drawn over the terrain, same true size as the body
  const ghost = (deg, color) => { const r = DSKY*Math.tan(deg*D2R), m = new THREE.Mesh(new THREE.RingGeometry(r*0.86, r, 64),
    new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false, side: THREE.DoubleSide}));
    m.renderOrder = 10; m.visible = false; sky.add(m); return m; };
  sunGhost = ghost(0.2666, '#FFD27A'); earthGhost = ghost(0.95, '#6FA8E8');
  const cv = renderer.domElement; let drag = null;
  cv.addEventListener('pointerdown', e => { if (view !== 'ground') return; drag = {x: e.clientX, y: e.clientY, yaw: look.yaw, pitch: look.pitch}; });
  addEventListener('pointermove', e => { if (!drag) return; const k = look.fov/cv.clientHeight; look.yaw = drag.yaw - (e.clientX - drag.x)*k; look.pitch = Math.max(-30, Math.min(60, drag.pitch + (e.clientY - drag.y)*k)); });
  addEventListener('pointerup', () => drag = null);
  cv.addEventListener('wheel', e => { if (view !== 'ground') return; e.preventDefault(); look.fov = Math.max(4, Math.min(80, look.fov*Math.exp(e.deltaY*0.001))); }, {passive: false});
  $('#lookSun').onclick = () => lookAt('sun'); $('#lookEarth').onclick = () => lookAt('earth');
}
function buildHorizon(){
  if (horizonMesh){ sky.remove(horizonMesh); horizonMesh.geometry.dispose(); }
  const st = App.state, m = App.mask(App.sites[st.site]), pos = [], col = [], idx = [], STEP = 0.5, n = 360/STEP;
  for (let k = 0; k <= n; k++){
    const az = k*STEP, top = dirv(az, App.profAt(m, az)).multiplyScalar(800), bot = dirv(az, -89).multiplyScalar(800);
    pos.push(top.x, top.y, top.z, bot.x, bot.y, bot.z); col.push(0.16, 0.155, 0.145, 0.02, 0.02, 0.02);
    if (k < n){ const i = k*2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  horizonMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.DoubleSide})); sky.add(horizonMesh);
  horizonMesh.userData.key = st.site + '/' + st.mast;
  // bright ridge line on the terrain edge (same mask values), so "above / below the terrain" reads at a glance
  if (ridgeLine){ sky.remove(ridgeLine); ridgeLine.geometry.dispose(); }
  const rp = []; for (let k = 0; k <= n; k++){ const v = dirv(k*STEP, App.profAt(m, k*STEP)).multiplyScalar(799); rp.push(v.x, v.y, v.z); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  ridgeLine = new THREE.Line(rg, new THREE.LineBasicMaterial({color: '#D8D2C6'})); sky.add(ridgeLine);
}
function updateSky(){
  const st = App.state, s = App.sites[st.site], j = st.jd0 + st.t, p = App.ephAt(j), su = App.azel(s.lat, s.lon, p.sun), ea = App.azel(s.lat, s.lon, p.earth);
  if (!horizonMesh || horizonMesh.userData.key !== st.site + '/' + st.mast) buildHorizon();
  const sd = dirv(su.az, su.el), ed = dirv(ea.az, ea.el);
  sunCore.position.copy(sd).multiplyScalar(DSKY); sunGlow.position.copy(sd).multiplyScalar(DSKY*0.999);
  earthBall.position.copy(ed).multiplyScalar(DSKY);
  skyLight.position.copy(sd).multiplyScalar(DSKY*3); skyLight.target.position.set(0, 0, 0);   // Earth's phase follows the real Sun direction
  skyCam.fov = look.fov; skyCam.position.set(0, 0, 0); skyCam.lookAt(dirv(look.yaw, look.pitch)); skyCam.updateProjectionMatrix();
  // ghosts: Sun when any part of its disc is hidden, Earth when its whole disc is hidden (same rules as core)
  const x = App.stateAt(s, j);
  sunGhost.visible = x.sunLit < 0.999; sunGhost.position.copy(sd).multiplyScalar(DSKY*0.998); sunGhost.lookAt(0, 0, 0);
  earthGhost.visible = !x.earthVis; earthGhost.position.copy(ed).multiplyScalar(DSKY*0.998); earthGhost.lookAt(0, 0, 0);
  // labels: persistent elements, only style updates per frame (no DOM rebuild)
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  place('sun', sd, 'Sun', 22, w, h, true, x.sunLit < 0.5);   // names only (middle stays text-free); hidden = dimmed name + ghost ring
  place('earth', ed, 'Earth', 34, w, h, true, !x.earthVis);
  const m = App.mask(s);
  [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, az]) => place(t, dirv(az, App.profAt(m, az) + 0.3), t, -18, w, h, false));
  const mk = st.site + '/' + st.mast + '/' + JSON.stringify(st.missions || {}); if (mk !== markKey){ markKey = mk; buildMarks(); }
  placeMarks(w, h, [sd, ed]);
}
/* ---------- where other missions and permanent shadow are: DIRECTION indicators on the horizon ----------
   From a 2-10 m mast they are beyond the horizon or inside crater floors, so they are NOT drawn as visible; we only mark which way they lie.
   Missions: Missions.near (same rows + on/off + Chang'e switch as Landing Site), tick on the ridge + short name and distance.
   Permanent shadow: "permanently shadowed (LOLA model)" areas (App.psr; never call them ice, DECISIONS 11) within PSR_KM: teal strip under the ridge. */
const MCOL = '#F2876B', PCOL = '#7FD1C7', MIS_KM = 100, PSR_KM = 20;   // colours = Landing Site legend
const misShort = m => m.id === 'mip' ? 'Ch-1 impact est. 1' : m.id === 'mip_alt' ? 'Ch-1 impact est. 2' : m.name.replace(/ \(.*\)$/, '').replace(/ Endurance$/, '');
function bearing(lat1, lon1, lat2, lon2){   // initial great-circle bearing, deg clockwise from north (display direction only)
  const p1 = lat1*D2R, p2 = lat2*D2R, dl = (lon2 - lon1)*D2R;
  return (Math.atan2(Math.sin(dl)*Math.cos(p2), Math.cos(p1)*Math.sin(p2) - Math.sin(p1)*Math.cos(p2)*Math.cos(dl))/D2R + 360) % 360; }
function buildMarks(){
  if (markGroup){ sky.remove(markGroup); markGroup.traverse(o => o.geometry && o.geometry.dispose()); }
  markGroup = new THREE.Group(); sky.add(markGroup);
  marks.forEach(k => { k.e.remove(); }); marks = [];
  const st = App.state, s = App.sites[st.site], m = App.mask(s);
  // missions
  if (window.Missions && (st.missions || {}).on !== false){
    const tick = [];
    for (const n of Missions.near(s, {withinKm: MIS_KM})){
      const az = bearing(s.lat, s.lon, n.m.lat, n.m.lon), el = App.profAt(m, az);
      for (const [da, de] of [[-0.25, 0.05], [0.25, 0.05], [0, 0.75]]){ const v = dirv(az + da, el + de).multiplyScalar(796); tick.push(v.x, v.y, v.z); }   // small pin standing on the ridge
      const e = document.createElement('div'); e.className = 'sky card'; e.style.color = MCOL; e.style.font = '500 11px "IBM Plex Mono"';
      e.textContent = misShort(n.m) + ' · ' + (n.km < 10 ? n.km.toFixed(1) : Math.round(n.km)) + ' km' + (n.m.precision === 'region' ? ' · region' : '');
      $('#skylabels').appendChild(e); marks.push({e, dir: dirv(az, el + 0.75), km: n.km});
    }
    if (tick.length){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tick, 3));
      const pin = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color: MCOL, depthTest: false, side: THREE.DoubleSide})); pin.renderOrder = 6; markGroup.add(pin); }
  }
  // permanent shadow: nearest PSR distance per 1 deg bin (outline edges sampled every ~150 m, polar stereographic metres, conformal so bearings hold)
  const rho = 2*1737400*Math.tan((90 + s.lat)*D2R/2), sx = rho*Math.sin(s.lon*D2R), sy = rho*Math.cos(s.lon*D2R);
  const N = [Math.sin(s.lon*D2R), Math.cos(s.lon*D2R)], E = [Math.cos(s.lon*D2R), -Math.sin(s.lon*D2R)], near = new Float32Array(360).fill(Infinity), LIM = PSR_KM*1000;
  const hit = (x, y) => { const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy); if (d > LIM) return;
    const k = Math.floor((Math.atan2(dx*E[0] + dy*E[1], dx*N[0] + dy*N[1])/D2R + 360) % 360); if (d < near[k]) near[k] = d; };
  for (const pg of App.psr.polygons) for (const ring of pg.rings){
    if (!ring.some(([x, y]) => Math.hypot(x - sx, y - sy) < LIM + 5000)) continue;
    for (let i = 0; i < ring.length; i++){ const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)/150));
      for (let q = 0; q < n; q++) hit(x0 + (x1 - x0)*q/n, y0 + (y1 - y0)*q/n); }
  }
  const pos = [], col = [], idx = [], c = new THREE.Color(PCOL);
  for (let k = 0; k < 360; k++){ if (!isFinite(near[k])) continue;
    const al = 0.45 + 0.5*(1 - near[k]/LIM), i = pos.length/3;   // closer = stronger
    for (const az of [k, k + 1]){ const hz = App.profAt(m, az), t = dirv(az, hz - 0.1).multiplyScalar(797), bt = dirv(az, hz - 1.1).multiplyScalar(797);
      pos.push(t.x, t.y, t.z, bt.x, bt.y, bt.z); col.push(c.r, c.g, c.b, al, c.r, c.g, c.b, al); }
    idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
  if (idx.length){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
    markGroup.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide}))); markGroup.children[markGroup.children.length - 1].renderOrder = 5; }
}
/* mission names above their ticks; nearest first, a label that would overlap one already placed is hidden (the tick stays) */
function placeMarks(w, h, bodies){
  const used = [];   // Sun and Earth (disc + name) block mission names, so names never cover a body
  for (const d of bodies){ const q = d.clone().multiplyScalar(DSKY).project(skyCam); if (q.z <= 1) used.push({x: (q.x*0.5 + 0.5)*w, y: (-q.y*0.5 + 0.5)*h + 10, hw: 34}); }
  for (const k of marks){
    const q = k.dir.clone().multiplyScalar(DSKY).project(skyCam), x = (q.x*0.5 + 0.5)*w, y = (-q.y*0.5 + 0.5)*h - 14, hw = k.e.textContent.length*3.4 + 4;
    const ok = q.z <= 1 && Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1 && !used.some(u => Math.abs(u.y - y) < (u.hw === 34 ? 30 : 14) && Math.abs(u.x - x) < u.hw + hw);
    k.e.style.display = ok ? '' : 'none'; if (!ok) continue;
    k.e.style.left = x + 'px'; k.e.style.top = y + 'px'; used.push({x, y, hw});
  }
}
/* one persistent label per key; bodies off screen get an arrow at the screen edge pointing to them */
const LAB = {}, EDGE = 26;
function labEl(key){
  if (LAB[key]) return LAB[key];
  const e = document.createElement('div'), body = key === 'sun' || key === 'earth';
  e.className = 'sky ' + (body ? key : 'card'); $('#skylabels').appendChild(e);
  const a = document.createElement('div'); a.className = 'sky ' + (body ? key : 'card'); a.textContent = '▲';
  a.style.transform = 'translate(-50%,-50%)'; a.style.font = '600 14px "IBM Plex Mono"'; a.style.display = 'none';
  if (body) $('#skylabels').appendChild(a);
  return LAB[key] = {e, a, txt: '', vis: null};
}
function place(key, dir, txt, dy, w, h, arrow, hidden){
  const L = labEl(key), q = dir.clone().multiplyScalar(DSKY).project(skyCam);
  const behind = q.z > 1, on = !behind && Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1;
  if (L.txt !== txt){ L.txt = txt; L.e.textContent = txt; } L.e.style.opacity = hidden ? '0.6' : '';
  if (on){ L.e.style.display = ''; L.e.style.transform = 'translate(-50%,0)'; L.e.style.left = (q.x*0.5 + 0.5)*w + 'px'; L.e.style.top = (-q.y*0.5 + 0.5)*h + dy + 'px'; L.a.style.display = 'none'; return; }
  if (!arrow){ L.e.style.display = 'none'; return; }
  // direction on screen from the centre (behind the camera: mirrored), clamped to a frame EDGE px inside the canvas
  let dx = q.x*w/2, dy2 = -q.y*h/2; if (behind){ dx = -dx; dy2 = -dy2; }
  if (!dx && !dy2) dy2 = 1;
  const t = Math.min((w/2 - EDGE)/Math.abs(dx || 1e-9), (h/2 - EDGE)/Math.abs(dy2 || 1e-9)), px = w/2 + dx*t, py = h/2 + dy2*t, ang = Math.atan2(dy2, dx)/D2R + 90;
  L.a.style.display = ''; L.a.style.left = px + 'px'; L.a.style.top = py + 'px'; L.a.style.transform = 'translate(-50%,-50%) rotate(' + ang + 'deg)';
  // short name next to the arrow (the arrow already says "off screen"), pushed inward by its own half width so it never overlaps the arrow or leaves the canvas
  const nm = txt; const hw = nm.length*3.8 + 6, n = Math.hypot(dx, dy2);
  L.e.style.display = ''; L.e.style.transform = 'translate(-50%,-50%)';
  L.e.style.left = Math.max(hw + 4, Math.min(w - hw - 4, px - dx/n*(hw + 14))) + 'px'; L.e.style.top = Math.max(10, Math.min(h - 10, py - dy2/n*18)) + 'px';
}
/* face the Sun, centred between the Sun and the terrain under it, zoomed so degrees near the horizon are readable */
function aim(){ const st = App.state, s = App.sites[st.site], su = App.azel(s.lat, s.lon, App.ephAt(st.jd0 + st.t).sun), hz = App.profAt(App.mask(s), su.az);
  look.yaw = su.az; look.pitch = Math.max(-25, Math.min(55, (su.el + hz)/2)); look.fov = OPEN_FOV; }
function lookAt(body){ const st = App.state, s = App.sites[st.site], p = App.ephAt(st.jd0 + st.t), b = App.azel(s.lat, s.lon, body === 'sun' ? p.sun : p.earth); look.yaw = b.az; look.pitch = b.el; look.fov = 12; }

register('ground', {
  build: buildSky,
  show(on){ $('#sitebar').hidden = !on; $('#skylabels').hidden = !on;
    if (on) aim(); },   // entering: face the Sun, zoomed on the horizon
  frame(){ updateSky(); renderer.render(sky, skyCam); },
  onState(keys){ if (keys.has('site') && view === 'ground') aim(); },   // new site: face its Sun again
});
