/* view-orbit.js: Orbit view ('system'). OWNER: view-orbit session. Registers with scene-core.js.
   Sun-centred 3D space view, true scale (1 unit = 1 Moon radius = 1737.4 km).
   Earth: on its yearly path from the Astronomical Almanac low-precision Sun formula (~0.01 deg).
   Moon: JPL Horizons table (Moon frame) turned into the scene by its real fixed spin axis + the Sun direction (see mrel).
   Floating origin: the world is shifted so the focused body sits at (0,0,0); the Moon stays sharp 86,000 units from the Sun.
   No info text here (Eren: middle screen free of info); numbers live in the right panel. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {$, D2R, root, renderer, view, cams, glowTex, me2t, llv, moonTex, moonNrm, register, tok} from './scene-core.js';

const KM = 1/1737.4, RE = 6371*KM, RS = 695700*KM, AUKM = 149597870.7, YAX = new THREE.Vector3(0, 1, 0);
// Earth's heliocentric ecliptic longitude phi (rad, = the Sun's longitude + 180 deg) and Sun-Earth distance (km)
function earthHelio(j){ const d = j - 2451545.0, g = (357.528 + 0.9856003*d)*D2R, L = 280.460 + 0.9856474*d;
  return {phi: (L + 1.915*Math.sin(g) + 0.020*Math.sin(2*g))*D2R + Math.PI, r: (1.00014 - 0.01671*Math.cos(g) - 0.00014*Math.cos(2*g))*AUKM}; }
const hpos = e => new THREE.Vector3(Math.cos(e.phi)*e.r*KM, 0, -Math.sin(e.phi)*e.r*KM);
// Moon orientation + position (log 2026-11-14 orbit-fix-prototype). The Moon's spin axis is fixed in space (Cassini law):
// 1.5427 deg from ecliptic north, towards ecliptic longitude Omega + 90 deg (Omega = the orbit's ascending node, regresses in 18.6 years).
// Rotation Moon frame -> scene from two directions: Moon north -> that axis; Sun seen in the JPL table -> Sun seen in the scene.
// Then Moon - Earth = rotation x (-Earth vector from the table): real 5.1 deg orbit tilt, Sun latitude on the Moon within 0.04 deg (MEASURED 2027-2031).
const MI = 1.5427*D2R, A1 = new THREE.Vector3(), A2 = new THREE.Vector3(), A3 = new THREE.Vector3(), B2 = new THREE.Vector3(), B3 = new THREE.Vector3(), MA = new THREE.Matrix4(), MB = new THREE.Matrix4();
function mrel(j){
  const p = App.ephAt(j), om = (125.0445 - 0.0529539*(j - 2451545.0))*D2R + Math.PI/2, eh = hpos(earthHelio(j));
  const P = new THREE.Vector3(Math.sin(MI)*Math.cos(om), Math.cos(MI), -Math.sin(MI)*Math.sin(om));   // spin axis in the scene (+y = ecliptic north)
  A1.set(0, 1, 0); A2.copy(me2t(p.sun)).normalize(); A2.addScaledVector(A1, -A2.y).normalize(); A3.crossVectors(A1, A2);
  MA.makeBasis(A1, A2, A3).transpose();
  const r = Math.hypot(p.earth[0], p.earth[1], p.earth[2]), q = new THREE.Quaternion(), v = new THREE.Vector3(), sun = new THREE.Vector3();
  for (let it = 0; it < 2; it++){   // pass 1: Sun direction from Earth; pass 2: from the Moon (0.15 deg parallax)
    sun.copy(eh).add(v).negate().normalize(); B2.copy(sun).addScaledVector(P, -sun.dot(P)).normalize(); B3.crossVectors(P, B2);
    MB.makeBasis(P, B2, B3).multiply(MA); q.setFromRotationMatrix(MB);
    v.copy(me2t(p.earth)).applyQuaternion(q).multiplyScalar(-KM); }
  return {o: {r}, v, q};
}
let space, sCam, sCtl, world, eSys, sMoon, sEarth, sSun, sHalo, mMark, eMark, sTrack, sPast, eFut, ePast, stars, sL;
let sSiteAx, siteKey = null;
let focus = null, anim = null, anchor = new THREE.Vector3(), moonKey = null, earthKey = null, sPe = null, sAp = null, olab = {};
const PREF = {moon: 13, earth: 700, sun: 260000}, MIND = {moon: 1.25, earth: RE*1.25, sun: RS*1.25};
function buildSpace(){
  space = new THREE.Scene(); space.background = new THREE.Color('#020306');
  sCam = new THREE.PerspectiveCamera(40, 1, 0.01, 1e6); cams.push(sCam);
  sCtl = new OrbitControls(sCam, renderer.domElement); sCtl.enablePan = true; sCtl.screenSpacePanning = true;   // right-drag moves the camera
  sCtl.minDistance = 1.25; sCtl.maxDistance = 700000; sCtl.enableDamping = true; sCtl.dampingFactor = 0.08; sCtl.enabled = false;
  const N = 5000, a = new Float32Array(N*3), c = new Float32Array(N*3);   // decorative star field on a unit sphere that follows the camera (not data)
  for (let i = 0; i < N; i++){ const u = Math.random()*2 - 1, t = Math.random()*Math.PI*2, r = Math.sqrt(1 - u*u), b = 0.25 + 0.75*Math.random()**3, warm = Math.random();
    a[i*3] = r*Math.cos(t); a[i*3 + 1] = u; a[i*3 + 2] = r*Math.sin(t); c[i*3] = b*(warm > 0.8 ? 1 : 0.85); c[i*3 + 1] = b*0.9; c[i*3 + 2] = b*(warm < 0.2 ? 1 : 0.85); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(a, 3)); sg.setAttribute('color', new THREE.BufferAttribute(c, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({size: 1.5, sizeAttenuation: false, vertexColors: true, depthWrite: false})); stars.frustumCulled = false; space.add(stars);
  world = new THREE.Group(); space.add(world);
  const add = (o, p = world) => { p.add(o); return o; }, glow = (c0, c1, op = {}) => new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({map: glowTex(c0, c1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}, op)));
  sSun = add(new THREE.Mesh(new THREE.SphereGeometry(RS, 64, 32), new THREE.MeshBasicMaterial({color: '#FFF3D6'})));   // true size
  sHalo = add(glow('rgba(255,236,190,0.75)', 'rgba(255,170,80,0.14)'));
  sL = add(new THREE.DirectionalLight('#FFF6E8', 3.2)); space.add(new THREE.AmbientLight('#8FA3C0', 0.05));
  eSys = add(new THREE.Group()); sL.target = eSys;   // Earth + Moon ride together on Earth's path
  const etex = new THREE.TextureLoader().load('assets/earth_bmng_2k.jpg'); etex.colorSpace = THREE.SRGBColorSpace; etex.anisotropy = 4;   // NASA Blue Marble Next Generation, Dec 2004
  // Earth's spin axis: 23.44 deg from ecliptic north, leaning towards ecliptic longitude 270 deg (north pole towards 90 deg), so the seasons show in the day/night line
  const eTilt = add(new THREE.Group(), eSys); eTilt.rotation.x = -23.44*D2R;
  sEarth = add(new THREE.Mesh(new THREE.SphereGeometry(RE, 96, 48), new THREE.MeshStandardMaterial({map: etex, roughness: 0.75, metalness: 0, emissive: '#04080F'})), eTilt);
  // spin-axis lines (explainer): Earth leans 23.4 deg -> seasons; the Moon leans 1.5 deg -> at its poles the Sun always skims the horizon.
  // Children of the bodies, so they follow the real orientation; hidden behind the body where they pass through it.
  const axis = (len, parent) => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -len, 0), new THREE.Vector3(0, len, 0)]);
    return add(new THREE.Line(g, new THREE.LineBasicMaterial({color: '#FFD08A', transparent: true, opacity: 0.85})), parent); };
  axis(RE*1.7, eTilt);
  const atm = add(glow('rgba(130,190,255,0.55)', 'rgba(70,130,255,0.16)'), eSys); atm.scale.set(RE*3.4, RE*3.4, 1);
  const sGeo = new THREE.SphereGeometry(1, 96, 48); sGeo.computeTangents();
  sMoon = add(new THREE.Mesh(sGeo,new THREE.MeshStandardMaterial({map: moonTex(), normalMap: moonNrm(), roughness: 1, metalness: 0})), eSys);
  axis(1.7, sMoon);
  // selected-site line (Eren 14 Nov): from the site through the Moon's centre to the far side, next to the spin axis,
  // so the angle between them (= 90 deg - |latitude|, ~1.6-6 deg for our sites) can be seen. Points set in updateSpace.
  sSiteAx = add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]),
    new THREE.LineBasicMaterial({color: tok('--earth-3d', '#64B5F6'), transparent: true, opacity: 0.9})), sMoon);
  mMark = add(glow('rgba(240,238,230,1)', 'rgba(220,220,210,0.35)', {blending: THREE.NormalBlending}), eSys);   // map markers when a body is too small to see
  eMark = add(glow('rgba(140,200,255,1)', 'rgba(90,150,255,0.35)', {blending: THREE.NormalBlending}), eSys);
  // paths fade along their length (per-vertex alpha, vertex 0 = the body now): ahead stays readable, the trail behind dies out fast (Eren 14 Nov)
  const line = (n, col, a0, a1, pw, parent) => { const g = new THREE.BufferGeometry(), c = new THREE.Color(col), cl = new Float32Array(n*4);
    for (let k = 0; k < n; k++) cl.set([c.r, c.g, c.b, a1 + (a0 - a1)*Math.pow(1 - k/(n - 1), pw)], k*4);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n*3), 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 4));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, depthWrite: false})); l.frustumCulled = false; parent.add(l); return l; };
  sTrack = line(61, tok('--sel-3d', '#4FC3F7'), 0.95, 0.25, 1, eSys); sPast = line(61, tok('--sel-3d', '#4FC3F7'), 0.5, 0.12, 2.5, eSys);   // floor 0.12: the ring stays faintly visible under the closest/farthest marks   // the Moon's real path around Earth, +/-15 days
  eFut = line(366, '#9CCC65', 0.85, 0.25, 1, world); ePast = line(366, '#9CCC65', 0.45, 0.08, 2.5, world);   // Earth's real path around the Sun, +/-half a year
  const mk = (cls, txt, f) => { const e = document.createElement('div'); e.className = 'olab ' + cls; e.textContent = txt; $('#olabels').appendChild(e); if (f){ e.onclick = () => focusSpace(f); e.title = 'Focus the camera on the ' + txt; } return e; };
  olab = {sun: mk('sun', 'Sun', 'sun'), earth: mk('earth', 'Earth', 'earth'), moon: mk('moon', 'Moon', 'moon'), pe: mk('apsis', '◆ closest'), ap: mk('apsis', '◆ farthest'), site: mk('site', ''),
    pole: mk('apsis', 'South pole'), send: mk('apsis', '')};   // tags at the outer (south) ends of the spin axis and the site line (Eren 15 Nov)
  olab.pole.style.color = 'var(--c-sun)'; olab.send.style.color = 'var(--c-earth)';
  root.querySelectorAll('#obBar button').forEach(b => b.onclick = () => focusSpace(b.dataset.f));
  // click (not drag) on a body focuses the camera on it; small bodies get a 26 px catch radius
  const cv = renderer.domElement; let down = null;
  cv.addEventListener('pointerdown', e => { if (view === 'system' && e.button === 0) down = {x: e.clientX, y: e.clientY}; });
  cv.addEventListener('pointerup', e => { if (view !== 'system' || !down || e.button !== 0) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 5) return;
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k = (r.height/2)/Math.tan(sCam.fov*D2R/2); let best = null;
    [['sun', sSun, RS], ['earth', sEarth, RE], ['moon', sMoon, 1]].forEach(([f, o, rad]) => { const p = o.getWorldPosition(new THREE.Vector3()), q = p.clone().project(sCam); if (q.z > 1) return;
      const d = Math.hypot((q.x*0.5 + 0.5)*r.width - mx, (-q.y*0.5 + 0.5)*r.height - my), reach = Math.max(26, rad/p.distanceTo(sCam.position)*k);
      if (d <= reach && (!best || d < best.d)) best = {f, d}; });
    if (best) focusSpace(best.f); });
}
function bodyTrue(f){ return f === 'sun' ? new THREE.Vector3() : f === 'earth' ? eSys.position.clone() : eSys.position.clone().add(sMoon.position); }
function focusSpace(f){
  root.querySelectorAll('#obBar button').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f));
  // every focus flies to that body's best angle. Moon: from the Sun side (at least half lit) and from the south (our sites face the camera)
  let dir;
  if (f === 'moon'){ const away = sMoon.position.clone().normalize(), toSun = eSys.position.clone().negate().normalize(), side = YAX.clone().cross(away);
    dir = toSun.multiplyScalar(8).addScaledVector(away, 8).addScaledVector(YAX, -5).addScaledVector(side, 4).normalize(); }
  else dir = new THREE.Vector3(-0.15, f === 'sun' ? 0.85 : 0.75, 0.55).normalize();   // from above, so the path reads as a ring
  sCtl.enableDamping = false; sCtl.update(); sCtl.enableDamping = true;   // drop any leftover drag momentum
  if (!focus){ anim = null; anchor.copy(bodyTrue(f)); sCtl.target.set(0, 0, 0); sCam.position.copy(dir).multiplyScalar(PREF[f]); }   // first open: no fly-in
  else {   // glide: the look-at point moves from where it is now (incl. any pan) to the body; distance on a log scale; angle turns to the preset
    const off = sCam.position.clone().sub(sCtl.target);
    anim = {t0: performance.now(), fromTrue: anchor.clone().add(sCtl.target), fromDist: off.length(), toDist: PREF[f], fromDir: off.normalize(), dir};
    anchor.copy(anim.fromTrue); sCam.position.sub(sCtl.target); sCtl.target.set(0, 0, 0);
  }
  focus = f; sCtl.minDistance = Math.min(MIND[f], anim ? anim.fromDist : MIND[f]);
}
function updateSpace(){
  const st = App.state, j = st.jd0 + st.t, eh = earthHelio(j), p = App.ephAt(j), mr = mrel(j);
  eSys.position.copy(hpos(eh)); sMoon.position.copy(mr.v);
  sMoon.quaternion.copy(mr.q);   // Moon frame -> scene: north on its real fixed axis, Earth-facing side towards Earth
  // inside the tilted frame (x = March equinox direction, y = Earth's north), Greenwich faces the Greenwich sidereal angle (IAU 1982 linear term)
  sEarth.rotation.y = ((280.46061837 + 360.98564736629*(j - 2451545.0)) % 360)*D2R;
  // the Moon's real path, redrawn every frame from the exact time, so vertex 0 sits on the Moon and the fade moves with it while playing
  // (the old 6-hour redraw left the bright start behind the Moon at play speed)
  if (j !== moonKey){ moonKey = j; let lo = null, hi = null;
    [[sTrack, 1], [sPast, -1]].forEach(([ln, sg]) => { const at = ln.geometry.attributes.position;
      for (let k = 0; k <= 60; k++){ const q = mrel(j + sg*k*0.25); at.setXYZ(k, q.v.x, q.v.y, q.v.z); if (!lo || q.o.r < lo.r) lo = {r: q.o.r, v: q.v}; if (!hi || q.o.r > hi.r) hi = {r: q.o.r, v: q.v}; }
      at.needsUpdate = true; });
    sPe = lo; sAp = hi; }
  if (j !== earthKey){ earthKey = j;   // Earth's path: half a year ahead + half a year behind = one loop, half-day steps (chord error < 1 Moon radius)
    [[eFut, 1], [ePast, -1]].forEach(([ln, sg]) => { const at = ln.geometry.attributes.position;
      for (let k = 0; k < 366; k++){ const v = hpos(earthHelio(j + sg*k*0.5)); at.setXYZ(k, v.x, v.y, v.z); } at.needsUpdate = true; }); }
  if (!focus) focusSpace('moon');
  // camera: floating origin on the focused body; a focus change eases over 0.8 s (distance on a log scale)
  const tgt = bodyTrue(focus);
  if (anim){ const k0 = Math.min(1, (performance.now() - anim.t0)/900), k = k0*k0*(3 - 2*k0);   // smoothstep ease
    anchor.copy(anim.fromTrue).lerp(tgt, k); sCtl.target.set(0, 0, 0);   // the body is tracked live, so a moving Moon is still hit
    const d = anim.fromDist*Math.pow(anim.toDist/anim.fromDist, k), dir = anim.fromDir.clone().lerp(anim.dir, k);
    if (dir.lengthSq() < 1e-6) dir.copy(anim.dir); sCam.position.copy(dir.normalize()).multiplyScalar(d);
    if (k0 >= 1){ anim = null; sCtl.minDistance = MIND[focus]; } }
  else anchor.copy(tgt);
  world.position.copy(anchor).negate();
  sCtl.update();
  const camD = sCam.position.distanceTo(sCtl.target); sCam.near = Math.max(0.002, camD*0.002); sCam.far = Math.max(2e5, camD*30); sCam.updateProjectionMatrix();
  stars.position.copy(sCam.position); stars.scale.setScalar(sCam.far*0.8);
  world.updateMatrixWorld(true);
  const W = o => o.getWorldPosition(new THREE.Vector3()), sunW = W(sSun), earthW = W(sEarth), moonW = W(sMoon);
  const dS = sunW.distanceTo(sCam.position), dE = earthW.distanceTo(sCam.position), dM = moonW.distanceTo(sCam.position);
  sHalo.scale.setScalar(Math.max(RS*7, dS*0.05));
  mMark.position.copy(sMoon.position); mMark.visible = dM > 80; mMark.scale.setScalar(dM*0.016);
  eMark.visible = dE > 3000; eMark.scale.setScalar(dE*0.02);
  // labels: names only, clickable; positions follow the bodies
  const w = root.clientWidth, h = root.clientHeight;
  const put = (e, v, show = true) => { const q = v.clone().project(sCam); if (!show || q.z > 1 || Math.abs(q.x) > 1.05 || Math.abs(q.y) > 1.05){ e.style.display = 'none'; return; }
    e.style.display = ''; e.style.left = (q.x*0.5 + 0.5)*w + 'px'; e.style.top = (-q.y*0.5 + 0.5)*h + 'px'; };
  const near = dE < 5000, ang = (r, d) => r/d*(h/2)/Math.tan(sCam.fov*D2R/2);   // projected radius in px
  put(olab.sun, sunW.clone().add(new THREE.Vector3(0, RS + dS*0.03, 0)));
  put(olab.earth, earthW.clone().add(new THREE.Vector3(0, RE + dE*0.025, 0)));
  put(olab.moon, moonW.clone().add(new THREE.Vector3(0, 1 + dM*0.025, 0)), dE < 50000 || focus === 'moon');
  put(olab.pe, eSys.localToWorld(sPe.v.clone()), near); put(olab.ap, eSys.localToWorld(sAp.v.clone()), near);
  const s = App.sites[st.site], sk = s.lat + ',' + s.lon;
  if (sk !== siteKey){ siteKey = sk; const u = llv(s.lat, s.lon, 1.7), at = sSiteAx.geometry.attributes.position;
    at.setXYZ(0, u.x, u.y, u.z); at.setXYZ(1, -u.x, -u.y, -u.z); at.needsUpdate = true; sSiteAx.geometry.computeBoundingSphere(); }
  const sp = sMoon.localToWorld(llv(s.lat, s.lon, 1.01)), facing = sp.clone().sub(moonW).dot(sCam.position.clone().sub(sp)) > 0;
  // tag = short name + the angle between the site line and the spin axis (= 90 deg - |latitude|), Eren 14 Nov
  const stag = 'Selected: ' + s.short + ' · ' + (90 - Math.abs(s.lat)).toFixed(1) + '° from the pole';
  if (olab.site.textContent !== stag){ olab.site.textContent = stag; olab.site.title = 'Angle between the blue site line and the Moon\'s spin axis (orange) = 90° minus the site\'s latitude'; }
  put(olab.site, sp, facing && ang(1, dM) > 40);
  // line-end tags: south end of the spin axis + site end of the site line. Hidden when the Moon is small or the end is behind the disc.
  // The two ends are only 0.2-6 deg apart, so the tag of the end further left on screen goes left, the other goes right (never overlap).
  const pEnd = sMoon.localToWorld(new THREE.Vector3(0, -1.7, 0)), sEnd = sMoon.localToWorld(llv(s.lat, s.lon, 1.7)), mq = moonW.clone().project(sCam);
  const hidden = v => { const q = v.clone().project(sCam), rpx = ang(1, dM); return Math.hypot((q.x - mq.x)*w/2, (q.y - mq.y)*h/2) < rpx && v.distanceTo(sCam.position) > dM; };
  const stxt = s.custom ? 'your spot' : s.short; if (olab.send.textContent !== stxt) olab.send.textContent = stxt;
  const big = ang(1, dM) > 40, pLeft = pEnd.clone().project(sCam).x <= sEnd.clone().project(sCam).x;
  olab.pole.style.transform = pLeft ? 'translate(calc(-100% - 6px),-50%)' : 'translate(6px,-50%)';
  olab.send.style.transform = pLeft ? 'translate(6px,-50%)' : 'translate(calc(-100% - 6px),-50%)';
  put(olab.pole, pEnd, big && !hidden(pEnd)); put(olab.send, sEnd, big && !hidden(sEnd));
}

// ?debug: pixel distance from each apsis marker to the nearest drawn path vertex (should be ~0)
if (location.search.includes('debug')) window.__orbitApsis = () => { const r = renderer.domElement.getBoundingClientRect(), px = v => { const q = v.clone().project(sCam); return [(q.x*0.5 + 0.5)*r.width, (-q.y*0.5 + 0.5)*r.height]; };
  const pts = []; [sTrack, sPast].forEach(l => { const a = l.geometry.attributes.position; for (let k = 0; k < a.count; k++) pts.push(px(eSys.localToWorld(new THREE.Vector3().fromBufferAttribute(a, k)))); });
  return [sPe, sAp].map(s => { const p = px(eSys.localToWorld(s.v.clone())); return {p: p.map(Math.round), gap: Math.round(Math.min(...pts.map(q => Math.hypot(q[0] - p[0], q[1] - p[1]))))}; }); };

register('system', {
  build: buildSpace,
  show(on){ $('#olabels').hidden = !on; $('#obBar').hidden = !on; sCtl.enabled = on; },
  frame(){ updateSpace(); renderer.render(space, sCam); },
});
