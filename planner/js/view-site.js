/* view-site.js: Landing Site view ('region'). OWNER: view-site session. Registers with scene-core.js.
   Real LOLA terrain (engine heights.bin, +/-60 km) lit by the real Sun seen from the pole, site pins, PSR outlines, other missions.
   Reads App.state; changes state only with App.set (e.g. clicking a pin selects a site). */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {$, R, D2R, root, renderer, meta, HGT, cams, register, view} from './scene-core.js';

let scene, camera, controls, sunLight, world, psrGroup, ringGroup, mesh;
const EX = 2;   // vertical exaggeration of the terrain (curvature drop stays true)

/* ---------- terrain layers, centred on the SELECTED site ----------
   Everything (terrain, PSR outlines, missions, rings, the Sun light) lives in `world`, in the engine's polar stereographic frame
   (km; +x toward 90 E, -z toward 0 E; y = height x EX minus the curvature drop). On a site change `world` is moved and tilted so the
   selected site sits at the origin with its local vertical up: the camera, fog and focus ring then centre on it, and pins, rings
   and outlines follow with no extra maths. Layers, best first; a lower layer skips cells that lie fully inside a higher one:
     tile  (engine-2, ~100 m, ~50 x 50 km round a named site; ids in TILES once delivered)
     inner (heights.bin, 240 m, +/-60 km round the pole, + 80 m detail normal map: the original look)
     patch (cap_heights.bin, 640 m, +/-PATCH_KM round the selected site, rebuilt on every site change)
     outer (assets/site_outer, 1.19 km, out to OUTER_KM from the pole: context). Display only: every number comes from core.js. */
