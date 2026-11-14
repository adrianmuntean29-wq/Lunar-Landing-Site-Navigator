/* view-site.js: Landing Site view ('region'). OWNER: view-site session. Registers with scene-core.js.
   Real LOLA terrain (engine heights.bin, +/-60 km) lit by the real Sun seen from the pole, site pins, PSR outlines, other missions.
   Reads App.state; changes state only with App.set (e.g. clicking a pin selects a site). */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {$, R, D2R, root, renderer, meta, HGT, cams, register} from './scene-core.js';

let scene, camera, controls, sunLight, mesh, psrGroup, ringGroup;

function heightAt(x, z){
  const i = Math.round((x*1000 - meta.x_min)/meta.pixel_m - 0.5), j = Math.round((meta.y_max - (-z)*1000)/meta.pixel_m - 0.5);
  if (i < 0 || j < 0 || i >= meta.nx || j >= meta.ny) return null;
  return mesh.geometry.attributes.position.getY(j*meta.nx + i);
}
// label width from its text (no layout read: reading offsetWidth every frame forced a full-page layout per label)
const estW = (s, cpx) => s.length*cpx + 12;
function siteXZ(s){ const rho = 2*R*Math.tan((90 + s.lat)*D2R/2); return [rho*Math.sin(s.lon*D2R), -rho*Math.cos(s.lon*D2R)]; }

/* ---------- other missions (missions.js): circle of radius_km = position uncertainty, styled by precision ---------- */
let misGroup = null, misIn = [], misOut = [], misGroups = [];
const MCOL = '#F2876B', KOMAT = new THREE.LineBasicMaterial({color: MCOL, transparent: true, opacity: 0.35});
function missionRows(){ const ms = App.state.missions || {}; if (!window.Missions || !Missions.rows || ms.on === false) return [];
  return Missions.rows.filter(m => m.placed && (ms.cn !== false || m.group !== 'cn')); }
function buildMissions(){
  if (misGroup){ scene.remove(misGroup); misGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  misGroup = new THREE.Group(); scene.add(misGroup); misIn = []; misOut = []; labKey = '';
  for (const m of missionRows()){
    const [x, z] = siteXZ(m), y = heightAt(x, z); if (y == null){ misOut.push(m); continue; }
    const r = Math.max(m.radius_km, 0.35), pts = [];   // tiny measured circles get a visible minimum (0.35 km)
    for (let a = 0; a <= 360; a += 4){ const px = x + r*Math.sin(a*D2R), pz = z - r*Math.cos(a*D2R), py = heightAt(px, pz); pts.push(new THREE.Vector3(px, (py == null ? y : py) + 0.25, pz)); }
    const style = m.precision === 'region' ? {dashSize: 0.9, gapSize: 0.6} : m.precision === 'unknown' ? {dashSize: 0.2, gapSize: 0.5} : null;
    const mat = style ? new THREE.LineDashedMaterial(Object.assign({color: MCOL}, style)) : new THREE.LineBasicMaterial({color: MCOL});
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); if (style) ln.computeLineDistances(); misGroup.add(ln);
    if (!m.planned){ const dot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({color: MCOL})); dot.position.set(x, y + 0.3, z); misGroup.add(dot); }   // on the surface = filled
    // keep-out ring: Missions.ruleKm (2.0 km lander / 0.5 km impact, NASA 2011 non-binding; large lander = caution km, our assumption)
    // measured from the edge of the position circle, exactly as missions.js tests "inside" (km <= rule + radius_km)
    const ko = Missions.ruleKm(m, (App.state.missions || {}).caution ?? Missions.DEFAULTS.caution).km + m.radius_km, kp = [];
    for (let a = 0; a <= 360; a += 3){ const px = x + ko*Math.sin(a*D2R), pz = z - ko*Math.cos(a*D2R), py = heightAt(px, pz); kp.push(new THREE.Vector3(px, (py == null ? y : py) + 0.2, pz)); }
    misGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(kp), KOMAT));
    misIn.push({m, x, y, z, ko});
  }
  // groups outside the terrain window: one arrow at the map edge along the group's east longitude (missions chat groups them)
  misGroups = [];
  if (misOut.length && Missions.offMap){
    const ms = App.state.missions || {};
    for (const g of Missions.offMap(60, {cn: ms.cn !== false}).offMap){
      const p = (r) => { const x = r*Math.sin(g.lonE*D2R), z = -r*Math.cos(g.lonE*D2R), y = heightAt(x, z); return new THREE.Vector3(x, (y == null ? 0 : y) + 0.4, z); };
      const short = g.names[0].replace(/ \((?!estimate).*\)$/, '') + (g.names.length > 1 ? ' +' + (g.names.length - 1) : '');   // short on the map; full names in the tooltip
      const line = short + ' · ' + Math.round(g.km) + ' km', tip = g.text + '\n\n' + g.rows.map(misTip).join('\n\n');
      const same = misGroups.find(o => Math.abs(((o.g.lonE - g.lonE + 540) % 360) - 180) < 10);   // same direction (within 10 deg): one arrow, stacked lines
      if (same){ if (same.lines.length < 2) same.lines.push(line); else same.more = (same.more || 0) + g.names.length; same.tip += '\n\n— — —\n\n' + tip; } else misGroups.push({g, a: p(48), b: p(55), lines: [line], tip});
    }
  }
}
function misTip(m){ return [m.name + ' (' + m.agency + ')', m.date_text, 'Status: ' + m.status, 'Position: ' + m.precisionText + (m.placeholder ? ' · placeholder point' : ''), 'Source quality: ' + (m.quality || 'not stated')]
  .concat(m.note ? ['Note: ' + m.note] : []).concat(m.source_url ? ['Source: ' + m.source_url + ' (click to open)'] : []).join('\n'); }

