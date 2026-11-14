/* view-ground.js: Ground Level view ('ground'). OWNER: view-ground session. Registers with scene-core.js.
   Stand at the site: real Sun and Earth (true size, position, Earth phase) over the site's exact 360-bin mask horizon. */
import * as THREE from 'three';
import {$, D2R, renderer, view, cams, glowTex, register} from './scene-core.js';

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
