/* view-moon.js: Moon view ('globe'). OWNER: view-moon session. Registers with scene-core.js.
   Unit sphere, Moon ME frame -> three.js (x, z_north, -y); texture u = 0.5 at lon 0.
   Realism where it matters: the real LOLA terrain (heights.bin, +/-60 km, 240 m, heights x2) sits on the globe as a 3D cap
   around the south pole, lit by the real Sun with real (visual-only) shadows. Elsewhere: NASA SVS colour map.
   The cap takes its colours from the same map, so the join blends. Our sites get callouts; clicking one selects it. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {$, R, D2R, root, renderer, view, meta, HGT, cams, me2t, llv, moonTex, moonNrm, register} from './scene-core.js';

let globe, gCam, gCtl, gSun, gMoon, gCap, capColored = false, gAnim = null, gPreset = null, gsl = [], gBars = null;
const CAPEX = 2, CAPLAT = -88.1;   // vertical exaggeration (same as Landing Site); cap edge ~57 km from the pole, inside the +/-60 km square grid
// height (m) at lat/lon from the terrain grid (polar stereographic, +x toward 90 E, +y toward 0 E)
function capH(lat, lon){ const rho = 2*R*Math.tan((90 + lat)*D2R/2)*1000, x = rho*Math.sin(lon*D2R), y = rho*Math.cos(lon*D2R);
  const i = Math.floor((x - meta.x_min)/meta.pixel_m), j = Math.floor((meta.y_max - y)/meta.pixel_m);
  if (i < 0 || j < 0 || i >= meta.nx || j >= meta.ny) return 0; const h = HGT[j*meta.nx + i]; return isFinite(h) ? h : 0; }
// over the outer 8 km of the cap the heights ease to 0, so the cap edge meets the globe exactly (visual only; all sites sit inside)
const capTaper = rho => { const t = Math.min(1, Math.max(0, (rho - 49)/8)); return 1 - t*t*(3 - 2*t); };
const rhoOf = lat => 2*R*Math.tan((90 + lat)*D2R/2);
const surf = (lat, lon) => llv(lat, lon, 1 + capH(lat, lon)*capTaper(rhoOf(lat))/1000*CAPEX/R);
function buildCap(){
  const nx = meta.nx, ny = meta.ny, n = nx*ny, pos = new Float32Array(n*3), ll = new Float32Array(n*2), keep = new Uint8Array(n), idx = [];
  for (let jy = 0; jy < ny; jy++) for (let ix = 0; ix < nx; ix++){ const k = jy*nx + ix;
    const x = (meta.x_min + (ix + 0.5)*meta.pixel_m)/1000, y = (meta.y_max - (jy + 0.5)*meta.pixel_m)/1000;
    const rho = Math.hypot(x, y), lon = Math.atan2(x, y)/D2R, lat = -90 + 2*Math.atan(rho/(2*R))/D2R;
    let h = HGT[k]; if (!isFinite(h)) h = 0;
    const v = llv(lat, lon, 1 + h*capTaper(rho)/1000*CAPEX/R); pos[k*3] = v.x; pos[k*3 + 1] = v.y; pos[k*3 + 2] = v.z;
    ll[k*2] = lat; ll[k*2 + 1] = lon; keep[k] = lat < CAPLAT ? 1 : 0; }
  for (let jy = 0; jy < ny - 1; jy++) for (let ix = 0; ix < nx - 1; ix++){ const a = jy*nx + ix, b = a + 1, c = a + nx, d = c + 1;
    if (keep[a] || keep[b] || keep[c] || keep[d]){ idx.push(a, c, b, b, c, d);
      for (const q of [a, b, c, d]) if (!keep[q]) keep[q] = 2; } }   // 2 = skirt vertex: folded down under the globe after the normals are computed
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n*3).fill(0.5), 3)); g.setIndex(idx);
  g.computeVertexNormals();
  const mid = (ny >> 1)*nx + (nx >> 1), nrm = g.attributes.normal;   // make sure the normals point outwards (away from the Moon's centre)
  if (nrm.getX(mid)*pos[mid*3] + nrm.getY(mid)*pos[mid*3 + 1] + nrm.getZ(mid)*pos[mid*3 + 2] < 0){ for (let t = 0; t < idx.length; t += 3){ const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; } g.setIndex(idx); g.computeVertexNormals(); }
  // skirt: fold the edge down under the globe so no gap shows; normals stay those of the real terrain (no dark rim)
  for (let q = 0; q < n; q++) if (keep[q] === 2){ const v = llv(ll[q*2], ll[q*2 + 1], 0.985); g.attributes.position.setXYZ(q, v.x, v.y, v.z); }
  gCap = new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2}));
  gCap.castShadow = true; gCap.receiveShadow = true; gCap.userData.ll = ll; globe.add(gCap);
}
function colorCap(){   // sample the NASA colour map at each cap vertex (sRGB -> linear)
  const img = moonTex().image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', {willReadFrequently: true}); cx.drawImage(img, 0, 0); const px = cx.getImageData(0, 0, cv.width, cv.height).data;
  const ll = gCap.userData.ll, col = gCap.geometry.attributes.color, W = cv.width, H = cv.height;
  for (let k = 0; k < col.count; k++){ const lat = ll[k*2], lon = ll[k*2 + 1], u = ((0.5 + lon/360) % 1 + 1) % 1, v = 1 - (lat + 90)/180;
    const o = (Math.min(H - 1, Math.floor(v*H))*W + Math.min(W - 1, Math.floor(u*W)))*4;
    col.setXYZ(k, (px[o]/255)**2.2, (px[o + 1]/255)**2.2, (px[o + 2]/255)**2.2); }
  col.needsUpdate = true; capColored = true;
}
function buildGlobe(){
  globe = new THREE.Scene(); globe.background = new THREE.Color('#000000');
  gCam = new THREE.PerspectiveCamera(35, 1, 0.0005, 100); cams.push(gCam);
  gCtl = new OrbitControls(gCam, renderer.domElement); gCtl.enablePan = false; gCtl.rotateSpeed = 0.5; gCtl.zoomSpeed = 0.8; gCtl.enableDamping = true; gCtl.dampingFactor = 0.08; gCtl.enabled = false;
  const mat = new THREE.MeshStandardMaterial({map: moonTex(), normalMap: moonNrm(), roughness: 1, metalness: 0, side: THREE.DoubleSide});   // inner faces too: a slit at the cap edge shows grey, not black
  // South of 81 S the equirect maps squeeze into a few rows (smeared ring around the cap). There the relief comes from a polar
  // normal map baked from LOLA LDEM_80S_80MPP_ADJ (polar stereographic like heights.bin, +/-304 km = 80 S, ~300 m/px, slopes x2):
  // R = slope along grid +x (toward 90 E), G = along grid +y (toward 0 E), B = up. Blend 81 -> 82 S.
  const polar = new THREE.TextureLoader().load('assets/moon_normal_s80_2k.jpg'); polar.colorSpace = THREE.NoColorSpace; polar.anisotropy = 8;
  mat.onBeforeCompile = sh => {   // hide the flat globe where the 3D terrain cap sits (south of 88.12 S, just inside the cap edge at 88.1 S)
    sh.uniforms.polarNrm = {value: polar};
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;\nuniform sampler2D polarNrm;').replace('void main() {', 'void main() {\n  if (normalize(vLoc).y < -0.999462) discard;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  vec3 n0 = normalize(vLoc);
  float wP = smoothstep(0.98769, 0.99027, -n0.y);   // sin 81 deg -> sin 82 deg
  if (wP > 0.0){
    float k = 2.0*1737.4/(1.0 - n0.y);   // polar stereographic: rho = 2R cos(lat)/(1 - sin(lat)); gx = rho sin(lon), gy = rho cos(lon) (km)
    vec2 uv = (vec2(-n0.z, n0.x)*k + 304.0)/608.0;
    vec3 t = texture2D(polarNrm, uv).xyz*2.0 - 1.0;
    vec3 tx = normalize(vec3(0.0, 0.0, -1.0) - n0*(-n0.z)), ty = normalize(vec3(1.0, 0.0, 0.0) - n0*n0.x);   // grid axes on the ground
    vec3 pn = normalize((viewMatrix*vec4(t.x*tx + t.y*ty + t.z*n0, 0.0)).xyz);
    normal = normalize(mix(normal, pn, wP));
  }`); };
  const gGeo = new THREE.SphereGeometry(1, 192, 96); gGeo.computeTangents();   // real tangents: the screen-derivative fallback breaks near the pole (radial streaks)
  gMoon = new THREE.Mesh(gGeo, mat); globe.add(gMoon);
  globe.add(new THREE.AmbientLight('#9AA6B8', 0.08));
  const fill = new THREE.DirectionalLight('#AFC0D8', 0.55); fill.position.set(0, -10, 0); globe.add(fill);   // soft fill from above the south pole (visual only): lifts shadowed ground and the globe around the cap equally, so they blend
  gSun = new THREE.DirectionalLight('#FFF4E0', 3.4); gSun.castShadow = true; gSun.shadow.mapSize.set(4096, 4096);
  const sc = gSun.shadow.camera; sc.left = -0.06; sc.right = 0.06; sc.top = 0.06; sc.bottom = -0.06; sc.near = 0.5; sc.far = 2.5;
  gSun.shadow.bias = -0.00002; gSun.shadow.normalBias = 0.00004; globe.add(gSun); globe.add(gSun.target);
  const N = 2500, a = new Float32Array(N*3);   // decorative stars
  for (let i = 0; i < N; i++){ const u = Math.random()*2 - 1, t = Math.random()*Math.PI*2, r = Math.sqrt(1 - u*u); a[i*3] = 50*r*Math.cos(t); a[i*3 + 1] = 50*u; a[i*3 + 2] = 50*r*Math.sin(t); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(a, 3));
  globe.add(new THREE.Points(sg, new THREE.PointsMaterial({color: '#8E96A0', size: 1.2, sizeAttenuation: false})));
  buildCap();
  // site callouts: dot on the ground, a thin stem, a name card (click = select the site)
  gsl = App.sites.map((s, i) => { const el = document.createElement('div'); el.className = 'gsite';
    el.innerHTML = '<span class="stem"></span><span class="dot"></span><button type="button" class="card"></button>'; $('#glabels').appendChild(el);
    const card = el.querySelector('.card'); card.textContent = s.name; card.title = s.name + ': select this site';
    card.onclick = () => { App.set({site: i, selDay: -1}, 'scene'); gFocus('site', i); };
    return {el, stem: el.querySelector('.stem'), card, p: null}; });
  root.querySelectorAll('#gBar button').forEach(b => b.onclick = () => gFocus(b.dataset.g));
  gFocus('pole', null, true);
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
  gSun.position.copy(P0).addScaledVector(sunD, 1.5); gSun.target.position.copy(P0);   // light from the real Sun; shadow camera framed on the pole cap
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
    if (keys.has('site') && src !== 'scene' && view === 'globe') gFocus('site', App.state.site);   // site picked elsewhere: glide to it
    if (keys.has('mast')) gsl.forEach(g => g.p = null); },
});
