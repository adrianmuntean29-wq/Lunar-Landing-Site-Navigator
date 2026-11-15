/* view-ground.js: Ground Level view ('ground'). OWNER: view-ground session. Registers with scene-core.js.
   Stand at the site: real Sun and Earth (true size, position, Earth phase) over the site's exact 360-bin mask horizon. */
import * as THREE from 'three';
import {$, D2R, renderer, view, cams, glowTex, register, tok} from './scene-core.js';

let groundTex = null;   // generated regolith normal map lit by the real Sun (Eren 14 Nov ~21:00; mission pins and the permanent-shadow strip removed from this view)
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
  earthBall = new THREE.Mesh(new THREE.SphereGeometry(DSKY*Math.tan(0.95*D2R), 48, 24), new THREE.MeshStandardMaterial({roughness: 0.8, metalness: 0,
    map: (() => { const t = new THREE.TextureLoader().load('assets/earth_bmng_2k.jpg'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })()}));   // NASA Blue Marble NG (same file as Orbit)
  sky.add(earthBall); sky.add(new THREE.AmbientLight('#ffffff', 0.025));
  skyLight = new THREE.DirectionalLight('#FFFFFF', 3.2); sky.add(skyLight); sky.add(skyLight.target);
  // ghost outline = where a body sits while (part of) it is behind the terrain; drawn over the terrain, same true size as the body
  const ghost = (deg, color) => { const r = DSKY*Math.tan(deg*D2R), m = new THREE.Mesh(new THREE.RingGeometry(r*0.86, r, 64),
    new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false, side: THREE.DoubleSide}));
    m.renderOrder = 10; m.visible = false; sky.add(m); return m; };
  sunGhost = ghost(0.2666, tok('--sun-3d', '#E0BC66')); earthGhost = ghost(0.95, tok('--earth-3d', '#6FA6D8'));   // project palette, on-3D variants
  const cv = renderer.domElement; let drag = null;
  cv.addEventListener('pointerdown', e => { if (view !== 'ground') return; drag = {x: e.clientX, y: e.clientY, yaw: look.yaw, pitch: look.pitch}; });
  addEventListener('pointermove', e => { if (!drag) return; const k = look.fov/cv.clientHeight; look.yaw = drag.yaw - (e.clientX - drag.x)*k; look.pitch = Math.max(-30, Math.min(60, drag.pitch + (e.clientY - drag.y)*k)); });
  addEventListener('pointerup', () => drag = null);
  cv.addEventListener('wheel', e => { if (view !== 'ground') return; e.preventDefault(); look.fov = Math.max(4, Math.min(80, look.fov*Math.exp(e.deltaY*0.001))); }, {passive: false});
  $('#lookSun').onclick = () => lookAt('sun'); $('#lookEarth').onclick = () => lookAt('earth');
  // sources (i) for everything drawn here (shared .info-wrap pattern from base.css; opens upward, the bar sits at the bottom)
  const w = document.createElement('span'); w.className = 'info-wrap';
  w.innerHTML = '<button type="button" class="info-i" aria-label="Sources for this view" aria-describedby="gSrcTip">i</button><span class="info-tip up" id="gSrcTip" role="tooltip"></span>';
  $('#sitebar').appendChild(w); srcTip();
}
function srcTip(){
  const t = $('#gSrcTip'), s = App.sites[App.state.site]; if (!t || !s) return;
  t.textContent = 'Sources. Sun and Earth positions: NASA JPL Horizons ephemeris (6-hour table), seen from this spot. ' +
    'Terrain line: horizon computed by our engine from NASA LOLA terrain (PGDA product 90) at the chosen mast height' +
    (s.custom ? ', approximate for your own spot (' + (s.label || 'coarse terrain') + ').' : '.') +
    ' Earth image: NASA Blue Marble. Ground texture and its lighting: illustration only, not this site\'s measured ground.';
}
/* Ground surface: a generated regolith height field (tileable 512 px: soft multi-scale bumps, ~700 small craters with raised rims, scattered
   pebbles), turned into a normal map and LIT BY THE REAL SUN DIRECTION in the shader, so the low polar Sun brings out the relief. Looks only:
   NOT this site's measured ground (no data exists at this scale); the horizon line itself is the engine mask. Per-pixel ground-plane mapping
   from a 2 m eye (distance from the depression angle below the ridge), two scales mixed to hide tiling, fading to flat grey with distance. */