/* ---------- the rest of the cap around the +/-60 km square: LOLA 80 m area-mean to 1.19 km (assets/site_outer_*), out to 300 km ----------
   Same frame and curvature drop as the inner mesh, so the ground bends away toward the horizon (~26 km lower at 300 km).
   The square stays the detailed layer on top (outer pushed back with polygonOffset, its cells inside +/-59 km skipped). Display only. */
const OUTER_KM = 300;
let outer = null;
async function buildOuter(EX){
  try {
    const [om, buf] = await Promise.all([fetch('assets/site_outer_meta.json').then(r => r.json()), fetch('assets/site_outer_heights.bin').then(r => r.arrayBuffer())]);
    const H = new Float32Array(buf), nx = om.nx, ny = om.ny, px = om.pixel_m/1000, pos = new Float32Array(nx*ny*3), idx = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){ const k = j*nx + i, x = om.x_min/1000 + (i + 0.5)*px, z = -(om.y_max/1000 - (j + 0.5)*px);
      let h = H[k]; if (!isFinite(h)) h = 0; pos[k*3] = x; pos[k*3 + 1] = h/1000*EX - (x*x + z*z)/(2*R); pos[k*3 + 2] = z; }
    const inSq = k => Math.abs(pos[k*3]) < 59 && Math.abs(pos[k*3 + 2]) < 59, out = k => Math.hypot(pos[k*3], pos[k*3 + 2]) > OUTER_KM;
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++){ const a = j*nx + i, b = a + 1, c = a + nx, d = c + 1;
      if ((inSq(a) && inSq(b) && inSq(c) && inSq(d)) || out(a) || out(b) || out(c) || out(d)) continue; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    outer = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color: '#B9B6AE', roughness: 0.97, metalness: 0, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4}));
    outer.receiveShadow = true; scene.add(outer); labKey = '';
  } catch (e){ console.warn('view-site: outer cap not loaded', e); }   // the square still works on its own
}