const PATCH_KM = 80, OUTER_KM = 300;
const TILES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];   // site ids with data/tiles/<id>.bin + .json from engine-2 (log 1930); listed so the page never requests a missing file
const T = {tile: null, inner: null, patch: null, outer: null};
let capM = null, capH = null, tiles = {}, terrDirty = true, tv = 0, centreXYZ = [0, 0, 0];
function layer(m, H, name){
  const px = m.pixel_m/1000, x0 = m.x_min/1000, y1 = m.y_max/1000;
  return {m, H, name, res: m.pixel_m, px, x0, y1, nx: m.nx, ny: m.ny, i0: 0, i1: m.nx - 1, j0: 0, j1: m.ny - 1, maxR: Infinity,
    cx(i){ return x0 + (i + 0.5)*px; }, cz(j){ return -(y1 - (j + 0.5)*px); }};
}
// height on a layer: bilinear between pixel centres (the mesh vertices), null outside the part it draws or on no-data
function sampleL(L, x, z){
  if (!L || Math.hypot(x, z) > L.maxR) return null;
  const c = (x - L.x0)/L.px - 0.5, r = (L.y1 + z)/L.px - 0.5;
  if (!(c >= L.i0 && r >= L.j0 && c <= L.i1 && r <= L.j1)) return null;
  const i = Math.min(L.i1 - 1, Math.floor(c)), j = Math.min(L.j1 - 1, Math.floor(r)), u = c - i, w = r - j, k = j*L.nx + i, H = L.H;
  const h = (H[k]*(1 - u) + H[k + 1]*u)*(1 - w) + (H[k + L.nx]*(1 - u) + H[k + L.nx + 1]*u)*w;
  return isFinite(h) ? h/1000*EX - (x*x + z*z)/(2*R) : null;
}
const layers = () => [T.tile, T.inner, T.patch, T.outer].filter(Boolean);
function layerAt(x, z){ for (const L of layers()) if (sampleL(L, x, z) != null) return L; return null; }
function groundAt(x, z){ for (const L of layers()){ const y = sampleL(L, x, z); if (y != null) return y; } return null; }
const heightAt = groundAt;   // older call sites: any layer now, not only the 240 m square
function meshFor(L, mat, uv){
  const nI = L.i1 - L.i0 + 1, nJ = L.j1 - L.j0 + 1, pos = new Float32Array(nI*nJ*3), uvs = uv ? new Float32Array(nI*nJ*2) : null;
  for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++){ const k = j*nI + i, I = L.i0 + i, J = L.j0 + j, x = L.cx(I), z = L.cz(J), h = L.H[J*L.nx + I];
    pos[k*3] = x; pos[k*3 + 1] = (isFinite(h) ? h : 0)/1000*EX - (x*x + z*z)/(2*R); pos[k*3 + 2] = z;
    if (uvs){ uvs[k*2] = I/(L.nx - 1); uvs[k*2 + 1] = 1 - J/(L.ny - 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); if (uvs) g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  L.nI = nI; L.nJ = nJ; L.mesh = new THREE.Mesh(g, mat); L.mesh.receiveShadow = true; return L.mesh;
}
// triangles of a layer: skip cells with no data, beyond maxR, or fully inside a higher layer (edge cells overlap; polygonOffset hides the seam)
function indexFor(L, above){
  const rects = above.filter(Boolean).map(A => [A.cx(A.i0), A.cx(A.i1), A.cz(A.j0), A.cz(A.j1)]);
  const P = L.mesh.geometry.attributes.position.array, nI = L.nI, nJ = L.nJ, idx = [];
  const bad = new Uint8Array(nI*nJ), inA = new Uint8Array(nI*nJ);
  for (let k = 0; k < nI*nJ; k++){ const x = P[k*3], z = P[k*3 + 2], I = L.i0 + k % nI, J = L.j0 + Math.floor(k/nI);
    bad[k] = !isFinite(L.H[J*L.nx + I]) || Math.hypot(x, z) > L.maxR ? 1 : 0;
    inA[k] = rects.some(r => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) ? 1 : 0; }
  for (let j = 0; j < nJ - 1; j++) for (let i = 0; i < nI - 1; i++){ const a = j*nI + i, b = a + 1, c = a + nI, d = c + 1;
    if (bad[a] || bad[b] || bad[c] || bad[d] || (inA[a] && inA[b] && inA[c] && inA[d])) continue; idx.push(a, c, b, b, c, d); }
  L.mesh.geometry.setIndex(idx); L.mesh.geometry.computeVertexNormals();
}
// lat/lon (east) of a point on the map: polar stereographic on the 1737.4 km sphere, +x toward 90 E, +y (= -z) toward 0 E
function xzLatLon(x, z){ const X = x, Y = -z, rho = Math.hypot(X, Y);
  return {lat: -90 + 2*Math.atan(rho/(2*R))/D2R, lon: ((Math.atan2(X, Y)/D2R) + 360) % 360, km: rho}; }
// label width from its text (no layout read: reading offsetWidth every frame forced a full-page layout per label)
const estW = (s, cpx) => s.length*cpx + 12;
function siteXZ(s){ const rho = 2*R*Math.tan((90 + s.lat)*D2R/2); return [rho*Math.sin(s.lon*D2R), -rho*Math.cos(s.lon*D2R)]; }

/* ---------- other missions (missions.js): circle of radius_km = position uncertainty, styled by precision ---------- */
let misGroup = null, misIn = [], misOut = [], misGroups = [];
const MCOL = '#F2876B', KOMAT = new THREE.LineBasicMaterial({color: MCOL, transparent: true, opacity: 0.35});
function missionRows(){ const ms = App.state.missions || {}; if (!window.Missions || !Missions.rows || ms.on === false) return [];
  return Missions.rows.filter(m => m.placed && (ms.cn !== false || m.group !== 'cn')); }
function buildMissions(){
  if (misGroup){ world.remove(misGroup); misGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  misGroup = new THREE.Group(); world.add(misGroup); misIn = []; misOut = []; labKey = '';
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
  // groups with no 3D ground under them (beyond OUTER_KM from the pole): one arrow on the focus ring round the selected site,
  // pointing from the site toward the group, with the distance from the site (missions chat groups them)
  misGroups = [];
  const sel = App.sites[App.state.site];
  if (misOut.length && Missions.offMap && sel){
    const ms = App.state.missions || {}, [sx, sz] = siteXZ(sel);
    for (const g of Missions.offMap(OUTER_KM, {cn: ms.cn !== false}).offMap){
      const [mx, mz] = siteXZ(g.rows[0]), bear = Math.atan2(mx - sx, -(mz - sz));   // map bearing from the site (0 = toward 0 E at the pole)
      const p = (r) => { const x = sx + r*Math.sin(bear), z = sz - r*Math.cos(bear), y = groundAt(x, z); return new THREE.Vector3(x, (y == null ? 0 : y) + 0.4, z); };
      const away = Math.min(...g.rows.map(m => Missions.distanceKm(sel.lat, sel.lon, m.lat, m.lon)));
      const short = g.names[0].replace(/ \((?!estimate).*\)$/, '') + (g.names.length > 1 ? ' +' + (g.names.length - 1) : '');   // short on the map; full names in the tooltip
      const line = short + ' · ' + Math.round(away) + ' km', tip = g.names.join(', ') + ': ' + Math.round(away) + ' km from ' + (sel.custom ? 'your spot' : sel.short) + '\n\n' + g.rows.map(misTip).join('\n\n');
      g.bear = bear;
      const same = misGroups.find(o => Math.abs(((o.g.bear - bear)/D2R + 540) % 360 - 180) < 10);   // same direction (within 10 deg): one arrow, stacked lines
      if (same){ if (same.lines.length < 2) same.lines.push(line); else same.more = (same.more || 0) + g.names.length; same.tip += '\n\n— — —\n\n' + tip; } else misGroups.push({g, a: p(48), b: p(55), lines: [line], tip});
    }
  }
}
function misTip(m){ return [m.name + ' (' + m.agency + ')', m.date_text, 'Status: ' + m.status, 'Position: ' + m.precisionText + (m.placeholder ? ' · placeholder point' : ''), 'Source quality: ' + (m.quality || 'not stated')]
  .concat(m.note ? ['Note: ' + m.note] : []).concat(m.source_url ? ['Source: ' + m.source_url + ' (click to open)'] : []).join('\n'); }

/* focus fog: ground and lines fade toward the background with distance FROM THE SELECTED SITE (world origin; not from the camera),
   so the area round the site stays clear at any zoom and the rest of the cap reads as context. Clear to FOG0 km, FOGMAX at FOG1 km. */
const FOG0 = 55, FOG1 = 120, FOGMAX = 0.82;
function focusFog(mat){
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vPoleKm;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPoleKm = length((modelMatrix * vec4(transformed, 1.0)).xz);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vPoleKm;')
      .replace('#include <fog_fragment>', `#include <fog_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.043, 0.047, 0.055), smoothstep(${FOG0.toFixed(1)}, ${FOG1.toFixed(1)}, vPoleKm)*${FOGMAX});`);
  };
  mat.customProgramCacheKey = () => 'focusFog';
  return mat;
}
const terrMat = (o) => focusFog(new THREE.MeshStandardMaterial(Object.assign({color: '#B9B6AE', roughness: 0.97, metalness: 0}, o)));
const OFF = f => ({polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: 2*f});   // lower layers sit a little behind higher ones
let patchMat = null, tileMat = null;
async function loadOuter(){
  try {
    const [om, buf] = await Promise.all([fetch('assets/site_outer_meta.json').then(r => r.json()), fetch('assets/site_outer_heights.bin').then(r => r.arrayBuffer())]);
    const L = layer(om, new Float32Array(buf), 'outer'); L.maxR = OUTER_KM; world.add(meshFor(L, terrMat(OFF(3)))); indexFor(L, [T.tile, T.inner, T.patch]); T.outer = L; terrDirty = true;
  } catch (e){ console.warn('view-site: outer cap not loaded', e); }   // the rest still works on its own
}
async function loadCap(){
  try {
    const [m, buf] = await Promise.all([fetch(App.DATA + 'cap_meta.json').then(r => r.json()), fetch(App.DATA + 'cap_heights.bin').then(r => r.arrayBuffer())]);
    capM = m; capH = new Float32Array(buf); terrDirty = true;
  } catch (e){ console.warn('view-site: cap grid not loaded', e); }
}
async function loadTile(id){
  tiles[id] = 'loading';
  try {
    const [m, buf] = await Promise.all([fetch(App.DATA + 'tiles/' + id + '.json').then(r => r.json()), fetch(App.DATA + 'tiles/' + id + '.bin').then(r => r.arrayBuffer())]);
    const L = layer(m, new Float32Array(buf), 'tile'); meshFor(L, tileMat); L.mesh.castShadow = true; tiles[id] = L; terrDirty = true;
  } catch (e){ tiles[id] = 'none'; console.warn('view-site: tile ' + id + ' not loaded', e); }
}
// rebuild the ground round the selected site (runs in frame()/show() when dirty, so a hidden view costs nothing)
function rebuildTerrain(){
  terrDirty = false; const s = App.sites[App.state.site]; if (!s) return;
  const [x, z] = siteXZ(s);
  const id = !s.custom && TILES.includes(s.id) ? s.id : null; if (id && !tiles[id]) loadTile(id);
  const tile = id && typeof tiles[id] === 'object' ? tiles[id] : null;
  if (T.tile !== tile){ if (T.tile) world.remove(T.tile.mesh); T.tile = tile; if (tile){ indexFor(tile, []); world.add(tile.mesh); } indexFor(T.inner, [tile]); }
  if (T.patch){ world.remove(T.patch.mesh); T.patch.mesh.geometry.dispose(); T.patch = null; }
  if (capM){ const L = layer(capM, capH, 'patch'), n = PATCH_KM/L.px, c = (x - L.x0)/L.px - 0.5, r = (L.y1 + z)/L.px - 0.5;
    L.i0 = Math.max(0, Math.floor(c - n)); L.i1 = Math.min(L.nx - 1, Math.ceil(c + n)); L.j0 = Math.max(0, Math.floor(r - n)); L.j1 = Math.min(L.ny - 1, Math.ceil(r + n));
    if (L.i1 - L.i0 > 2 && L.j1 - L.j0 > 2){ meshFor(L, patchMat); L.mesh.castShadow = true; indexFor(L, [T.tile, T.inner]); world.add(L.mesh); T.patch = L; } }
  if (T.outer) indexFor(T.outer, [T.tile, T.inner, T.patch]);
  // move + tilt the world: site at the origin, its local vertical (normal of the curved ground) up
  const y = groundAt(x, z) ?? 0, q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(x/R, 1, z/R).normalize(), new THREE.Vector3(0, 1, 0));
  world.quaternion.copy(q); world.position.copy(new THREE.Vector3(x, y, z).applyQuaternion(q).negate()); world.updateMatrixWorld(true);
  centreXYZ = [x, y, z];
  buildFocusRing(x, z); buildPsr(x, z); buildMissions(); tv++; labKey = ''; noteText();
}
// focus edge: one quiet ring 59.5 km round the selected site, draped on the terrain; no text
let focusRing = null;
const FOCUSMAT = new THREE.LineBasicMaterial({color: '#C9CED6', transparent: true, opacity: 0.55});
function buildFocusRing(cx, cz){
  if (focusRing){ world.remove(focusRing); focusRing.geometry.dispose(); }
  const pts = []; for (let a = 0; a <= 360; a += 1){ const x = cx + 59.5*Math.sin(a*D2R), z = cz - 59.5*Math.cos(a*D2R), y = groundAt(x, z); pts.push(new THREE.Vector3(x, (y == null ? 0 : y) + 0.3, z)); }
  focusRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), FOCUSMAT); world.add(focusRing);
}
// permanently shadowed regions (App.psr) within PSR_KM of the selected site: one merged dashed line set, draped on the best layer
const PSR_KM = 130; let psrMat = null;
function buildPsr(cx, cz){
  psrGroup.children.slice().forEach(o => { psrGroup.remove(o); o.geometry.dispose(); });
  const pos = [], dist = [];
  App.psr.polygons.forEach(pg => pg.rings.forEach((part, pi) => {
    const ring = Array.isArray(part[0][0]) ? part[0] : part; if (Array.isArray(part[0][0]) && pi > 0) return;
    if (Math.hypot(ring[0][0]/1000 - cx, -ring[0][1]/1000 - cz) > PSR_KM) return;
    const pts = [];
    for (const [X, Y] of ring){ const x = X/1000, z = -Y/1000, L = layerAt(x, z); if (!L){ return; } pts.push([x, sampleL(L, x, z) + 0.12 + L.px*0.12, z]); }
    if (pts.length < 3) return; pts.push(pts[0]); let d = 0;
    for (let k = 0; k < pts.length - 1; k++){ const a = pts[k], b = pts[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      pos.push(...a, ...b); dist.push(d, d + l); d += l; }
  }));
  if (!pos.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('lineDistance', new THREE.Float32BufferAttribute(dist, 1));
  psrGroup.add(new THREE.LineSegments(g, psrMat));
}

function buildScene(){
  scene = new THREE.Scene(); scene.background = new THREE.Color('#0B0C0E');
  world = new THREE.Group(); scene.add(world);
  camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000); camera.position.set(-25, 110, 70); cams.push(camera);
  controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 0, 0); controls.maxPolarAngle = 1.45; controls.minDistance = 15; controls.maxDistance = 400;
  // inner: heights.bin 240 m + 80 m relief finer than the mesh (assets/site_detail_normal.jpg, baked from LDEM_80S_80MPP_ADJ): the original look
  const dn = new THREE.TextureLoader().load('assets/site_detail_normal.jpg'); dn.colorSpace = THREE.NoColorSpace; dn.anisotropy = 8;
  T.inner = layer(meta, HGT, 'inner'); mesh = meshFor(T.inner, terrMat(Object.assign({normalMap: dn}, OFF(1))), true); mesh.castShadow = true; indexFor(T.inner, []); world.add(mesh);
  patchMat = terrMat(OFF(2)); tileMat = terrMat({});
  loadOuter(); loadCap();
  scene.add(new THREE.HemisphereLight('#4A5568', '#14161A', 0.9));
  sunLight = new THREE.DirectionalLight('#FFF4E0', 2.6); sunLight.castShadow = true;   // in `world`: it moves with the site
  sunLight.shadow.mapSize.set(4096, 4096); const c = sunLight.shadow.camera; c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.near = 1; c.far = 900;
  sunLight.shadow.bias = -0.0004; world.add(sunLight); world.add(sunLight.target);
  const ringMat = new THREE.LineBasicMaterial({color: '#4A5058'}); ringGroup = new THREE.Group(); world.add(ringGroup);
  // 88 S (60.6 km) dropped: it read as a double line with the old pole-centred focus ring
  [89.5, 89, 88.5].forEach(lat => { const rho = 2*R*Math.tan((90 - lat)*D2R/2), pts = [];
    for (let a = 0; a <= 360; a += 3){ const x = rho*Math.sin(a*D2R), z = -rho*Math.cos(a*D2R); pts.push(new THREE.Vector3(x, 1.5 - (x*x + z*z)/(2*R), z)); }
    ringGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat)); });
  psrGroup = new THREE.Group(); world.add(psrGroup);
  psrMat = focusFog(new THREE.LineDashedMaterial({color: '#7FD1C7', dashSize: 0.6, gapSize: 0.4}));
  $('#lyPsr').onchange = e => psrGroup.visible = e.target.checked;
  $('#lyRings').onchange = e => ringGroup.visible = e.target.checked;
  $('#lyMis').onchange = e => App.set({missions: Object.assign({}, App.state.missions, {on: e.target.checked})}, 'scene');   // shared state: panel and drawer follow
  $('#lyShadow').onchange = e => { renderer.shadowMap.enabled = e.target.checked; world.traverse(o => { if (o.isMesh) o.material.needsUpdate = true; }); };
  $('#zin').onclick = () => camera.position.lerp(controls.target, 0.25);
  $('#zout').onclick = () => camera.position.sub(controls.target).multiplyScalar(1.3).add(controls.target);
  // note box (bottom left, never mid-screen): spot status, errors, and "outside the detailed map" for the selected site
  note = document.createElement('div'); note.id = 'siteNote'; note.setAttribute('role', 'status');
  Object.assign(note.style, {position: 'absolute', left: '12px', bottom: '12px', maxWidth: '360px', font: '12px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--ink)', background: 'rgba(11,12,14,0.82)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 9px', pointerEvents: 'none', zIndex: 3});
  note.hidden = true; root.appendChild(note);
  // double-click the ground = test a custom landing spot there (single clicks and drags still orbit)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  renderer.domElement.addEventListener('dblclick', async e => {
    if (view !== 'region') return;
    const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left)/r.width*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1);
    ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(layers().map(L => L.mesh), false)[0]; if (!hit) return;
    const m = world.worldToLocal(hit.point.clone()), p = xzLatLon(m.x, m.z);   // back to the map frame (world is moved + tilted to the site)
    flash = 'Measuring this spot (' + p.lat.toFixed(3) + '°, ' + p.lon.toFixed(2) + '° E, ' + p.km.toFixed(1) + ' km from the pole)…'; noteText();
    try { await App.addSpot(p.lat, p.lon); flash = ''; }
    catch (err){ flash = err.message; setTimeout(() => { if (flash === err.message){ flash = ''; noteText(); } }, 5000); }
    noteText(); });
}
let note = null, flash = '';
function noteText(){
  if (!note) return;
  // honest terrain label: which grid the 3D ground under the selected site comes from (the picture only; numbers come from core.js)
  const s = App.sites[App.state.site], [x, z] = s ? siteXZ(s) : [0, 0], L = s && layerAt(x, z);
  const res = !L ? null : L.res >= 1000 ? (L.res/1000).toFixed(1) + ' km' : Math.round(L.res) + ' m';
  let t = flash;
  if (!t && s) t = (s.custom ? 'Your spot' : s.short) + ': 3D ground from ' + (res ? res + ' terrain' : 'terrain (loading)') + ', a picture only. '
    + (s.custom ? 'Its numbers are ' + s.label + '.' : 'Its numbers use its full terrain horizon.') + ' Double-click the ground to test any spot.';
  if (!t) t = 'Double-click the ground to test any spot.';
  if (note.textContent !== t) note.textContent = t;
}

