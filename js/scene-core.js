/* scene-core.js: OWNER view-moon session (scene core). Fills #scene only.
   Shared by the four views: root markup, renderer, terrain data, shared helpers, resize, view switching, App wiring, render loop.
   Each view file (view-orbit/moon/site/ground.js) calls register(name, hooks) and owns its own scene, camera and DOM behaviour.
   Hooks: build() once at boot (in the order below), show(on) when the view turns on/off, frame() every animation frame while
   active (update + render), onState(keys, src) on every App change. Views never call each other. */
import * as THREE from 'three';

export const $ = s => document.querySelector(s);
// project palette token from base.css (e.g. '--mis-3d': fixed colours for marks ON the dark 3D picture), read once at build
export const tok = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
export const R = App.R, D2R = App.D2R, root = $('#scene');
root.innerHTML = `
  <div class="labels" id="labels"></div>
  <div class="zoom"><button type="button" id="zin" aria-label="Zoom in">+</button><button type="button" id="zout" aria-label="Zoom out">−</button></div>
  <div class="views" role="group" aria-label="View"><button type="button" data-v="system" aria-pressed="false">Orbit</button><button type="button" data-v="globe" aria-pressed="false">Moon</button><button type="button" data-v="region" aria-pressed="true">Landing Site</button><button type="button" data-v="ground" aria-pressed="false">Ground Level</button></div>
  <div class="soon" id="soon" hidden></div>
  <div class="labels" id="olabels" hidden></div>
  <div class="obbar" id="obBar" role="group" aria-label="Camera" hidden><span>Focus</span><button type="button" data-f="moon" aria-pressed="true">Moon</button><button type="button" data-f="earth" aria-pressed="false">Earth</button><button type="button" data-f="sun" aria-pressed="false">Sun</button></div>
  <div class="labels" id="glabels" hidden></div>
  <div class="obbar" id="gBar" role="group" aria-label="Camera" hidden><span>View</span><button type="button" data-g="pole" aria-pressed="true">South pole</button><button type="button" data-g="moon" aria-pressed="false">Whole Moon</button></div>  <div class="sitebar" id="sitebar" hidden><button type="button" class="btn" id="lookSun">Look at the Sun</button><button type="button" class="btn" id="lookEarth">Look at Earth</button></div>
  <div class="skylabels" id="skylabels" hidden></div>
  <div class="layers" id="layersBox"><div class="lyhead lytop"><span class="lytl">Layers</span><button type="button" class="lyfold" id="lyFold" aria-expanded="true" aria-controls="layersBox" aria-label="Hide layers" title="Hide layers">Hide ›</button></div>
    <div class="lyhead"><span>Landing</span><span class="info-wrap"><button type="button" class="info-i" aria-label="About the landing layers" aria-describedby="lyTipLand">i</button><span class="info-tip" id="lyTipLand" role="tooltip"><span>Things that matter for the lander.</span><span><b>Landing site markers</b>: numbered tags of the other sites (same numbers as the list on the right). Off hides them; the selected site and your own spot always keep theirs.</span><span><b>Sunlight now</b>: ground the Sun reaches at the time on the clock turns yellow, ground in shadow turns blue. It changes as time plays; it is one moment, not a yearly average. Exact within about 90 km of the site (sun shadows switch on with it).</span><span><b>Elevation</b>: height of the ground, blue = low, yellow = high, white = highest (−6 to +7 km from the Moon's mean radius). Heights in 3D are drawn ×2.</span><span><b>Permanently shadowed</b>: areas the Sun never reaches (LOLA model).</span><span><b>Flat, smooth terrain</b>: team analysis by Tudor (ArcGIS: LOLA slope and hillshade, PGDA 90 roughness, permanent shadow). Most of it is dark most of the time. Not NASA regions.</span></span></span></div>
    <label><input type="checkbox" id="lySites" checked> <span class="sitesw"></span> Landing site markers</label>
    <label><input type="checkbox" id="lyLight"> <span class="litsw"></span> Sunlight now</label>
    <label><input type="checkbox" id="lyElev"> <span class="elevsw"></span> Elevation</label>
    <label><input type="checkbox" id="lyPsr" checked> <span class="psrsw"></span> Permanently shadowed areas (LOLA)</label>
    <label><input type="checkbox" id="lyZones" checked> <span class="zonesw"></span> Flat, smooth terrain (team analysis)</label>
    <div class="lyhead"><span>Other missions</span></div>
    <div class="row"><label><input type="checkbox" id="lyMis" checked> <span class="missw"></span> Other missions and keep-out zones</label><span class="info-wrap"><button type="button" class="info-i" aria-label="About other missions" aria-describedby="legend">i</button><span class="info-tip legend" id="legend" role="tooltip"></span></span></div>
    <div class="lyhead"><span>Display</span><span class="info-wrap"><button type="button" class="info-i" aria-label="About the graphics layers" aria-describedby="lyTipGfx">i</button><span class="info-tip" id="lyTipGfx" role="tooltip"><span>Helpers for the picture only, no data.</span><span><b>Terrain shadows</b>: from the real Sun direction, within about 90 km of the site.</span><span><b>Latitude lines</b>: every 1° from 89° to 85° S (about 30 to 150 km from the pole). The cross marks the true south pole (90° S).</span><span><b>Fade distant terrain</b>: fades the ground far from the selected site so it stands out.</span><span><b>Star background</b>: decorative, not real star positions.</span></span></span></div>
    <label><input type="checkbox" id="lyShadow" checked> Terrain shadows</label>
    <label><input type="checkbox" id="lyRings" checked> Latitude lines</label>
    <label><input type="checkbox" id="lyFog" checked> Fade distant terrain</label>
    <label><input type="checkbox" id="lyStars" checked> Star background</label></div>`;