function buildScene(){
  const hgt = HGT;
  scene = new THREE.Scene(); scene.background = new THREE.Color('#0B0C0E');
  camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000); camera.position.set(-25, 110, 70); cams.push(camera);
  controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, -2, 0); controls.maxPolarAngle = 1.45; controls.minDistance = 15; controls.maxDistance = 400;
  const nx = meta.nx, ny = meta.ny, sizeKm = (meta.x_max - meta.x_min)/1000, EX = 2;
  const g = new THREE.PlaneGeometry(sizeKm, sizeKm, nx - 1, ny - 1); g.rotateX(-Math.PI/2);
  const pos = g.attributes.position;
  for (let k = 0; k < nx*ny; k++){ const x = pos.getX(k), z = pos.getZ(k); let h = hgt[k]; if (!isFinite(h)) h = 0; pos.setY(k, h/1000*EX - (x*x + z*z)/(2*R)); }   // vertical x2, minus curvature drop
  g.computeVertexNormals();
  // 80 m relief finer than this 240 m mesh (assets/site_detail_normal.jpg, baked from LDEM_80S_80MPP_ADJ): sharper craters, no extra vertices
  const dn = new THREE.TextureLoader().load('assets/site_detail_normal.jpg'); dn.colorSpace = THREE.NoColorSpace; dn.anisotropy = 8;
  mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color: '#B9B6AE', roughness: 0.97, metalness: 0, normalMap: dn}));
  mesh.receiveShadow = true; mesh.castShadow = true; scene.add(mesh);
  buildOuter(EX);
  scene.add(new THREE.HemisphereLight('#4A5568', '#14161A', 0.9));
  sunLight = new THREE.DirectionalLight('#FFF4E0', 2.6); sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(4096, 4096); const c = sunLight.shadow.camera; c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.near = 1; c.far = 900;
  sunLight.shadow.bias = -0.0004; scene.add(sunLight); scene.add(sunLight.target);
  const ringMat = new THREE.LineBasicMaterial({color: '#4A5058'}); ringGroup = new THREE.Group(); scene.add(ringGroup);
  [89.5, 89, 88.5, 88].forEach(lat => { const rho = 2*R*Math.tan((90 - lat)*D2R/2), pts = [];
    for (let a = 0; a <= 360; a += 3){ const x = rho*Math.sin(a*D2R), z = -rho*Math.cos(a*D2R); pts.push(new THREE.Vector3(x, 1.5 - (x*x + z*z)/(2*R), z)); }
    ringGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat)); });
  psrGroup = new THREE.Group(); scene.add(psrGroup);
  const psrMat = new THREE.LineDashedMaterial({color: '#7FD1C7', dashSize: 0.6, gapSize: 0.4});
  App.psr.polygons.forEach(pg => pg.rings.forEach((part, pi) => {
    const ring = Array.isArray(part[0][0]) ? part[0] : part; if (Array.isArray(part[0][0]) && pi > 0) return;
    const pts = [];
    for (const [X, Y] of ring){ const x = X/1000, z = -Y/1000, y = heightAt(x, z); if (y == null){ pts.length = 0; return; } pts.push(new THREE.Vector3(x, y + 0.15, z)); }
    if (pts.length > 2){ pts.push(pts[0].clone()); const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), psrMat); ln.computeLineDistances(); psrGroup.add(ln); }
  }));
  $('#lyPsr').onchange = e => psrGroup.visible = e.target.checked;
  $('#lyRings').onchange = e => ringGroup.visible = e.target.checked;
  $('#lyMis').onchange = e => App.set({missions: Object.assign({}, App.state.missions, {on: e.target.checked})}, 'scene');   // shared state: panel and drawer follow
  $('#lyShadow').onchange = e => { renderer.shadowMap.enabled = e.target.checked; mesh.material.needsUpdate = true; };
  $('#zin').onclick = () => camera.position.lerp(controls.target, 0.25);
  $('#zout').onclick = () => camera.position.sub(controls.target).multiplyScalar(1.3).add(controls.target);
}

