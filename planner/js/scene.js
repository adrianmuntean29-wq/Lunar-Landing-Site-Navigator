/* scene.js: loader for the middle screen (#scene). OWNER: view-moon session (scene core).
   Split 2026-11-14 (no behaviour change): scene-core.js = renderer, terrain data, shared helpers, view switching, loop;
   one file per view, each registers with scene-core. index.html still loads only this file. */
import {boot} from './scene-core.js';
import './view-site.js';     // Landing Site ('region')
import './view-ground.js';   // Ground Level ('ground')
import './view-moon.js';     // Moon ('globe')
import './view-orbit.js';    // Orbit ('system')
await boot();
