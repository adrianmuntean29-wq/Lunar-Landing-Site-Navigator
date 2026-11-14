/* view-moon.js: Moon view ('globe'). OWNER: view-moon session. Registers with scene-core.js.
   Unit sphere, Moon ME frame -> three.js (x, z_north, -y); texture u = 0.5 at lon 0.
   Realism where it matters: real LOLA terrain sits on the globe in 3D from the pole to 80 S (fine 240 m cap to 57 km, then a
   1.2 km ring to ~300 km with 300 m relief shading), heights x2, lit by the real Sun with real (visual-only) shadows.
   North of 80.3 S: NASA SVS colour + normal map on a sphere.
   The cap takes its colours from the same map, so the join blends. Our sites get callouts; clicking one selects it. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {$, R, D2R, root, renderer, view, meta, HGT, cams, me2t, llv, moonTex, moonNrm, register} from './scene-core.js';

let globe, gCam, gCtl, gSun, gMoon, gCap, gOut = null, capColored = false, gAnim = null, gPreset = null, gsl = [], gBars = null;
let OMETA = null, OHGT = null;   // outer grid: assets/site_outer_heights.bin (LOLA 80 m area-mean, 512x512, 1187.5 m, +/-304 km), baked by view-site
const CAPEX = 2, CAPLAT = -88.1;   // vertical exaggeration (same as Landing Site); fine cap edge ~57 km from the pole, inside the +/-60 km square grid
const RIN = 57.0, ROUT = 297, TAPER = [276, 296];   // km from the pole: outer ring starts under the fine cap's skirt, eases to height 0 by 296 km (~80.3 S)
// height (m) at lat/lon: fine grid (240 m) inside the cap, outer grid (1.2 km) beyond; both polar stereographic, +x toward 90 E, +y toward 0 E
function gridH(M, H, lat, lon){ const rho = 2*R*Math.tan((90 + lat)*D2R/2)*1000, x = rho*Math.sin(lon*D2R), y = rho*Math.cos(lon*D2R);
  const i = Math.floor((x - M.x_min)/M.pixel_m), j = Math.floor((M.y_max - y)/M.pixel_m);
  if (i < 0 || j < 0 || i >= M.nx || j >= M.ny) return null; const h = H[j*M.nx + i]; return isFinite(h) ? h : 0; }
const rhoOf = lat => 2*R*Math.tan((90 + lat)*D2R/2);
const outTaper = rho => { const t = Math.min(1, Math.max(0, (rho - TAPER[0])/(TAPER[1] - TAPER[0]))); return 1 - t*t*(3 - 2*t); };
function capH(lat, lon){ const rho = rhoOf(lat);
  if (rho < RIN){ const h = gridH(meta, HGT, lat, lon); if (h != null) return h; }
  if (OHGT){ const h = gridH(OMETA, OHGT, lat, lon); if (h != null) return h*outTaper(rho); }
  return 0; }
const surf = (lat, lon) => llv(lat, lon, 1 + capH(lat, lon)/1000*CAPEX/R);
// one terrain mesh from a polar grid: vertices where keep(rho, lat) is true; a one-cell skirt around them folds down under the globe (no gaps)
function buildTerrain(M, H, keepFn, heightK, mat){
  const nx = M.nx, ny = M.ny, n = nx*ny, pos = new Float32Array(n*3), ll = new Float32Array(n*2), keep = new Uint8Array(n), idx = [];
  for (let jy = 0; jy < ny; jy++) for (let ix = 0; ix < nx; ix++){ const k = jy*nx + ix;
    const x = (M.x_min + (ix + 0.5)*M.pixel_m)/1000, y = (M.y_max - (jy + 0.5)*M.pixel_m)/1000;
    const rho = Math.hypot(x, y), lon = Math.atan2(x, y)/D2R, lat = -90 + 2*Math.atan(rho/(2*R))/D2R;
    let h = H[k]; if (!isFinite(h)) h = 0;
    const v = llv(lat, lon, 1 + h*heightK(rho)/1000*CAPEX/R); pos[k*3] = v.x; pos[k*3 + 1] = v.y; pos[k*3 + 2] = v.z;
    ll[k*2] = lat; ll[k*2 + 1] = lon; keep[k] = keepFn(rho, lat) ? 1 : 0; }
  for (let jy = 0; jy < ny - 1; jy++) for (let ix = 0; ix < nx - 1; ix++){ const a = jy*nx + ix, b = a + 1, c = a + nx, d = c + 1;
    if (keep[a] || keep[b] || keep[c] || keep[d]){ idx.push(a, c, b, b, c, d);
      for (const q of [a, b, c, d]) if (!keep[q]) keep[q] = 2; } }   // 2 = skirt vertex: folded down after the normals are computed
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n*3).fill(0.5), 3)); g.setIndex(idx);
  g.computeVertexNormals();
  let q0 = 0; while (keep[q0] !== 1) q0++;   // make sure the normals point outwards (away from the Moon's centre)
  const nrm = g.attributes.normal;
  if (nrm.getX(q0)*pos[q0*3] + nrm.getY(q0)*pos[q0*3 + 1] + nrm.getZ(q0)*pos[q0*3 + 2] < 0){ for (let t = 0; t < idx.length; t += 3){ const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; } g.setIndex(idx); g.computeVertexNormals(); }
  for (let q = 0; q < n; q++) if (keep[q] === 2){ const v = llv(ll[q*2], ll[q*2 + 1], 0.985); g.attributes.position.setXYZ(q, v.x, v.y, v.z); }   // skirt; normals stay the terrain's (no dark rim)
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; m.userData.ll = ll; globe.add(m); return m;
}
function buildCap(){   // fine LOLA cap (heights.bin, 240 m) to 88.1 S, real heights up to its edge (the outer ring continues them)
  gCap = buildTerrain(meta, HGT, (rho, lat) => lat < CAPLAT, () => 1,
    new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4}));
}
// polar relief (assets/moon_normal_s80_2k.jpg, baked from LOLA LDEM_80S_80MPP_ADJ, ~300 m/px, slopes x2; R = slope along grid +x (toward 90 E),
// G = along grid +y (toward 0 E), B = up) replaces the outer ring's 1.2 km vertex normals: sharper shading; shadows still come from the geometry
const POLAR_GLSL = `
  vec3 n0 = normalize(vLoc);
  float k = 2.0*1737.4/(1.0 - n0.y);   // polar stereographic: rho = 2R cos(lat)/(1 - sin(lat)); gx = rho sin(lon), gy = rho cos(lon) (km)
  vec3 t = texture2D(polarNrm, (vec2(-n0.z, n0.x)*k + 304.0)/608.0).xyz*2.0 - 1.0;
  vec3 tx = normalize(vec3(0.0, 0.0, -1.0) - n0*(-n0.z)), ty = normalize(vec3(1.0, 0.0, 0.0) - n0*n0.x);   // grid axes on the ground
  normal = normalize((viewMatrix*vec4(t.x*tx + t.y*ty + t.z*n0, 0.0)).xyz);`;
async function buildOuter(){   // 3D terrain ring 57 km -> 80.3 S, so the real shadows reach out to where the flat globe takes over
  OMETA = await (await fetch('assets/site_outer_meta.json')).json();
  OHGT = new Float32Array(await (await fetch('assets/site_outer_heights.bin')).arrayBuffer());
  const polar = new THREE.TextureLoader().load('assets/moon_normal_s80_2k.jpg'); polar.colorSpace = THREE.NoColorSpace; polar.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2});
  mat.onBeforeCompile = sh => { sh.uniforms.polarNrm = {value: polar};
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;\nuniform sampler2D polarNrm;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + POLAR_GLSL); };
  gOut = buildTerrain(OMETA, OHGT, rho => rho >= RIN && rho <= ROUT, outTaper, mat);
  capColored = false; gsl.forEach(g => g.p = null);   // recolour both meshes; callouts beyond the fine cap move onto the new ground
}
function colorCap(){   // sample the NASA colour map at each terrain vertex (sRGB -> linear)
  const img = moonTex().image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', {willReadFrequently: true}); cx.drawImage(img, 0, 0); const px = cx.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
  for (const m of [gCap, gOut]){ if (!m) continue; const ll = m.userData.ll, col = m.geometry.attributes.color;
    for (let k = 0; k < col.count; k++){ const lat = ll[k*2], lon = ll[k*2 + 1], u = ((0.5 + lon/360) % 1 + 1) % 1, v = 1 - (lat + 90)/180;
      const o = (Math.min(H - 1, Math.floor(v*H))*W + Math.min(W - 1, Math.floor(u*W)))*4;
      col.setXYZ(k, (px[o]/255)**2.2, (px[o + 1]/255)**2.2, (px[o + 2]/255)**2.2); }
    col.needsUpdate = true; }
  capColored = true;
}
function buildGlobe(){
  globe = new THREE.Scene(); globe.background = new THREE.Color('#000000');
  gCam = new THREE.PerspectiveCamera(35, 1, 0.0005, 100); cams.push(gCam);
  gCtl = new OrbitControls(gCam, renderer.domElement); gCtl.enablePan = false; gCtl.rotateSpeed = 0.5; gCtl.zoomSpeed = 0.8; gCtl.enableDamping = true; gCtl.dampingFactor = 0.08; gCtl.enabled = false;
  const mat = new THREE.MeshStandardMaterial({map: moonTex(), normalMap: moonNrm(), roughness: 1, metalness: 0, side: THREE.DoubleSide});   // inner faces too: a slit at the terrain edge shows grey, not black
  mat.onBeforeCompile = sh => {   // hide the flat globe where the 3D terrain sits (south of 80.3 S, sin = 0.985703; the outer ring reaches ~80.27 S)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;').replace('void main() {', 'void main() {\n  if (normalize(vLoc).y < -0.985703) discard;'); };
  const gGeo = new THREE.SphereGeometry(1, 192, 96); gGeo.computeTangents();   // real tangents: the screen-derivative fallback breaks near the pole (radial streaks)
  gMoon = new THREE.Mesh(gGeo, mat); globe.add(gMoon);
  globe.add(new THREE.AmbientLight('#9AA6B8', 0.08));
  const fill = new THREE.DirectionalLight('#AFC0D8', 0.55); fill.position.set(0, -10, 0); globe.add(fill);   // soft fill from above the south pole (visual only): lifts shadowed ground and the globe equally, so they blend
  gSun = new THREE.DirectionalLight('#FFF4E0', 3.4); gSun.castShadow = true; gSun.shadow.mapSize.set(4096, 4096);
  const sc = gSun.shadow.camera; sc.left = -0.18; sc.right = 0.18; sc.top = 0.18; sc.bottom = -0.18; sc.near = 0.5; sc.far = 2.5;   // +/-313 km: the whole 3D terrain to 80 S (~150 m per shadow texel)
  gSun.shadow.bias = -0.00004; gSun.shadow.normalBias = 0.0001; globe.add(gSun); globe.add(gSun.target);
  const N = 2500, a = new Float32Array(N*3);   // decorative stars
  for (let i = 0; i < N; i++){ const u = Math.random()*2 - 1, t = Math.random()*Math.PI*2, r = Math.sqrt(1 - u*u); a[i*3] = 50*r*Math.cos(t); a[i*3 + 1] = 50*u; a[i*3 + 2] = 50*r*Math.sin(t); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(a, 3));
  globe.add(new THREE.Points(sg, new THREE.PointsMaterial({color: '#8E96A0', size: 1.2, sizeAttenuation: false})));
  buildCap(); buildOuter().catch(e => console.error('Moon view: outer terrain failed to load', e));
  buildCallouts();
  root.querySelectorAll('#gBar button').forEach(b => b.onclick = () => gFocus(b.dataset.g));
  gFocus('pole', null, true);
}
// site callouts: dot on the ground, a thin stem, a name card (click = select the site). Rebuilt when App.sites changes (custom spot).
function buildCallouts(){
  gsl.forEach(g => g.el.remove());
  gsl = App.sites.map((s, i) => { const el = document.createElement('div'); el.className = 'gsite';
    el.innerHTML = '<span class="stem"></span><span class="dot"></span><button type="button" class="card"></button>'; $('#glabels').appendChild(el);
    const card = el.querySelector('.card'); card.textContent = s.custom ? s.short + ' (approximate)' : s.name; card.title = (s.custom ? s.label : s.name) + ': select this site';
    card.onclick = () => { App.set({site: i, selDay: -1}, 'scene'); gFocus('site', i); };
    return {el, stem: el.querySelector('.stem'), card, p: null}; });
}
// camera presets: whole Moon, the south pole (default), or one site; glides over 0.9 s, never through the Moon
function gFocus(kind, i, now){
  const st = App.state, sunD = me2t(App.ephAt(st.jd0 + st.t).sun).normalize();
  let tgt, pos, minD, maxD;
  if (kind === 'moon'){ tgt = new THREE.Vector3(); pos = llv(-45, 0, 3.2); minD = 1.15; maxD = 8; }
  else { const s = kind === 'site' ? App.sites[i] : null, P = s ? surf(s.lat, s.lon) : surf(-90, 0), up = P.clone().normalize();
    const sunH = sunD.clone().addScaledVector(up, -sunD.dot(up)).normalize();   // Sun direction along the ground
    const toward = llv(s ? -40 : -35, s ? s.lon : 0).sub(up.clone().multiplyScalar(up.dot(llv(s ? -40 : -35, s ? s.lon : 0)))).normalize();   // from the equator side of the site
    const dir = up.clone().multiplyScalar(s ? 0.9 : 0.75).addScaledVector(toward, 0.75).addScaledVector(sunH, 0.35).normalize();   // oblique, a little from the Sun side
    tgt = P; pos = P.clone().addScaledVector(dir, s ? 0.05 : 0.095); minD = 0.012; maxD = 4; }
  gPreset = kind; root.querySelectorAll('#gBar button').forEach(b => b.setAttribute('aria-pressed', b.dataset.g === (kind === 'site' ? 'pole' : kind)));
  gCtl.minDistance = 0; gCtl.maxDistance = 100;
  if (now){ gCtl.target.copy(tgt); gCam.position.copy(pos); gCtl.minDistance = minD; gCtl.maxDistance = maxD; gAnim = null; }
  else { gCtl.enableDamping = false; gCtl.update(); gCtl.enableDamping = true; gAnim = {t0: performance.now(), t1: gCtl.target.clone(), p1: gCam.position.clone(), tgt, pos, minD, maxD}; }
}
function updateGlobe(){
  const st = App.state, j = st.jd0 + st.t, p = App.ephAt(j), sunD = me2t(p.sun).normalize(), P0 = new THREE.Vector3(0, -1, 0);
  // light from the real Sun; the shadow box follows what the camera looks at and shrinks with zoom (close-ups keep sharp shadows;
  // the pole view covers the whole 3D terrain to 80 S). Snapped in steps so the shadow map does not shimmer while zooming.
  const camD = gCam.position.distanceTo(gCtl.target), half = Math.min(0.18, Math.max(0.025, Math.pow(2, Math.ceil(Math.log2(camD*1.6)*2)/2)));
  if (gCam.position.length() < 1.6) P0.copy(gCtl.target);
  const sc = gSun.shadow.camera; if (sc.right !== half){ sc.left = sc.bottom = -half; sc.right = sc.top = half; sc.updateProjectionMatrix();
    gSun.shadow.normalBias = half*0.00055; gSun.shadow.bias = -half*0.00022; }   // biases scale with the texel size (0.0001 / -0.00004 at the full 0.18)
  gSun.position.copy(P0).addScaledVector(sunD, 1.5); gSun.target.position.copy(P0);
  const MT = moonTex(); if (!capColored && MT.image && MT.image.complete && MT.image.width) colorCap();
  if (gAnim){ const k0 = Math.min(1, (performance.now() - gAnim.t0)/900), k = k0*k0*(3 - 2*k0);
    gCtl.target.copy(gAnim.t1).lerp(gAnim.tgt, k); gCam.position.copy(gAnim.p1).lerp(gAnim.pos, k);
    if (k0 >= 1){ gCtl.minDistance = gAnim.minD; gCtl.maxDistance = gAnim.maxD; gAnim = null; } }
  gCtl.update();
  if (gCam.position.length() < 1.004) gCam.position.setLength(1.004);   // never inside the Moon
  const camT = gCam.position.distanceTo(gCtl.target); gCam.near = Math.max(0.0002, camT*0.01); gCam.updateProjectionMatrix();
  // callouts: fan out when far (sites crowd near the pole), short stems when close
  const w = root.clientWidth, h = root.clientHeight, vis = [];
  gsl.forEach((g, i) => { const s = App.sites[i]; if (!g.p) g.p = surf(s.lat, s.lon);
    const toCam = gCam.position.clone().sub(g.p), facing = toCam.dot(g.p) > 0, q = g.p.clone().project(gCam);
    g.el.classList.toggle('sel', i === st.site);
    if (!facing || q.z > 1 || Math.abs(q.x) > 1 || Math.abs(q.y) > 1){ g.el.style.display = 'none'; return; }   // off screen: no card (#scene does not clip; a card could land on the tabs or top bar)
    g.el.style.display = ''; g.sx = (q.x*0.5 + 0.5)*w; g.sy = (-q.y*0.5 + 0.5)*h; g.d = toCam.length(); vis.push(g); });
  vis.sort((a, b) => a.sx - b.sx);
  if (!gBars || gBars.w !== w){ const r0 = root.getBoundingClientRect();   // the view tabs and the camera bar: cards must not hide under them (measured once per size)
    gBars = [...root.querySelectorAll('.views, #gBar')].map(e => { const b = e.getBoundingClientRect(); return {x: (b.left + b.right)/2 - r0.left, y: (b.top + b.bottom)/2 - r0.top, w: b.width, h: b.height}; }); gBars.w = w; }
  const boxes = [], bars = gBars.filter(b => b.w);
  vis.forEach((g, k) => { const far = g.d > 0.5, n = vis.length, cw = g.cw || (g.cw = g.card.offsetWidth || 120), ch = g.ch || (g.ch = g.card.offsetHeight || 24);   // measured once, not every frame
    const ang0 = far ? (-150 + (n > 1 ? 120*k/(n - 1) : 60))*D2R : (-90 + (k % 2 ? 22 : -22))*D2R;
    const hit = (bx, by, list) => list.some(b => Math.abs(b.x - bx) < (b.w + cw)/2 + 6 && Math.abs(b.y - by) < (b.h + ch)/2 + 4);
    let ang, L, ex, ey, bx, by;
    for (const a of [ang0, -ang0]){   // try upward first; flip downward if the card would sit under a bar or off the top
      ang = a; L = far ? 92 : 46;
      for (let t = 0; t < 6; t++){   // lengthen the stem until this card clears the ones already placed
        ex = Math.cos(ang)*L; ey = Math.sin(ang)*L; bx = g.sx + ex; by = g.sy + ey + (ey > 0 ? ch/2 : -ch/2);   // downward cards hang below the stem end
        if (!hit(bx, by, boxes)) break; L += ch + 6; }
      if (!hit(bx, by, bars) && by - ch/2 > 0) break; }
    boxes.push({x: bx, y: by, w: cw, h: ch});
    g.el.style.left = g.sx + 'px'; g.el.style.top = g.sy + 'px';
    g.stem.style.width = L + 'px'; g.stem.style.transform = `rotate(${ang}rad)`;
    g.card.style.left = ex + 'px'; g.card.style.top = ey + 'px'; g.el.classList.toggle('down', ey > 0); });
}

register('globe', {
  build: buildGlobe,
  show(on){ $('#glabels').hidden = !on; $('#gBar').hidden = !on; gBars = null; gCtl.enabled = on; },
  frame(){ gCtl.update(); updateGlobe(); renderer.render(globe, gCam); },
  onState(keys, src){
    if (keys.has('spot')) buildCallouts();   // App.sites changed length (custom spot added/removed): indices are stale
    if (keys.has('site') && src !== 'scene' && view === 'globe') gFocus('site', App.state.site);   // site picked elsewhere: glide to it
    if (keys.has('mast')) gsl.forEach(g => g.p = null); },
});