// live bindings: importers always see the current value
export let renderer = null, view = 'region', meta = null, HGT = null;   // HGT: engine heights.bin (+/-60 km, 240 m), used by Landing Site and the Moon cap
export const cams = [];   // every view camera: aspect follows the canvas size

/* ---------- shared helpers ---------- */
export function glowTex(c0, c1){ const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, c0); r.addColorStop(0.25, c1); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
// globe frame: Moon ME (x, y, z_north) -> three.js (x, z_north, -y); texture u = 0.5 at lon 0
export const me2t = v => new THREE.Vector3(v[0], v[2], -v[1]);
export const llv = (lat, lon, r = 1) => new THREE.Vector3(r*Math.cos(lat*D2R)*Math.cos(lon*D2R), r*Math.sin(lat*D2R), -r*Math.cos(lat*D2R)*Math.sin(lon*D2R));
let MOONTEX = null, MOONNRM = null;   // NASA SVS 4720: 4k LROC colour + 4k normal map baked from LOLA ldem_16 (relief shading on the whole globe, one texture lookup per pixel)
export const moonTex = () => { if (!MOONTEX){ MOONTEX = new THREE.TextureLoader().load('assets/moon_color_4k.jpg'); MOONTEX.colorSpace = THREE.SRGBColorSpace; MOONTEX.anisotropy = 8; } return MOONTEX; };
export const moonNrm = () => { if (!MOONNRM){ MOONNRM = new THREE.TextureLoader().load('assets/moon_normal_4k.jpg'); MOONNRM.colorSpace = THREE.NoColorSpace; MOONNRM.anisotropy = 8; } return MOONNRM; };

/* ---------- views ---------- */
const views = {}, ORDER = ['region', 'ground', 'globe', 'system'];   // build order (unchanged from the single-file scene)
export function register(name, hooks){ views[name] = hooks; }

function size(){ if (!renderer) return; const w = root.clientWidth, h = root.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false);
  cams.forEach(c => { c.aspect = w/h; c.updateProjectionMatrix(); }); layersSpot(); }
// layers box fold (Eren 15 Nov, v2 after "this does not look right"): open = header row "LAYERS · Hide ›", folded = one "‹ Layers" pill; state kept in localStorage 'spn-layers-folded'
function setFold(f){ const box = $('#layersBox'), b = $('#lyFold'); if (!box || !b) return;
  box.classList.toggle('folded', f); b.setAttribute('aria-expanded', !f); b.textContent = f ? '‹ Layers' : 'Hide ›';
  const lab = f ? 'Show layers' : 'Hide layers'; b.setAttribute('aria-label', lab); b.title = lab;
  try { localStorage.setItem('spn-layers-folded', f ? '1' : '0'); } catch (e) {} }
{ const b = $('#lyFold'); if (b){ b.onclick = () => setFold(!$('#layersBox').classList.contains('folded'));
  let f = false; try { f = localStorage.getItem('spn-layers-folded') === '1'; } catch (e) {} if (f) setFold(true); } }
// layers box: top-right corner; drops below the view tabs only when the scene is too narrow for both on one row
let boxW = 310;
function layersSpot(){ const box = $('#layersBox'), tabs = root.querySelector('.views'); if (box.offsetWidth) boxW = box.offsetWidth;
  const w = root.clientWidth; root.classList.toggle('layers-low', w/2 + tabs.offsetWidth/2 + 12 > w - 12 - boxW);
  root.style.setProperty('--tabs-b', (tabs.offsetTop + tabs.offsetHeight + 8) + 'px'); }   // row under the tabs (they wrap to 2 lines when narrow): camera bars + low layers box

export function setView(v){
  view = v; root.querySelectorAll('.views button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
  if (App.state.view !== v) App.set({view: v}, 'scene');   // shared: the panel shows different content per view (CONTRACT)
  ORDER.forEach(n => views[n] && views[n].show && views[n].show(n === v));
  layersSpot();   // the box is measurable only while shown
}

function loop(){
  requestAnimationFrame(loop);
  const V = views[view] || views.system; V.frame();
}

export async function boot(){
  await App.ready;
  meta = await (await fetch(App.DATA + 'terrain_meta.json')).json();
  HGT = new Float32Array(await (await fetch(App.DATA + 'heights.bin')).arrayBuffer());
  renderer = new THREE.WebGLRenderer({antialias: true}); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; root.prepend(renderer.domElement);
  for (const n of ORDER) if (views[n] && views[n].build) views[n].build();
  new ResizeObserver(size).observe(root); size();
  setView(App.state.view || 'system');   // shared state decides the opening view (core default 'system' = Orbit, Eren)
  root.querySelector('.views').onclick = e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); };
  App.on((keys, src) => { if (keys.has('view') && src !== 'scene' && App.state.view !== view) setView(App.state.view);
    ORDER.forEach(n => views[n] && views[n].onState && views[n].onState(keys, src)); });
  ORDER.forEach(n => views[n] && views[n].ready && views[n].ready());
  requestAnimationFrame(loop);
}