function updateScene(){
  // Sun direction in the map frame (az/el seen from the pole = the map's own axes); the light sits in `world`, aimed at the site.
  // Lit or dark follows the Sun seen from the selected site.
  const st = App.state, p = App.ephAt(st.jd0 + st.t), su = App.azel(-90, 0, p.sun), s0 = App.sites[st.site];
  const el = su.el*D2R, az = su.az*D2R, d = 400, [sx, sy, sz] = centreXYZ, elS = s0 ? App.azel(s0.lat, s0.lon, p.sun).el : su.el;
  sunLight.position.set(sx + d*Math.cos(el)*Math.sin(az), sy + d*Math.sin(el), sz - d*Math.cos(el)*Math.cos(az)); sunLight.target.position.set(sx, sy, sz);
  sunLight.intensity = elS > -0.3 ? 2.6 : 0.15;
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight, out = [];
  const W = world.matrixWorld, P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(W);   // map frame -> scene (site-centred)
  const key = camera.matrixWorld.elements.map(v => v.toFixed(3)).join() + '|' + w + 'x' + h + '|' + st.site + '|' + App.sites.length + '|' + tv + '|' + misIn.length + '|' + misGroups.length;
  if (key === labKey){ legendText(labOut); return; } labKey = key; labOut = out;   // labels only move with the camera: no DOM rebuild on still frames
  const lab = $('#labels'); lab.innerHTML = '';
  const r0 = root.getBoundingClientRect(), placed = [...root.querySelectorAll('#layersBox, .zoom, .views, #siteNote')].map(e => e.getBoundingClientRect()).filter(b => b.width)
    .map(b => ({L: (b.left + b.right)/2 - r0.left, T: (b.top + b.bottom)/2 - r0.top, w: b.width + 8, h: b.height + 8}));   // fixed UI boxes: labels keep clear
  const ui = placed.slice();
  // a site pin under a fixed UI box (layers, zoom, view tabs) moves just past that box's nearest side, so it stays visible and clickable
  const clearUI = (L, T, ew, eh) => { for (const b of ui){ if (Math.abs(b.L - L) >= (b.w + ew)/2 || Math.abs(b.T - T) >= (b.h + eh)/2) continue;
      const right = b.L + (b.w + ew)/2 + 2, below = b.T + (b.h + eh)/2 + 2;
      if (right - L <= below - T) L = right; else T = below; }
    return [L, T]; };
  /* site pins (10+ sites): the selected site first, then nearest the pole first. A pin that would cover another climbs straight up
     (a thin stem keeps it tied to its point); after 4 climbs it becomes a small clickable dot. Sites off the frame get an edge pin
     with an arrow toward them, stacked along the edge. Every site stays clickable (the map is a site picker). */
  const fitsP = (L, T, ew, eh) => !placed.some(p => Math.abs(p.L - L) < (p.w + ew)/2 + 3 && Math.abs(p.T - T) < (p.h + eh)/2 + 1);
  const mkPin = (s, i, txt, cls) => { const e = document.createElement('div'); e.className = 'pin' + (cls || '') + (i === st.site ? ' sel' : ''); e.textContent = txt;
    e.title = (s.custom ? 'Your spot (' + s.label + ')' : s.name) + ': click to select';
    if (s.custom){ e.style.background = 'var(--bg)'; e.style.color = i === st.site ? 'var(--earth)' : 'var(--ink)';   // custom spot: hollow pin
      e.style.border = '1.5px solid ' + (i === st.site ? 'var(--earth)' : 'var(--ink)'); }
    e.onclick = () => App.set({site: i, selDay: -1}, 'scene'); return e; };
  const poleKm = s => Math.hypot(...siteXZ(s));
  const order = App.sites.map((s, i) => i).sort((a, b) => (b === st.site) - (a === st.site) || poleKm(App.sites[a]) - poleKm(App.sites[b]));
  const offFrame = [];
  for (const i of order){ const s = App.sites[i], [x, z] = siteXZ(s), y = groundAt(x, z);   // sites beyond the detailed square sit on the faded outer cap
    const v = P(x, (y == null ? 0 : y) + 0.6, z).project(camera), px = (v.x*0.5 + 0.5)*w, py = (-v.y*0.5 + 0.5)*h;
    if (y == null || v.z > 1 || px < 10 || px > w - 10 || py < 70 || py > h - 10){ offFrame.push({s, i, v, px, py}); continue; }
    const ew = estW(s.short, 7.2); let k = 0;
    while (k < 5 && !(py - 14 - k*22 - 20 >= 40 && fitsP(px, py - 23 - k*22, ew, 18))) k++;   // never climb off the top of the frame
    if (k === 5){   // no room even 4 steps up: a small dot on the point, name in its tooltip
      if (!fitsP(px, py, 10, 10)) continue;
      const d = mkPin(s, i, ''); Object.assign(d.style, {width: '9px', height: '9px', padding: '0', borderRadius: '50%', transform: 'translate(-50%,-50%)', left: px + 'px', top: py + 'px'});
      d.classList.add('edge'); lab.appendChild(d); placed.push({L: px, T: py, w: 10, h: 10}); continue; }
    const T = py - 14 - k*22, e = mkPin(s, i, s.short); e.style.left = px + 'px'; e.style.top = T + 'px'; lab.appendChild(e);
    if (k){ const stem = document.createElement('div');   // longer stem for a pin that climbed
      Object.assign(stem.style, {position: 'absolute', left: px + 'px', top: (T + 14) + 'px', width: '1px', height: (k*22) + 'px', background: 'var(--ink)', opacity: '0.7', pointerEvents: 'none'}); lab.appendChild(stem); }
    placed.push({L: px, T: T - 9, w: ew, h: 18}); }
  // off the frame: edge pin on the line from the frame centre toward the site, inside a margin, stacked if it would cover another
  const cx = w/2, cy = h/2, X0 = 70, X1 = w - 70, Y0 = 78, Y1 = h - 44;
  for (const {s, i, v, px, py} of offFrame){
    let dx = px - cx, dy = py - cy; if (v.z > 1){ dx = -dx; dy = -dy; }   // behind the camera: the projection flips
    const t = Math.min(dx ? ((dx > 0 ? X1 : X0) - cx)/dx : Infinity, dy ? ((dy > 0 ? Y1 : Y0) - cy)/dy : Infinity), ang = Math.atan2(dy, dx);
    const txt = s.short + ' · ' + Math.round(poleKm(s)) + ' km', ew = estW(txt, 7.2) + 14, L0 = cx + dx*t, T0 = cy + dy*t;
    // side edges: stack up/down (then one column inward); top/bottom edges: step sideways (then one row inward)
    const along = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5], side = Math.abs(dx)*h > Math.abs(dy)*w, cand = [];
    for (const row of [0, 1, 2]) for (const o of along) cand.push(side ? [L0 - Math.sign(dx)*row*(ew + 6), T0 + o*22] : [L0 + o*(ew*0.6 + 10), T0 - Math.sign(dy)*row*24]);
    const slot = cand
      .map(([L, T]) => [Math.max(ew/2 + 8, Math.min(w - ew/2 - 8, L)), Math.max(Y0, Math.min(Y1, T))]).find(([L, T]) => fitsP(L, T - 9, ew, 18));
    if (!slot) continue;
    const e = mkPin(s, i, txt, ' edge'); e.title = s.name + ', ' + Math.round(poleKm(s)) + ' km from the pole (off this view): click to select';
    const ar = document.createElement('span'); ar.textContent = ' ➜'; ar.style.display = 'inline-block'; ar.style.transform = `rotate(${ang}rad)`; e.appendChild(ar);
    e.style.left = slot[0] + 'px'; e.style.top = slot[1] + 'px'; lab.appendChild(e); placed.push({L: slot[0], T: slot[1] - 9, w: ew, h: 18}); }
  const fits = (L, T, ew, eh) => !placed.some(p => Math.abs(p.L - L) < (p.w + ew)/2 + 4 && Math.abs(p.T - T) < (p.h + eh)/2 + 2);
  misGroups.forEach(G => { const a = G.a.clone().applyMatrix4(W).project(camera), b = G.b.clone().applyMatrix4(W).project(camera); if (a.z > 1 || b.z > 1) return;
    const ax = (a.x*0.5 + 0.5)*w, ay = (-a.y*0.5 + 0.5)*h, bx = (b.x*0.5 + 0.5)*w, by = (-b.y*0.5 + 0.5)*h, ang = Math.atan2(by - ay, bx - ax);
    const e = document.createElement('div'); e.className = 'medge'; e.title = G.tip;
    e.innerHTML = `<span class="ar" style="transform:rotate(${ang}rad)">➜</span><span class="tx">${G.lines.join('<br>')}${G.more ? '<br>+' + G.more + ' more' : ''}</span>`;
    const ew = Math.max(...G.lines.map(s => estW(s, 6.4))) + 10, eh = 18*G.lines.length + 16;
    let L = Math.max(ew/2 + 8, Math.min(w - ew/2 - 8, bx)), T = Math.max(64, Math.min(h - 24, by));   // whole label inside the frame
    e.style.left = L + 'px'; lab.appendChild(e);
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
  misIn.slice().sort((a, b) => near.has(b.m.id) - near.has(a.m.id)).forEach(({m, x, y, z}) => { const v = P(x, y + 0.3, z).project(camera); if (v.z > 1) return;
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
  // the (i) on the "other missions" row explains other missions only (Eren); the terrain note lives in the right panel
  const lg = (misIn.length || misOut.length ? '<span class="msw">other missions: circle = position uncertainty, dashed = region only, filled dot = on the surface</span>'
      + '<span class="msw">faint outer ring = keep-out: 2.0 km from a lander, 0.5 km from an impact (NASA 2011, non-binding), '
      + ((App.state.missions || {}).caution ?? Missions.DEFAULTS.caution) + ' km for a large lander (our assumption), measured from the circle edge</span>'
      + (mOut.length ? '<span class="mout">' + mOut.length + ' more missions further out (arrows at the edge of the detailed area): ' + mOut.join(', ') + '</span>' : '') + '<span class="mlabel">' + Missions.LABEL + '</span>'
    : '<span class="msw">Other missions are hidden. Tick the box to show them.</span><span class="mlabel">' + Missions.LABEL + '</span>');
  if (lg !== lastLegend){ lastLegend = lg; $('#legend').innerHTML = lg; }   // only touch the DOM when the text changes
}
let lastLegend = '', labKey = '', labOut = [];
const misShort = m => m.id === 'mip' ? 'Ch-1 impact est. 1' : m.id === 'mip_alt' ? 'Ch-1 impact est. 2' : m.name.replace(/ \(.*\)$/, '').replace(/ Endurance$/, '');

register('region', {
  build: buildScene,
  show(on){ $('#layersBox').hidden = !on; $('#labels').hidden = !on; root.querySelector('.zoom').hidden = !on; controls.enabled = on; if (on && terrDirty) rebuildTerrain(); if (note){ note.hidden = !on; noteText(); } },
  frame(){ if (terrDirty) rebuildTerrain(); controls.update(); updateScene(); renderer.render(scene, camera); },
  onState(keys){ if (keys.has('missions')){ buildMissions(); $('#lyMis').checked = (App.state.missions || {}).on !== false; }
    if (keys.has('spot') || keys.has('sites')){ labKey = ''; buildMissions(); }   // App.sites changed length: pins rebuild on the next frame
    if (keys.has('site') || keys.has('spot') || keys.has('sites')){ terrDirty = true; noteText(); } },   // the ground re-centres on the next frame
  ready(){ $('#lyMis').checked = (App.state.missions || {}).on !== false; buildMissions(); },
});