const EYE_M = 2, TILE_A = 7, TILE_B = 43, FAR_M = 6000;
function regolithTex(){
  const N = 512, H = new Float32Array(N*N), A = new Float32Array(N*N);
  let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
  const octave = (P, amp, out) => { const g = new Float32Array(P*P).map(rnd), sm = t => t*t*(3 - 2*t);
    const G = (i, j) => g[((j % P + P) % P)*P + ((i % P + P) % P)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ const fx = x/N*P, fy = y/N*P, ix = Math.floor(fx), iy = Math.floor(fy), u = sm(fx - ix), v = sm(fy - iy);
      out[y*N + x] += amp*((G(ix, iy)*(1 - u) + G(ix + 1, iy)*u)*(1 - v) + (G(ix, iy + 1)*(1 - u) + G(ix + 1, iy + 1)*u)*v); } };
  [[4, 9], [8, 5], [16, 3], [32, 1.6], [64, 0.8], [128, 0.45], [256, 0.25]].forEach(([P, a]) => octave(P, a, H));
  [[4, 1], [16, 0.5], [64, 0.25]].forEach(([P, a]) => octave(P, a, A));
  const stamp = (cx, cy, r, f) => { const R = Math.ceil(r*1.8);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++){ const q = Math.hypot(dx, dy)/r; if (q > 1.8) continue;
      const i = ((Math.round(cy) + dy + N) % N)*N + ((Math.round(cx) + dx + N) % N); H[i] += f(q); } };
  for (let k = 0; k < 700; k++){ const r = Math.min(70, 1.5*Math.pow(1 - rnd(), -1/1.4)), d = 0.22*r, rim = 0.06*r;   // power-law sizes: many small, few big
    stamp(rnd()*N, rnd()*N, r, q => q < 1 ? d*(q*q - 1) + rim : rim*Math.exp(-(((q - 1)/0.3)**2))); }
  for (let k = 0; k < 1500; k++){ const r = 0.6 + rnd()*1.6; stamp(rnd()*N, rnd()*N, r, q => q < 1 ? 0.9*r*Math.sqrt(1 - q*q) : 0); }   // pebbles
  // texture channels: R,G = surface slope (normal x, y), B = albedo, A = height (0..1 over HRANGE px, slopes scaled by K)
  const px = new Uint8Array(N*N*4), K = 1.0;
  let amin = Infinity, amax = -Infinity, hmin = Infinity, hmax = -Infinity;
  for (const v of A){ amin = Math.min(amin, v); amax = Math.max(amax, v); } for (const v of H){ hmin = Math.min(hmin, v); hmax = Math.max(hmax, v); }
  const h = (i, j) => H[((j + N) % N)*N + ((i + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
    const gx = (h(x + 1, y) - h(x - 1, y))/2*K, gy = (h(x, y + 1) - h(x, y - 1))/2*K, l = Math.hypot(gx, gy, 1), o = (y*N + x)*4;
    px[o] = (-gx/l*0.5 + 0.5)*255; px[o + 1] = (-gy/l*0.5 + 0.5)*255; px[o + 2] = ((A[y*N + x] - amin)/(amax - amin))*255; px[o + 3] = ((H[y*N + x] - hmin)/(hmax - hmin))*255; }
  const t = new THREE.DataTexture(px, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true;
  t.userData.hRange = (hmax - hmin)*K;   // px, same units as the 512 px tile width
  return t;
}
/* Lighting (physical, with one exposure constant): brightness = albedo x cos(angle to the Sun) x cast shadow. With the polar Sun ~1 deg up,
   flat ground is dim and only Sun-facing slopes and rims light up; bumps cast long shadows AWAY from the Sun (height-field march toward the Sun,
   soft edge = Sun disc 0.53 deg). Beyond ~2.5 km the detail fades to an average of the same law. Sun behind the terrain at the site:
   earthshine only. The exposure (EXP_K) is a display choice, like a camera, not a measured value. */
const EXP_K = 0.45;   // exposure = EXP_K/(sin(Sun above terrain) + 0.1): lower Sun = longer exposure, like a camera would
function groundMat(){
  const f = v => v.toFixed(1), hr = groundTex.userData.hRange.toFixed(2);
  const march = (tile, off) => '  { vec2 uv = p/' + f(tile) + off + '; float h0 = texture2D(uTex, uv).w*' + hr + ', s = 0.7, o = 1.0;\n' +
    '    for (int i = 0; i < 22; i++){ float hs = texture2D(uTex, uv + sd*s/512.0).w*' + hr + ';\n' +
    '      o = min(o, clamp(0.5 + (h0 + s*tanEl - hs)/(s*0.0093 + 0.25), 0.0, 1.0)); s *= 1.33; }\n' +
    '    sh *= o; }\n';
  return new THREE.ShaderMaterial({side: THREE.DoubleSide,
    uniforms: {uTex: {value: groundTex}, uSun: {value: new THREE.Vector3(0, 1, 0)}, uLit: {value: 1}, uExp: {value: 4}},
    vertexShader: 'attribute float hz; varying vec3 vDir; varying float vHz;\n' +
      'void main(){ vDir = position; vHz = hz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D uTex; uniform vec3 uSun; uniform float uLit, uExp; varying vec3 vDir; varying float vHz;\n' +
      'void main(){\n' +
      '  vec3 v = normalize(vDir); float el = asin(clamp(v.y, -1.0, 1.0)), dep = max(vHz - el, 1e-4);\n' +
      '  float d = min(' + f(EYE_M) + '/tan(dep), ' + f(FAR_M) + '); vec2 p = normalize(v.xz)*d;\n' +
      '  vec4 a = texture2D(uTex, p/' + f(TILE_A) + '), b = texture2D(uTex, p/' + f(TILE_B) + ' + 0.37);\n' +
      '  vec2 na = a.xy*2.0 - 1.0, nb = b.xy*2.0 - 1.0;\n' +
      '  vec3 n = normalize(vec3(na.x + 0.6*nb.x, 1.0, na.y + 0.6*nb.y));\n' +   // texture u -> world x, texture v -> world z, up = y
      '  vec3 L = normalize(uSun); float hl = max(length(L.xz), 1e-3), tanEl = L.y/hl; vec2 sd = L.xz/hl;\n' +
      '  float sh = 1.0;\n' + march(TILE_A, '') + march(TILE_B, ' + 0.37') +
      '  float far = smoothstep(150.0, 2500.0, d);\n' +
      '  float alb = mix(0.8, 1.1, mix(0.6*a.z + 0.4*b.z, 0.5, far));\n' +
      '  float sunNear = max(dot(n, L), 0.0)*sh, sunFar = 0.5*max(L.y, 0.0) + 0.012;\n' +   // far: mean of the same law over a rough surface
      '  float sun = mix(sunNear, sunFar, far)*uExp;\n' +
      '  vec3 col = vec3(1.0, 0.985, 0.96)*alb*0.62*(1.0 - exp(-1.6*(uLit*sun + 0.02)));\n' +   // 0.02 = earthshine floor; soft roll-off so lit slopes do not clip to white
      '  gl_FragColor = vec4(col, 1.0);\n' +
      '  #include <colorspace_fragment>\n' +
      '}'});
}
function buildHorizon(){
  if (horizonMesh){ sky.remove(horizonMesh); horizonMesh.geometry.dispose(); }
  if (!groundTex) groundTex = regolithTex();
  const st = App.state, m = App.mask(App.sites[st.site]), pos = [], hzs = [], idx = [], STEP = 0.5, n = 360/STEP;
  const DEP = [0, 0.03, 0.08, 0.15, 0.3, 0.6, 1, 1.6, 2.5, 4, 6, 9, 14, 22, 35, 55, 89], R = DEP.length;
  for (let k = 0; k <= n; k++){
    const az = k*STEP, hz = App.profAt(m, az);
    for (const dep of DEP){ const p = dirv(az, Math.max(-89.5, hz - dep)).multiplyScalar(800); pos.push(p.x, p.y, p.z); hzs.push(hz*D2R); }
    if (k < n) for (let r = 0; r < R - 1; r++){ const i = k*R + r, j = i + R; idx.push(i, i + 1, j, i + 1, j + 1, j); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('hz', new THREE.Float32BufferAttribute(hzs, 1)); g.setIndex(idx);
  horizonMesh = new THREE.Mesh(g, groundMat()); sky.add(horizonMesh);
  horizonMesh.userData.key = st.site + '/' + st.mast;
  // bright ridge line on the terrain edge (same mask values), so "above / below the terrain" reads at a glance
  if (ridgeLine){ sky.remove(ridgeLine); ridgeLine.geometry.dispose(); }
  const rp = []; for (let k = 0; k <= n; k++){ const v = dirv(k*STEP, App.profAt(m, k*STEP)).multiplyScalar(799); rp.push(v.x, v.y, v.z); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  ridgeLine = new THREE.Line(rg, new THREE.LineBasicMaterial({color: '#D8D2C6'})); sky.add(ridgeLine);
}
/* Earth's real face: Earth's axis and rotation (GMST) turned into this site's sky. Moon-fixed axes: z = Moon pole (taken as the ecliptic
   pole, ~1.5 deg off), equinox found from the Sun's direction and its ecliptic longitude (low-precision formula). Good to a few degrees. */
function orientEarth(j, s){
  const p = App.ephAt(j), la = s.lat*D2R, lo = s.lon*D2R, dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const U = [Math.cos(la)*Math.cos(lo), Math.cos(la)*Math.sin(lo), Math.sin(la)], E = [-Math.sin(lo), Math.cos(lo), 0], Nn = [-Math.sin(la)*Math.cos(lo), -Math.sin(la)*Math.sin(lo), Math.cos(la)];
  const toSky = v => new THREE.Vector3(dot(v, E), dot(v, U), -dot(v, Nn));
  const n = j - 2451545, g = (357.528 + 0.9856003*n)*D2R, lam = (280.460 + 0.9856474*n + 1.915*Math.sin(g) + 0.020*Math.sin(2*g))*D2R;
  const sa = Math.atan2(p.sun[1], p.sun[0]) - lam, X = [Math.cos(sa), Math.sin(sa), 0], Y = [-Math.sin(sa), Math.cos(sa), 0], eps = 23.4393*D2R;
  const P = [Math.sin(eps)*Y[0], Math.sin(eps)*Y[1], Math.cos(eps)];   // Earth's north pole = ecliptic lon 90, lat 66.56
  const Yq = [P[1]*X[2] - P[2]*X[1], P[2]*X[0] - P[0]*X[2], P[0]*X[1] - P[1]*X[0]];   // equatorial y = pole x equinox
  const gm = ((280.46061837 + 360.98564736629*n) % 360)*D2R, M = [0, 1, 2].map(c => Math.cos(gm)*X[c] + Math.sin(gm)*Yq[c]);   // lon 0 on the equator
  const vx = toSky(M).normalize(), vy = toSky(P).normalize(), vz = new THREE.Vector3().crossVectors(vx, vy);   // three.js sphere: +x = lon 0, +y = north
  earthBall.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(vx, vy, vz));
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
  // light direction: the real Sun azimuth, at its height ABOVE THE TERRAIN in that direction (on a ridge the ground falls away, so "Sun 1.2 deg
  // below level" can still mean "0.4 deg above the local horizon"); earthshine only when it is behind the terrain
  const sRel = Math.max(0.05, su.el - App.profAt(App.mask(s), su.az)), U = horizonMesh.material.uniforms;
  U.uSun.value.copy(dirv(su.az, sRel)); U.uLit.value = x.sunLit; U.uExp.value = EXP_K/(Math.sin(sRel*D2R) + 0.1);
  orientEarth(j, s);
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
  onState(keys){ if (keys.has('site') || keys.has('spot')) srcTip(); if (keys.has('site') && view === 'ground') aim(); },   // new site: face its Sun again
});