function updateScene(){
  const st = App.state, p = App.ephAt(st.jd0 + st.t), su = App.azel(-90, 0, p.sun);   // the Sun seen from the pole lights the whole patch
  const el = su.el*D2R, az = su.az*D2R, d = 400;
  sunLight.position.set(d*Math.cos(el)*Math.sin(az), d*Math.sin(el), -d*Math.cos(el)*Math.cos(az)); sunLight.target.position.set(0, 0, 0);
  sunLight.intensity = su.el > -0.3 ? 2.6 : 0.15;
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight, out = [];
  const key = camera.matrixWorld.elements.map(v => v.toFixed(3)).join() + '|' + w + 'x' + h + '|' + st.site + '|' + misIn.length + '|' + misGroups.length;
  if (key === labKey){ legendText(labOut); return; } labKey = key; labOut = out;   // labels only move with the camera: no DOM rebuild on still frames
  const lab = $('#labels'); lab.innerHTML = '';
  const r0 = root.getBoundingClientRect(), placed = [...root.querySelectorAll('#layersBox, .zoom, .views')].map(e => e.getBoundingClientRect()).filter(b => b.width)
    .map(b => ({L: (b.left + b.right)/2 - r0.left, T: (b.top + b.bottom)/2 - r0.top, w: b.width + 8, h: b.height + 8}));   // fixed UI boxes: labels keep clear
  const ui = placed.slice();
  // a site pin under a fixed UI box (layers, zoom, view tabs) moves just past that box's nearest side, so it stays visible and clickable
  const clearUI = (L, T, ew, eh) => { for (const b of ui){ if (Math.abs(b.L - L) >= (b.w + ew)/2 || Math.abs(b.T - T) >= (b.h + eh)/2) continue;
      const right = b.L + (b.w + ew)/2 + 2, below = b.T + (b.h + eh)/2 + 2;
      if (right - L <= below - T) L = right; else T = below; }
    return [L, T]; };
  App.sites.forEach((s, i) => { const [x, z] = siteXZ(s), y = heightAt(x, z);
    if (y == null){ out.push(s.short);   // outside the terrain: a clickable pin at the edge, pointing its way (the map is the only site picker)
      const km = (90 + s.lat)*D2R*R, ex = 50*Math.sin(s.lon*D2R), ez = -50*Math.cos(s.lon*D2R), ey = heightAt(ex, ez), v = new THREE.Vector3(ex, (ey == null ? 0 : ey) + 0.6, ez).project(camera);
      if (v.z > 1) return; const e = document.createElement('div'); e.className = 'pin edge' + (i === st.site ? ' sel' : ''); e.textContent = s.short + ' · ' + Math.round(km) + ' km ➜'; e.title = s.name + ' (outside this terrain view): click to select';
      const ew = estW(e.textContent, 7.2); let L = Math.max(60, Math.min(w - 60, (v.x*0.5 + 0.5)*w)), T = Math.max(70, Math.min(h - 10, (-v.y*0.5 + 0.5)*h - 14));
      [L, T] = clearUI(L, T - 9, ew, 18); T += 9;
      e.style.left = L + 'px'; e.style.top = T + 'px'; e.onclick = () => App.set({site: i, selDay: -1}, 'scene'); lab.appendChild(e);
      placed.push({L, T: T - 9, w: estW(e.textContent, 7.2), h: 18}); return; }
    const v = new THREE.Vector3(x, y + 0.6, z).project(camera); if (v.z > 1) return;
    const e = document.createElement('div'); e.className = 'pin' + (i === st.site ? ' sel' : ''); e.textContent = s.short;
    let L = (v.x*0.5 + 0.5)*w, T = (-v.y*0.5 + 0.5)*h - 14;
    [L, T] = clearUI(L, T - 9, estW(e.textContent, 7.2), 18); T += 9;
    e.style.left = L + 'px'; e.style.top = T + 'px'; e.onclick = () => App.set({site: i, selDay: -1}, 'scene'); lab.appendChild(e);
    placed.push({L, T: T - 9, w: estW(e.textContent, 7.2), h: 18}); });   // pins sit above their point (translate -100%)
  const fits = (L, T, ew, eh) => !placed.some(p => Math.abs(p.L - L) < (p.w + ew)/2 + 4 && Math.abs(p.T - T) < (p.h + eh)/2 + 2);
  misGroups.forEach(G => { const a = G.a.clone().project(camera), b = G.b.clone().project(camera); if (a.z > 1 || b.z > 1) return;
    const ax = (a.x*0.5 + 0.5)*w, ay = (-a.y*0.5 + 0.5)*h, bx = (b.x*0.5 + 0.5)*w, by = (-b.y*0.5 + 0.5)*h, ang = Math.atan2(by - ay, bx - ax);
    const e = document.createElement('div'); e.className = 'medge'; e.title = G.tip;
    e.innerHTML = `<span class="ar" style="transform:rotate(${ang}rad)">➜</span><span class="tx">${G.lines.join('<br>')}${G.more ? '<br>+' + G.more + ' more' : ''}</span>`;
    let L = Math.max(110, Math.min(w - 110, bx)), T = Math.max(64, Math.min(h - 24, by));   // keep clear of the view buttons and the frame
    e.style.left = L + 'px'; lab.appendChild(e); const ew = Math.max(...G.lines.map(s => estW(s, 6.4))) + 10, eh = 18*G.lines.length + 16;
    const T0 = T; let ok = fits(L, T, ew, eh);
    for (const dy of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]){ if (ok) break; T = Math.max(64, Math.min(h - 24, T0 + dy*eh)); ok = fits(L, T, ew, eh); }   // step down/up past overlapping labels
    if (!ok){ T = T0; e.querySelector('.tx').remove(); e.classList.add('bare');   // no room: arrow only, names in the tooltip
      let room = false;
      for (const dx of [0, 28, -28, 56, -56, 84, -84]) if (fits(L + dx, T, 22, 22)){ e.style.left = (L + dx) + 'px'; placed.push({L: L + dx, T, w: 22, h: 22}); room = true; break; }
      if (!room){ e.remove(); return; } }   // not even an arrow fits: drop it (names stay in the (i) legend)
    else placed.push({L, T, w: ew, h: eh});
    e.style.top = T + 'px'; });
  // missions that matter for the selected site (inside its keep-out) get their labels placed first
  const site = App.sites[st.site], near = new Set(!misIn.length ? [] : Missions.near(site).filter(n => n.inside).map(n => n.m.id));
  misIn.slice().sort((a, b) => near.has(b.m.id) - near.has(a.m.id)).forEach(({m, x, y, z}) => { const v = new THREE.Vector3(x, y + 0.3, z).project(camera); if (v.z > 1) return;
    const e = document.createElement('div'); e.className = 'mlab'; e.title = misTip(m);
    e.textContent = misShort(m) + (m.precision === 'region' ? ' · region only' : '') + (m.planned ? ' · planned' : '');
    if (m.source_url) e.onclick = () => window.open(m.source_url, '_blank', 'noopener');
    const L0 = (v.x*0.5 + 0.5)*w, T0 = (-v.y*0.5 + 0.5)*h + 6, ew = estW(e.textContent, 6.4), eh = 15;
    // try below, further below, above, then to either side (still next to its point); hide only when nothing fits
    const tries = [[0, 0], [0, eh], [0, 2*eh], [0, -eh - 14], [0, -2*eh - 14], [ew/2 + 10, -eh/2], [-ew/2 - 10, -eh/2], [ew/2 + 10, eh], [-ew/2 - 10, eh]];
    const hit = tries.find(([dx, dy]) => { const L = L0 + dx, T = T0 + dy; return L - ew/2 > 0 && L + ew/2 < w && T > 60 && T + eh < h && fits(L, T + eh/2, ew, eh); });
    if (!hit) return;   // no room: no label (the circle stays; hover the (i) legend for names)
    const L = L0 + hit[0], T = T0 + hit[1]; e.style.left = L + 'px'; e.style.top = T + 'px'; lab.appendChild(e); placed.push({L, T: T + eh/2, w: ew, h: eh}); });
  legendText(out);
}
function legendText(out){
  const mOut = misOut.map(m => m.name.replace(/ \(.*\)$/, ''));
  const lg = 'LOLA terrain (PGDA 90): ±60 km around the pole at 240 m with 80 m relief shading, the rest of the cap to 300 km at 1.2 km<br>vertical ×2 · shadows are visual only<br>numbers come from 360° horizon masks' + (out.length ? '<br>outside this view: ' + out.join(', ') : '')
    + (misIn.length || misOut.length ? '<span class="msw">other missions: circle = position uncertainty, dashed = region only, filled dot = on the surface</span>'
      + '<span class="msw">faint outer ring = keep-out: 2.0 km from a lander, 0.5 km from an impact (NASA 2011, non-binding), '
      + ((App.state.missions || {}).caution ?? Missions.DEFAULTS.caution) + ' km for a large lander (our assumption), measured from the circle edge</span>'
      + (mOut.length ? '<span class="mout">' + mOut.length + ' more missions outside this view (arrows at the edge): ' + mOut.join(', ') + '</span>' : '') + '<span class="mlabel">' + Missions.LABEL + '</span>' : '');
  if (lg !== lastLegend){ lastLegend = lg; $('#legend').innerHTML = lg; }   // only touch the DOM when the text changes
}
let lastLegend = '', labKey = '', labOut = [];
const misShort = m => m.id === 'mip' ? 'Ch-1 impact est. 1' : m.id === 'mip_alt' ? 'Ch-1 impact est. 2' : m.name.replace(/ \(.*\)$/, '').replace(/ Endurance$/, '');

register('region', {
  build: buildScene,
  show(on){ $('#layersBox').hidden = !on; $('#labels').hidden = !on; root.querySelector('.zoom').hidden = !on; controls.enabled = on; },
  frame(){ controls.update(); updateScene(); renderer.render(scene, camera); },
  onState(keys){ if (keys.has('missions')){ buildMissions(); $('#lyMis').checked = (App.state.missions || {}).on !== false; } },
  ready(){ $('#lyMis').checked = (App.state.missions || {}).on !== false; buildMissions(); },
});
