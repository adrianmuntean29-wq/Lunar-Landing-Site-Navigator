/* view-moon.js: Moon view ('globe'). OWNER: view-moon session. Registers with scene-core.js.
   Unit sphere, Moon ME frame -> three.js (x, z_north, -y); texture u = 0.5 at lon 0.
   Realism where it matters: real LOLA terrain sits on the globe in 3D from the pole to 80 S (fine 240 m cap to 57 km, then a
   1.2 km ring to ~300 km with 300 m relief shading), heights x2, lit by the real Sun with real (visual-only) shadows.
   North of 80.3 S: NASA SVS colour + normal map on a sphere.
   The cap takes its colours from the same map, so the join blends. Our sites get callouts; clicking one selects it. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {$, R, D2R, root, renderer, view, meta, HGT, cams, me2t, llv, moonTex, moonNrm, glowTex, register, tok} from './scene-core.js';

let globe, gCam, gCtl, gSun, gMoon, gCap, gOut = null, capColored = false, gAnim = null, gPreset = null, gsl = [];
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
  normal = normalize((viewMatrix*vec4(t.x*tx + t.y*ty + t.z*n0, 0.0)).xyz);
  float sEdge = smoothstep(190.0, 290.0, k*length(n0.xz));   // cast shadows fade out toward the 80 S edge: the flat globe beyond cannot cast any (no hard ring)`;
// three r160 lights_fragment_begin: the directional shadow term, softened by sEdge (checked against the 0.160.0 build)
const LIGHTS_EDGE = THREE.ShaderChunk.lights_fragment_begin.replace('? getShadow( directionalShadowMap', '? sEdge + (1.0 - sEdge) * getShadow( directionalShadowMap');
if (LIGHTS_EDGE === THREE.ShaderChunk.lights_fragment_begin) console.warn('Moon view: shadow edge fade not applied (three.js chunk changed)');
function halfGrid(M, H){   // 2x2 block mean (NaN-aware) -> a grid with half the points per side, same extent
  const nx = Math.floor(M.nx/2), ny = Math.floor(M.ny/2), out = new Float32Array(nx*ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){ let s = 0, n = 0;
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]){ const v = H[(2*j + b)*M.nx + 2*i + a]; if (isFinite(v)){ s += v; n++; } }
    out[j*nx + i] = n ? s/n : NaN; }
  return [Object.assign({}, M, {nx, ny, pixel_m: M.pixel_m*2}), out]; }
async function buildOuter(){   // 3D terrain ring 57 km -> 80.3 S, so the real shadows reach out to where the flat globe takes over
  OMETA = await (await fetch('assets/site_outer_meta.json')).json();
  OHGT = new Float32Array(await (await fetch('assets/site_outer_heights.bin')).arrayBuffer());
  const polar = new THREE.TextureLoader().load('assets/moon_normal_s80_2k.jpg'); polar.colorSpace = THREE.NoColorSpace; polar.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2});
  mat.onBeforeCompile = sh => { sh.uniforms.polarNrm = {value: polar};
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;\nuniform sampler2D polarNrm;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + POLAR_GLSL).replace('#include <lights_fragment_begin>', LIGHTS_EDGE); };
  const [M2, H2] = halfGrid(OMETA, OHGT);   // mesh at 2.4 km (262k -> 66k points); the relief image keeps the shading detail, capH() keeps the full grid
  gOut = buildTerrain(M2, H2, rho => rho >= RIN && rho <= ROUT, outTaper, mat); gShadowDirty = true;
  capColored = false; gsl.forEach(g => { g.p = null; g.boxSel = null; }); buildZones();   // recolour both meshes; markers beyond the fine cap move onto the new ground
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
  gSun = new THREE.DirectionalLight('#FFF4E0', 3.4); gSun.castShadow = true; gSun.shadow.mapSize.set(2048, 2048);   // was 4096 (Eren ~21:20: page laggy); ~300 m per texel at the full box, softer only up close
  const sc = gSun.shadow.camera; sc.left = -0.18; sc.right = 0.18; sc.top = 0.18; sc.bottom = -0.18; sc.near = 0.5; sc.far = 2.5;   // +/-313 km: the whole 3D terrain to 80 S (~300 m per shadow texel at 2048)
  gSun.shadow.bias = -0.00004; gSun.shadow.normalBias = 0.0001; globe.add(gSun); globe.add(gSun.target);
  const N = 2500, a = new Float32Array(N*3);   // decorative stars
  for (let i = 0; i < N; i++){ const u = Math.random()*2 - 1, t = Math.random()*Math.PI*2, r = Math.sqrt(1 - u*u); a[i*3] = 50*r*Math.cos(t); a[i*3 + 1] = 50*u; a[i*3 + 2] = 50*r*Math.sin(t); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(a, 3));
  globe.add(new THREE.Points(sg, new THREE.PointsMaterial({color: '#8E96A0', size: 1.2, sizeAttenuation: false})));
  buildSunEarth();
  buildCap();
  // Loading screen hook (Eren 2026-11-15 "add loading screen"): once the outer terrain and the Moon textures are in, colour the cap and
  // compile the shaders up front, then set window.__moonReady and fire 'moon-ready' on document. The coordinator's loading screen waits for it.
  const texReady = t => new Promise(res => { const ok = () => t.image && t.image.complete && t.image.width; if (ok()) return res(); const id = setInterval(() => { if (ok()){ clearInterval(id); res(); } }, 100); });
  buildOuter().catch(e => console.error('Moon view: outer terrain failed to load', e))
    .then(() => Promise.all([texReady(moonTex()), texReady(moonNrm())]))
    .then(() => { if (!capColored) colorCap(); try { renderer.compile(globe, gCam); } catch (e) {} })
    .finally(moonReady);
  buildCallouts(); buildZones(); buildPole();
  root.querySelectorAll('#gBar button').forEach(b => b.onclick = () => gFocus(b.dataset.g));
  Object.assign($('#gBar').style, {top: 'auto', bottom: '12px', left: '50%', transform: 'translateX(-50%)'});   // Eren ~22:05: View bar bottom centre (inline: own element; coordinator may move it to scene.css)
  gFocus('pole', null, true);
}
// Sun (disc + glow) and Earth (NASA Blue Marble, lit by the real Sun direction: correct phase; Earth's spin is not modelled here)
const FAR = 90;
let gSunDisc, gSunGlow, gEarth, gSunLab, gEarthLab;
function buildSunEarth(){
  gSunDisc = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({color: '#FFF7E6'})); globe.add(gSunDisc);
  gSunGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex('rgba(255,240,200,0.9)', 'rgba(255,190,90,0.35)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); globe.add(gSunGlow);
  const etex = new THREE.TextureLoader().load('assets/earth_bmng_2k.jpg'); etex.anisotropy = 4;   // raw sRGB values: this shader writes them as is
  gEarth = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({uniforms: {map: {value: etex}, sunDir: {value: new THREE.Vector3(1, 0, 0)}},
    vertexShader: 'varying vec3 vN; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform vec3 sunDir; varying vec3 vN; varying vec2 vUv; void main(){ float l = max(dot(normalize(vN), sunDir), 0.0); gl_FragColor = vec4((texture2D(map, vUv).rgb*1.4 + vec3(0.16, 0.20, 0.30))*(0.02 + 1.1*l), 1.0); }'}));   // + haze: the cloudless map has very dark oceans; the real Earth is bright (clouds, air), so the lit part reads as lit
  globe.add(gEarth);
  const mk = (cls, txt) => { const e = document.createElement('div'); e.className = 'sky ' + cls; e.textContent = txt; e.dataset.name = txt; $('#glabels').appendChild(e); return e; };
  gSunLab = mk('sun', 'Sun'); gEarthLab = mk('earth', 'Earth');
  [[gSunLab, 'sun'], [gEarthLab, 'earth']].forEach(([e, k]) => { e.onclick = () => gFocus(k); e.title = 'Turn the camera to see the ' + (k === 'sun' ? 'Sun' : 'Earth') + ' past the Moon.\nPosition: NASA JPL Horizons.'; });
}
// site markers (Eren ~21:30, 3rd version: "too small", "moves choppy"): a big bright numbered square ON each site point, never nudged.
// Sites closer than ~30 px on screen share ONE marker ("5 | 10"), each number its own button; a pair joins below JOIN px and only splits
// again above KEEP px, so markers do not flicker while the camera moves. Number = App.sites index + 1 (= the panel list).
// Your spot = dashed square with a star. Up close the selected site also gets its real 1 km x 1 km box draped on the terrain.
// Whole-Moon zoom: all sites inside one "N sites" box (click = fly to the pole). Styles inline (own DOM only); tokens from scene.css.
const BOX_KM = 1, MK = 26, JOIN = 30, KEEP = 38;
const PIN_CSS = 'position:absolute;left:0;top:0;display:flex;gap:1px;pointer-events:auto;border-radius:5px;overflow:hidden;background:#111315;' +
  'box-shadow:0 0 0 2px rgba(0,0,0,.8),0 2px 10px rgba(0,0,0,.65);will-change:transform;z-index:1';
const numCss = (sel, spot) => `min-width:${MK}px;height:${MK}px;padding:0 4px;box-sizing:border-box;border:0;margin:0;font:700 14px/${MK}px "IBM Plex Mono";` +
  `text-align:center;cursor:pointer;color:#111315;background:${sel ? 'var(--c-sel)' : '#F2F1EC'};` + (spot ? 'outline:2px dashed #111315;outline-offset:-5px;' : '');
const SRC_SITE = 'Sun and Earth positions: NASA JPL Horizons. Terrain horizon: NASA LOLA (PGDA 90, Barker et al. 2023).', SRC_SPOT = 'Your own spot: coarse terrain, approximate.';
// South pole (Eren 2026-11-15: "add the south pole ... as a straight line coming out of it"): the Moon's spin axis as a straight line
// standing up out of the pole point (~20 km tall, a marker, not to scale), with a "South pole" tag at its top. Tag hidden at whole-Moon zoom.
const POLE_LEN = 0.012;   // ~20 km: the line and its tag stay on screen at pole zoom
let gPole = null, gPoleTag = null, gPoleTop = null;
function buildPole(){
  const base = surf(-90, 0); gPoleTop = base.clone().setLength(base.length() + POLE_LEN);
  gPole = new THREE.Line(new THREE.BufferGeometry().setFromPoints([base, gPoleTop]), new THREE.LineBasicMaterial({color: '#E8EAED', transparent: true, opacity: 0.9}));
  gPole.renderOrder = 3; globe.add(gPole);
  gPoleTag = document.createElement('div'); gPoleTag.textContent = 'South pole';
  gPoleTag.title = 'The Moon\'s south pole (90 deg S). The line is the Moon\'s spin axis.';
  gPoleTag.style.cssText = 'position:absolute;left:0;top:0;font:600 11.5px "IBM Plex Mono";color:var(--c-ink);background:var(--c-box);border:1px solid var(--c-white50);border-radius:4px;padding:2px 7px;white-space:nowrap;pointer-events:auto;cursor:help;will-change:transform';
  $('#glabels').appendChild(gPoleTag); }
let gClus = null, gStem = null, gPins = new Map(), gPrev = new Map();   // gPins: group key -> {el, w}; gPrev: site index -> last group key
function boxLine(s){   // 1 km box in polar stereographic metres around the site, draped on the terrain (lifted ~60 m before exaggeration)
  const r0 = rhoOf(s.lat), x0 = r0*Math.sin(s.lon*D2R), y0 = r0*Math.cos(s.lon*D2R), h = BOX_KM/2, pts = [], N = 8;
  const C = [[-h, -h], [h, -h], [h, h], [-h, h]];
  for (let e = 0; e < 4; e++){ const [ax, ay] = C[e], [bx, by] = C[(e + 1)%4];
    for (let k = 0; k < N; k++){ const x = x0 + ax + (bx - ax)*k/N, y = y0 + ay + (by - ay)*k/N, rho = Math.hypot(x, y);
      const lat = -90 + 2*Math.atan(rho/(2*R))/D2R, lon = Math.atan2(x, y)/D2R, v = surf(lat, lon); pts.push(v.setLength(v.length() + 0.06*CAPEX/R)); } }
  const ln = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color: tok('--sel-3d', '#4FC3F7')}));
  ln.renderOrder = 2; globe.add(ln); return ln; }
// Tudor's zones, label "Flat, smooth terrain (team analysis)" since 2026-11-15 (was "candidate zones"; data/zones.json via App.zones): thin outlines draped on the
// terrain in --zone-3d, no fill. Hidden when App.state.zones === false. Rebuilt on key 'zones' and once the outer terrain has loaded.
// Labels (Eren 2026-11-15 "add labels"): a small purple "Area N" tag at each zone's centre (N = the id the panel line uses) and one key
// line bottom-left with the file's own label. Tags hide at whole-Moon zoom and when the zones layer is off.
let gZones = null, gZoneTags = [], gZoneKey = null;
const ZTAG_CSS = 'position:absolute;left:0;top:0;transform:translate(-50%,-50%);font:600 11px "IBM Plex Mono";color:var(--c-zone);white-space:nowrap;pointer-events:none;' +
  'text-shadow:0 0 3px #000,0 0 3px #000,0 1px 2px #000;will-change:transform';
const ZKEY_CSS = 'position:absolute;left:12px;bottom:12px;display:flex;align-items:center;gap:7px;font:500 11.5px "IBM Plex Mono";color:var(--c-ink);' +
  'background:var(--c-box);border:1px solid var(--c-line);border-radius:5px;padding:4px 9px;pointer-events:none';
function buildZones(){
  if (gZones){ globe.remove(gZones); gZones.traverse(o => o.geometry && o.geometry.dispose()); gZones = null; }
  gZoneTags.forEach(t => t.el.remove()); gZoneTags = []; if (gZoneKey){ gZoneKey.remove(); gZoneKey = null; }
  const Z = App.zones || []; if (!Z.length || App.state.zones === false) return;
  for (const z of Z){ if (!isFinite(z.x) || !isFinite(z.y)) continue; const el = document.createElement('div'); el.style.cssText = ZTAG_CSS; el.textContent = 'flat, smooth area ' + z.id;
    $('#glabels').appendChild(el); const rho = Math.hypot(z.x, z.y)/1000;
    gZoneTags.push({el, id: z.id, p: surf(-90 + 2*Math.atan(rho/(2*R))/D2R, Math.atan2(z.x, z.y)/D2R)}); }
  gZoneKey = document.createElement('div'); gZoneKey.style.cssText = ZKEY_CSS;
  gZoneKey.innerHTML = '<span style="display:inline-block;width:14px;height:9px;border:1.5px solid var(--c-zone);border-radius:3px"></span>' + ((App.zonesJson && App.zonesJson.label) || 'Flat, smooth terrain (team analysis)');
  $('#glabels').appendChild(gZoneKey);
  // DRAFT styles (Eren 2026-11-15 "3 drafts of how the landing areas look"): ?zs=1 soft fill, ?zs=2 dashed outline, ?zs=3 focus on the
  // area nearest the selected site. No flag = the current thin outline. The fills are a map overlay (drawn over the terrain, not hidden by hills).
  const ZS = +(new URLSearchParams(location.search).get('zs') || 0), col = tok('--zone-3d', '#B49DDC');
  const sel = App.sites[App.state.site], near = ZS === 3 && sel && App.zoneAt ? App.zoneAt(sel.lat, sel.lon) : null;
  gZones = new THREE.Group();
  const toV = (x, y, lift = 0.08) => { const rho = Math.hypot(x, y)/1000, lat = -90 + 2*Math.atan(rho/(2*R))/D2R, lon = Math.atan2(x, y)/D2R, v = surf(lat, lon); return v.setLength(v.length() + lift*CAPEX/R); };
  for (const z of Z){ const focus = ZS === 3 && near && z.id === near.id;
    const lineMat = ZS === 2 ? new THREE.LineDashedMaterial({color: col, dashSize: 0.0011, gapSize: 0.0007, transparent: true, opacity: 1})
      : new THREE.LineBasicMaterial({color: ZS === 3 && focus ? '#E3D4FF' : col, transparent: true, opacity: ZS === 3 ? (focus ? 1 : 0.35) : 0.9});
    const fill = ZS === 1 ? 0.22 : ZS === 3 && focus ? 0.32 : 0;
    for (const ring of z.rings || []){ const pts = [];
      for (let k = 0; k < ring.length; k++){ const [ax, ay] = ring[k], [bx, by] = ring[(k + 1)%ring.length], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)/800));   // a point every <= 800 m: follows the ground
        for (let t = 0; t < n; t++) pts.push(toV(ax + (bx - ax)*t/n, ay + (by - ay)*t/n)); }
      const ln = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat); ln.renderOrder = 4; if (ZS === 2) ln.computeLineDistances(); gZones.add(ln);
      if (fill){   // flat fill: triangulate the ring in the polar plane, lift every corner onto the ground
        const flat = ring.map(([x, y]) => new THREE.Vector2(x, y)), tri = THREE.ShapeUtils.triangulateShape(flat, []), pos = [];
        tri.forEach(t => t.forEach(k => { const v = toV(ring[k][0], ring[k][1], 0.3); pos.push(v.x, v.y, v.z); }));
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: fill, depthTest: false, depthWrite: false, side: THREE.DoubleSide}));
        m.renderOrder = 3; gZones.add(m); } } }
  globe.add(gZones); }
function pickSite(i){ App.set({site: i, selDay: -1}, 'scene'); gFocus('site', i); }
// Anchors (Eren via view-site, 2026-11-15: "it changes, doesn't look right"): every site always has a small dot at its TRUE position;
// numbers that would overlap share a strip placed just above the group, with a thin line from each number to its own dot.
// Whole-Moon zoom: one "N sites ›" tag on a short stem to the cluster centre. No "Detail" button (the panel's Plan button opens Landing Site).
const DOT_CSS = 'position:absolute;left:0;top:0;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;box-shadow:0 0 0 1.5px #111315;pointer-events:none;will-change:transform';
const LD_CSS = 'position:absolute;left:0;top:0;height:1.5px;margin-top:-0.75px;transform-origin:0 50%;pointer-events:none;will-change:transform';
const CTAG_CSS = 'position:absolute;left:0;top:0;font:600 12.5px "IBM Plex Mono";color:var(--c-ink);background:var(--c-box);border:1px solid var(--c-white50);border-radius:5px;' +
  'padding:4px 10px;cursor:pointer;pointer-events:auto;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.6);z-index:1';
function buildCallouts(){
  gsl.forEach(g => { if (g.box){ globe.remove(g.box); g.box.geometry.dispose(); } if (g.dot) g.dot.remove(); if (g.ld) g.ld.remove(); });
  gPins.forEach(v => v.el.remove()); gPins.clear(); gPrev.clear();
  gsl = App.sites.map(() => { const dot = document.createElement('div'), ld = document.createElement('div');
    dot.style.cssText = DOT_CSS; ld.style.cssText = LD_CSS; $('#glabels').append(ld, dot); return {p: null, box: null, boxSel: null, dot, ld}; });
  if (!gStem){ gStem = document.createElement('div'); gStem.style.cssText = LD_CSS + ';background:var(--c-white70)'; $('#glabels').appendChild(gStem); }
  if (!gClus){ gClus = document.createElement('button'); gClus.type = 'button'; gClus.style.cssText = CTAG_CSS;
    gClus.title = 'All landing sites are near the south pole: click to fly there'; gClus.onclick = () => gFocus('pole'); $('#glabels').appendChild(gClus); }
  gClus.textContent = App.sites.length + ' sites ›';
}
function pinFor(key, members, sel){   // one marker element per group; rebuilt only when its members or the selection inside it change
  const id = key + '|' + (members.includes(sel) ? sel : -1); let v = gPins.get(key);
  if (v && v.id === id) return v;
  if (!v){ const el = document.createElement('div'); el.style.cssText = PIN_CSS; $('#glabels').appendChild(el); v = {el}; gPins.set(key, v); }
  v.id = id; v.el.innerHTML = '';
  members.forEach(i => { const s = App.sites[i], b = document.createElement('button'); b.type = 'button';
    b.style.cssText = numCss(i === sel, s.custom); b.textContent = s.custom ? '★' : String(i + 1);
    b.title = (s.custom ? 'Your spot (' + s.label + ')' : (i + 1) + '. ' + s.name) + ': click to select.\n' + SRC_SITE + (s.custom ? '\n' + SRC_SPOT : '');   // source on hover (Eren 2026-11-15)
    b.setAttribute('aria-label', b.title);
    b.onclick = () => pickSite(i); v.el.appendChild(b); });
  v.w = members.length*MK + (members.length - 1); return v; }
// camera presets: whole Moon, the south pole (default), or one site; glides over 0.9 s, never through the Moon
function gFocus(kind, i, now){
  const st = App.state, sunD = me2t(App.ephAt(st.jd0 + st.t).sun).normalize();
  let tgt, pos, minD, maxD, minP = 0;
  if (kind === 'moon'){ tgt = new THREE.Vector3(); pos = llv(-62, 0, 3.2);   // from further south (was -45): the pole and its "N sites" tag sit clear of the bottom View bar
    minD = 1.15; maxD = 8; }
  else if (kind === 'sun' || kind === 'earth'){   // look past the Moon toward the body: it shows beside the Moon (~9 deg clear of the limb), at its true size
    const p = App.ephAt(st.jd0 + st.t), d = me2t(kind === 'sun' ? p.sun : p.earth).normalize(), side = new THREE.Vector3(0, 1, 0).cross(d).normalize();
    tgt = new THREE.Vector3(); pos = d.clone().multiplyScalar(-6).addScaledVector(side, 2.0).addScaledVector(new THREE.Vector3(0, -1, 0), 0.6); minD = 1.15; maxD = 8; }   // a little from the south: the pole sites stay in view
  else { const s = kind === 'site' ? App.sites[i] : null; let P = s ? surf(s.lat, s.lon) : surf(-90, 0), far = 0.095;
    if (!s){   // South pole preset frames every site (the outer ones sit ~180 km from the pole): aim at their middle, back off to fit
      const vs = App.sites.map(q => surf(q.lat, q.lon)), c = vs.reduce((a, v) => a.add(v), new THREE.Vector3()).normalize();
      P = surf(Math.asin(c.y)/D2R, Math.atan2(-c.z, c.x)/D2R); const rMax = Math.max(...vs.map(v => v.distanceTo(P)));
      far = Math.max(0.095, 0.6*rMax/Math.tan(gCam.fov*D2R/2)/Math.min(1, gCam.aspect)); }
    const up = P.clone().normalize();
    const sunH = sunD.clone().addScaledVector(up, -sunD.dot(up)).normalize();   // Sun direction along the ground
    const toward = llv(s ? -40 : -35, s ? s.lon : 0).sub(up.clone().multiplyScalar(up.dot(llv(s ? -40 : -35, s ? s.lon : 0)))).normalize();   // from the equator side of the site
    const dir = up.clone().multiplyScalar(s ? 0.9 : 2.0).addScaledVector(toward, 0.75).addScaledVector(sunH, 0.35).normalize();   // oblique, a little from the Sun side
    tgt = P; pos = P.clone().addScaledVector(dir, s ? 0.05 : far); minD = 0.017; maxD = 4; minP = (90 + 30)*D2R; }   // close-up limit: ~30 km and >= 30 deg above the horizon (240 m grid; detail = Landing Site view)
  gPreset = kind; root.querySelectorAll('#gBar button').forEach(b => b.setAttribute('aria-pressed', b.dataset.g === (kind === 'site' ? 'pole' : kind)));
  gCtl.minDistance = 0; gCtl.maxDistance = 100; gCtl.minPolarAngle = 0;
  if (now){ gCtl.target.copy(tgt); gCam.position.copy(pos); gCtl.minDistance = minD; gCtl.maxDistance = maxD; gCtl.minPolarAngle = minP; gAnim = null; }
  else { gCtl.enableDamping = false; gCtl.update(); gCtl.enableDamping = true; gAnim = {t0: performance.now(), t1: gCtl.target.clone(), p1: gCam.position.clone(), tgt, pos, minD, maxD, minP}; }
}
let gShadow = {}, gShadowDirty = true, gShadowDraws = 0;
function updateGlobe(){
  const st = App.state, j = st.jd0 + st.t, p = App.ephAt(j), sunD = me2t(p.sun).normalize(), P0 = new THREE.Vector3(0, -1, 0);
  // light from the real Sun; the shadow box follows what the camera looks at and shrinks with zoom (close-ups keep sharp shadows;
  // the pole view covers the whole 3D terrain to 80 S). Snapped in steps so the shadow map does not shimmer while zooming.
  const camD = gCam.position.distanceTo(gCtl.target), half = Math.min(0.18, Math.max(0.025, Math.pow(2, Math.ceil(Math.log2(camD*1.6)*2)/2)));
  if (gCam.position.length() < 1.6) P0.copy(gCtl.target);
  // Shadows are drawn ONCE and reused (Eren 2026-11-15: "laggy"; MEASURED 1.95 M triangles/frame, half of it the shadow pass). The shadow
  // map and the light are only redrawn/moved when the Sun turns > 0.02 deg, the zoom step changes, the shadow centre moves > 1/4 box,
  // or the terrain changed. Dragging the camera reuses the map.
  const sc = gSun.shadow.camera, sh = gShadow;
  const moveSun = gShadowDirty || !sh.sun || sh.half !== half || sh.sun.angleTo(sunD) > 0.02*D2R || sh.p0.distanceTo(P0) > half*0.25;
  if (moveSun){
    if (sc.right !== half){ sc.left = sc.bottom = -half; sc.right = sc.top = half; sc.updateProjectionMatrix();
      gSun.shadow.normalBias = half*0.00055; gSun.shadow.bias = -half*0.00022; }   // biases scale with the texel size (0.0001 / -0.00004 at the full 0.18)
    gSun.position.copy(P0).addScaledVector(sunD, 1.5); gSun.target.position.copy(P0); gSun.target.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = true; gShadowDirty = false; gShadowDraws++;
    gShadow = {sun: sunD.clone(), half, p0: P0.clone()}; }
  const MT = moonTex(); if (!capColored && MT.image && MT.image.complete && MT.image.width) colorCap();
  if (gAnim){ const k0 = Math.min(1, (performance.now() - gAnim.t0)/900), k = k0*k0*(3 - 2*k0);
    gCtl.target.copy(gAnim.t1).lerp(gAnim.tgt, k); gCam.position.copy(gAnim.p1).lerp(gAnim.pos, k);
    if (k0 >= 1){ gCtl.minDistance = gAnim.minD; gCtl.maxDistance = gAnim.maxD; gCtl.minPolarAngle = gAnim.minP; gAnim = null; } }
  gCtl.update();
  if (gCam.position.length() < 1.004) gCam.position.setLength(1.004);   // never inside the Moon
  const camT = gCam.position.distanceTo(gCtl.target); gCam.near = Math.max(0.0002, camT*0.01); gCam.updateProjectionMatrix();
  const w = root.clientWidth, h = root.clientHeight, vis = [];
  // Sun and Earth: true direction and true apparent size as seen from the camera (JPL ephemeris, km), drawn 90 units away
  // (inside the camera's far plane), so the Moon hides them correctly. Earth's phase follows the real Sun. Name labels only.
  const cp = gCam.position, sunT = me2t(p.sun).multiplyScalar(1/1737.4), earthT = me2t(p.earth).multiplyScalar(1/1737.4);
  const place = (o, P, rad) => { const d = P.clone().sub(cp), L = d.length(); o.position.copy(cp).addScaledVector(d, FAR/L); o.scale.setScalar(rad*FAR/L); };
  place(gSunDisc, sunT, 695700/1737.4); gSunGlow.position.copy(gSunDisc.position); gSunGlow.scale.setScalar(gSunDisc.scale.x*16);
  place(gEarth, earthT, 6371/1737.4); gEarth.material.uniforms.sunDir.value.copy(sunT).sub(earthT).normalize();
  const label = (el, o, dy) => { const q = o.position.clone().project(gCam), d = o.position.clone().sub(cp).normalize(), name = el.dataset.name;
    const b = cp.dot(d), hidden = b < 0 && cp.lengthSq() - b*b < 1;   // the line of sight passes through the Moon
    el.style.display = '';
    if (q.z <= 1 && Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1){   // on screen: name under the body, or "behind the Moon"
      el.classList.remove('edge'); const txt = hidden ? name + ' (behind the Moon)' : name; if (el.textContent !== txt) el.textContent = txt;
      el.style.left = (q.x*0.5 + 0.5)*w + 'px'; el.style.top = (-q.y*0.5 + 0.5)*h + dy + 'px'; return; }
    // off screen: a small tag at the screen edge with an arrow pointing the way to turn (camera-space direction)
    const v = o.position.clone().applyMatrix4(gCam.matrixWorldInverse); let x = v.x, y = v.y; if (!x && !y) x = 1;
    const sx = (w/2 - 70)/Math.abs(x || 1e-9), sy = (h/2 - 70)/Math.abs(y || 1e-9), s = Math.min(sx, sy);   // inset: clear of the tabs and bars
    const html = `<span class="ar" style="display:inline-block;transform:rotate(${Math.atan2(-y, x).toFixed(2)}rad)">➜</span> ${name}`;
    el.classList.add('edge'); if (el.innerHTML !== html) el.innerHTML = html;   // DOM write only when the arrow turns
    el.style.left = (w/2 + x*s) + 'px'; el.style.top = (h/2 - y*s) + 'px'; };
  label(gSunLab, gSunDisc, 16); label(gEarthLab, gEarth, 16);
  // markers: projected site points -> groups (join < JOIN px, stay joined < KEEP px) -> one big marker per group at the group's centre
  const S = (el, k, v) => { if (el.style[k] !== v) el.style[k] = v; };   // DOM write only on change
  gsl.forEach((g, i) => { const s = App.sites[i], sel = i === st.site; if (!g.p) g.p = surf(s.lat, s.lon);
    if (sel && (!g.box || g.boxSel !== true)){ if (g.box){ globe.remove(g.box); g.box.geometry.dispose(); } g.box = boxLine(s); g.boxSel = true; }
    if (!sel && g.box){ globe.remove(g.box); g.box.geometry.dispose(); g.box = null; g.boxSel = null; }
    const facing = gCam.position.clone().sub(g.p).dot(g.p) > 0, q = g.p.clone().project(gCam);
    if (!facing || q.z > 1 || Math.abs(q.x) > 1 || Math.abs(q.y) > 1){ if (g.box) g.box.visible = false; return; }
    g.x = (q.x*0.5 + 0.5)*w; g.y = (-q.y*0.5 + 0.5)*h; g.i = i; vis.push(g);
    if (g.box){ const bp = g.box.geometry.attributes.position, c0 = new THREE.Vector3().fromBufferAttribute(bp, 0).project(gCam), c2 = new THREE.Vector3().fromBufferAttribute(bp, 16).project(gCam);
      g.box.visible = Math.hypot((c2.x - c0.x)*w, (c2.y - c0.y)*h)/2/Math.SQRT2 > MK + 6; } });   // only once the real box is bigger than the marker
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; vis.forEach(g => { x0 = Math.min(x0, g.x); x1 = Math.max(x1, g.x); y0 = Math.min(y0, g.y); y1 = Math.max(y1, g.y); });
  const clus = vis.length > 1 && Math.max(x1 - x0, y1 - y0) < 70;   // whole-Moon zoom
  const at = (el, x, y, extra = '') => S(el, 'transform', `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)` + extra);
  const line = (el, ax, ay, bx, by) => { const L = Math.hypot(bx - ax, by - ay); S(el, 'width', L.toFixed(1) + 'px'); at(el, ax, ay, ` rotate(${Math.atan2(by - ay, bx - ax).toFixed(3)}rad)`); };
  // whole Moon: one tag on a stem, nothing else
  S(gClus, 'display', clus ? '' : 'none'); S(gStem, 'display', clus ? '' : 'none');
  if (clus){ const cx = (x0 + x1)/2, cy = (y0 + y1)/2, ty = cy - 46; line(gStem, cx, cy, cx, ty + 12); at(gClus, cx, ty, ' translate(-50%,-50%)'); }
  if (gZoneKey) S(gZoneKey, 'display', clus ? 'none' : '');
  // dots: every visible site, true position (hidden at whole-Moon zoom)
  gsl.forEach(g => { const on = !clus && vis.includes(g); S(g.dot, 'display', on ? '' : 'none'); S(g.ld, 'display', 'none');
    if (on){ S(g.dot, 'background', g.i === st.site ? 'var(--c-sel)' : '#F2F1EC'); at(g.dot, g.x, g.y); } });
  // union-find over close pairs; KEEP (looser) for pairs that were together last frame: no flicker at the threshold
  const par = vis.map((_, k) => k), find = k => par[k] === k ? k : (par[k] = find(par[k]));
  if (!clus) for (let a = 0; a < vis.length; a++) for (let b = a + 1; b < vis.length; b++){ const A = vis[a], B = vis[b];
    const lim = gPrev.get(A.i) && gPrev.get(A.i) === gPrev.get(B.i) ? KEEP : JOIN;
    if (Math.hypot(A.x - B.x, A.y - B.y) < lim) par[find(a)] = find(b); }
  const groups = new Map(); if (!clus) vis.forEach((g, k) => { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(g); });
  const used = new Set(); gPrev.clear();
  // pass 1: single sites sit on their points (these rectangles are taken); pass 2: strips try above, below, then further out,
  // and take the first spot that covers no other marker (14 sites, 2026-11-15: a strip covered marker 14)
  const taken = [], hits = (x, y, wd) => taken.some(r => x < r.x + r.w + 3 && r.x < x + wd + 3 && y < r.y + MK + 3 && r.y < y + MK + 3);
  const strips = [];
  groups.forEach(gs => { gs.sort((a, b) => a.i - b.i); const members = gs.map(g => g.i), key = members.join(','), v = pinFor(key, members, st.site);
    used.add(key); members.forEach(i => gPrev.set(i, key)); S(v.el, 'display', '');
    if (gs.length === 1){ const g = gs[0]; at(v.el, g.x - MK/2, g.y - MK/2); taken.push({x: g.x - MK/2, y: g.y - MK/2, w: MK}); return; }
    strips.push([gs, v]); });
  strips.forEach(([gs, v]) => {   // a line from each number in the strip to its own dot
    const cx = gs.reduce((a, g) => a + g.x, 0)/gs.length, top = Math.min(...gs.map(g => g.y)), bot = Math.max(...gs.map(g => g.y)), left = cx - v.w/2;
    const cand = [[top - 22 - MK, true], [bot + 22, false], [top - 54 - MK, true], [bot + 54, false]].filter(([y]) => y > 48 && y + MK < h - 8);
    const [sy, up] = cand.find(([y]) => !hits(left, y, v.w)) || cand[0] || [top - 22 - MK, true];
    at(v.el, left, sy); taken.push({x: left, y: sy, w: v.w});
    gs.forEach((g, k) => { const bx = left + k*(MK + 1) + MK/2, by = up ? sy + MK : sy;
      S(g.ld, 'display', ''); S(g.ld, 'background', g.i === st.site ? 'var(--c-sel)' : 'rgba(242,241,236,.55)'); line(g.ld, bx, by, g.x, g.y); }); });
  gPins.forEach((v, key) => { if (!used.has(key)) S(v.el, 'display', 'none'); });
  // Declutter (Eren ~11:50): every other label goes only where it touches no site marker or strip, else it is hidden.
  const free = (x, y, wd, ht) => !taken.some(r => x < r.x + r.w + 4 && r.x < x + wd + 4 && y < r.y + MK + 4 && r.y < y + ht + 4);
  const onScr = q => q.z <= 1 && Math.abs(q.x) <= 0.97 && Math.abs(q.y) <= 0.97, pxOf = q => [(q.x*0.5 + 0.5)*w, (-q.y*0.5 + 0.5)*h];
  const tw = el => el.textContent.length*7 + 16;   // label width estimate (12 px mono + padding), no layout read per frame
  // one area tag: the flat, smooth area nearest the selected site (same rule as Landing Site); the other areas keep outlines only
  const sel = App.sites[st.site], zn = !clus && sel && App.zoneAt ? App.zoneAt(sel.lat, sel.lon) : null;
  gZoneTags.forEach(t => { let on = false;
    if (zn && t.id === zn.id && gCam.position.clone().sub(t.p).dot(t.p) > 0){ const q = t.p.clone().project(gCam);
      if (onScr(q)){ const [x, y] = pxOf(q), wd = tw(t.el); on = free(x - wd/2, y - 8, wd, 16);
        if (on){ S(t.el, 'transform', `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%)`); taken.push({x: x - wd/2, y: y - 8, w: wd}); } } }
    S(t.el, 'display', on ? '' : 'none'); });
  if (gPoleTag){ const q = gPoleTop.clone().project(gCam); let on = !clus && onScr(q);
    if (on){ const [x, y] = pxOf(q), wd = tw(gPoleTag);   // above the line top, else to its right, else left, else below; hidden if all are taken
      const c = [[x - wd/2, y - 26], [x + 8, y - 11], [x - wd - 8, y - 11], [x - wd/2, y + 6]].find(([cx, cy]) => free(cx, cy, wd, 22));
      on = !!c; if (on){ S(gPoleTag, 'transform', `translate3d(${c[0].toFixed(1)}px,${c[1].toFixed(1)}px,0)`); taken.push({x: c[0], y: c[1], w: wd}); } }
    S(gPoleTag, 'display', on ? '' : 'none'); }
  // Sun / Earth sky tags (placed earlier by label()): hidden for this frame if they would sit on a marker
  for (const el of [gSunLab, gEarthLab]){ if (el.style.display === 'none') continue;
    const x = parseFloat(el.style.left), y = parseFloat(el.style.top), wd = tw(el), edge = el.classList.contains('edge');
    if (!free(x - wd/2, edge ? y - 11 : y, wd, 22)) el.style.display = 'none'; }
}

// draw only when something changed (Eren ~21:20: page laggy). Redraw when: the camera moved (drag, damping, glide), app state changed,
// the canvas resized, or once a second anyway (textures and terrain load in the background). Idle = ~1 frame per second, not 60.
let gDirty = true, gLastDraw = 0, gSize = '', gHot = 0, gSaved = null;
let gDraws = 0;
function drawGlobe(){ updateGlobe(); renderer.render(globe, gCam); gDirty = false; gLastDraw = performance.now(); gDraws++; }
// loading-screen flag: set once (terrain + textures + shaders ready, a failed build, or no WebGL at all). Build runs at boot for every
// opening view, so the flag does not depend on the Moon view being shown.
function moonReady(){ if (window.__moonReady) return; window.__moonReady = true; document.dispatchEvent(new CustomEvent('moon-ready')); }
try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) moonReady(); } catch (e){ moonReady(); }   // no WebGL: release at once
register('globe', {
  build(){ try { buildGlobe(); } catch (e){ console.error('Moon view: build failed', e); moonReady(); } },   // a failed build must not hold the loading screen
  show(on){ $('#glabels').hidden = !on; $('#gBar').hidden = !on; gCtl.enabled = on; gDirty = true;
    // shared renderer: while the Moon view is on, shadows update only on demand (see updateGlobe) and use the standard PCF filter
    // (was PCFSoft: per-pixel cost); both restored for the other views when it hides
    const smap = renderer.shadowMap;
    if (on){ gSaved = {auto: smap.autoUpdate, type: smap.type}; smap.autoUpdate = false; smap.type = THREE.PCFShadowMap; gShadowDirty = true; }
    else if (gSaved){ smap.autoUpdate = gSaved.auto; smap.type = gSaved.type; gSaved = null; } },
  frame(){ const moved = gCtl.update(), size = root.clientWidth + 'x' + root.clientHeight;
    if (moved || gAnim || gDirty || size !== gSize) gHot = 30;   // keep drawing ~0.5 s after the last change: the damping tail ends smoothly
    if (gHot > 0 || performance.now() - gLastDraw > 1000){ gHot = Math.max(0, gHot - 1); gSize = size; drawGlobe(); } },
  onState(keys, src){
    gDirty = true;
    if (keys.has('spot')) buildCallouts();   // App.sites changed length (custom spot added/removed): indices are stale
    if (keys.has('zones') || (keys.has('site') && new URLSearchParams(location.search).get('zs') === '3')) buildZones();
    if (keys.has('site') && src !== 'scene' && view === 'globe') gFocus('site', App.state.site);   // site picked elsewhere: glide to it
    if (keys.has('mast')) gsl.forEach(g => { g.p = null; g.boxSel = null; }); },
});
// test hook (only with ?debug in the URL): draw Moon-view frames on demand, e.g. while the browser pane is hidden and rAF is paused
if (new URLSearchParams(location.search).has('debug')){ window.__moonFrames = (n = 1) => { for (let i = 0; i < n; i++){ gCtl.update(); updateGlobe(); renderer.render(globe, gCam); } };
  window.__moonCam = () => ({d: +gCam.position.distanceTo(gCtl.target).toFixed(4), pos: gCam.position.toArray().map(v => +v.toFixed(4)), tgt: gCtl.target.toArray().map(v => +v.toFixed(4)), anim: !!gAnim, draws: gDraws, shadowDraws: gShadowDraws,
    sites: gsl.map((g, i) => { const q = g.p ? g.p.clone().project(gCam) : null; return q ? [i + 1, +q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(3)] : [i + 1]; })}); }
