# South Pole Navigator draft app: who owns what, and how the areas talk

Folder: `design-drafts\app\` (a design draft, NOT the team repo). Open it at `http://localhost:8766/design-drafts/app/index.html`
(a local server serves the event folder; if it is down: `python -m http.server 8766 --bind 127.0.0.1` in the event folder).
Data comes read-only from `app\data\` (`App.DATA = 'data/'`, since 2026-11-14 ~17:50): copies of the engine's files (origin/main, PR #4)
+ `subpoints.json` + `missions.csv`; see `data\README.txt`. Never edit the data files or anything in the repo or the engine.

## Ownership (one chat per file set; never edit a file you do not own)

| Files | Owner |
|---|---|
Updated 2026-11-14 17:31 after the scene split (log `*-moonsim-scene-split.md`). Session ids in brackets.

| Files | Owner |
|---|---|
| `index.html`, `css/base.css`, `js/core.js`, `js/shell.js`, `js/missions.js`, `data/missions.csv`, `CONTRACT.md` | COORDINATOR (local_152d34dc) |
| `js/scene.js` (9-line loader), `js/scene-core.js`, `css/scene.css`, `assets/`, `js/view-moon.js` ('globe') | SCENE CORE = VIEW: MOON (local_d4a0ccb5) |
| `js/view-orbit.js` ('system') | VIEW: ORBIT (local_d37d19b3) |
| `js/view-site.js` ('region') | VIEW: SITE (local_efdd83f5) |
| `js/view-ground.js` ('ground') | VIEW: GROUND (local_9ed85717) |
| `js/panel.js`, `css/panel.css`, `js/drawer.js`, `css/drawer.css` | PANELS (local_90cfa883) |

Need a change in a file you do not own (a new state field, a helper in core, a slot in index.html)? Message the
COORDINATOR with the exact change. It lands once, for everyone. Do not work around it locally.

**Scene rules (since the split):** `index.html` loads only `js/scene.js`, which imports `scene-core.js` and the four view files.
Each view calls `register(name, {build, show(on), frame(), onState(keys, src), ready()})` from `scene-core.js`.
A view edits only its own file. Anything shared (root markup, helpers, renderer, terrain load, `css/scene.css`) goes
through the SCENE CORE owner. Views never call each other.

**Shared (i) info tooltip (base.css, any area, since 2026-11-14):** `.info-wrap` > `button.info-i` + `span.info-tip.role=tooltip`
(markup in the base.css comment). Tip opens below, right-aligned; add `left` to the tip to align it left. Put an (i) on every field
that needs one explanation (Eren). Do not restyle it per area; ask the coordinator for changes.

## How areas talk: only through `window.App` (core.js)

- Read: `App.state` = `{jd0, days, t, playing, speed, site, mast, selDay, psr, lim: {len, sun, earth, night, relay}, panelOpen, drawerOpen, view, missions}`.
  `view` = the scene's view: `'system'` (Orbit) | `'globe'` (Moon) | `'region'` (Landing Site) | `'ground'` (Ground Level). The scene sets it
  when its view changes and follows it if another area sets it; the panel shows different content per view.
  `t` = days since `jd0` (first landing date, Julian date). `selDay` = chosen landing day index (-1 = none). `mast` = '0' | '2' | '10'.
- Change: `App.set(patch, source)`, e.g. `App.set({site: 2, selDay: -1}, 'panel')`, `App.set({lim: {len: 20}}, 'drawer')`.
  `source` is your area name. Changing `jd0`, `days` or `mast` rebuilds the hourly series automatically.
- React: `App.on((keys, source) => ...)`. `keys` is a Set of what changed (`'t'`, `'site'`, `'lim'`, `'lim.len'`, ...).
  While playing, `t` changes every frame with source `'play'`: redraw only what depends on time, and throttle.
- Never call another area's functions, never query or change another area's DOM (`#scene`, `#panel`, `#drawer` are separate worlds).
  Style only inside your own container (`#scene ...`, `#panel ...`, `#drawer ...`).

## The maths lives only in core.js (do not reimplement it)

Checked against the engine: 0 of 1,460 landing days disagree (vault log 1440 / frontend calendar check).
- `App.stateAt(site, jd)` -> `{su: {az, el}, ea: {az, el}, sunHz, earthHz, sunLit (disc fraction 0..1), earthVis (bool)}`
- `App.next(site, jd, 'sun'|'earth')` -> `{now, h}` hours until the next change (null = none within 60 days)
- `App.wins(i)` -> landing windows for site i under the current limits: `[{d, sun %, earth %, night h, fail: ['sun'|'earth'|'night']}]`
- `App.winsLong(i, len)` -> same for any mission length (missions may run past the period)
- `App.moonInfo(jd)` -> `{phase (words), lit (0..1), waxing, earthKm, sunKm, closest: {jd, km}, farthest: {jd, km}}` (closest/farthest within
  +/-15 days). Orbit-view numbers live in the RIGHT PANEL; the middle screen stays as free of text as possible (Eren, 15:5x).
- `App.series(i)` -> hourly `{sun, earth}` arrays from `jd0`; `App.mask(site)`, `App.profAt(mask, az)`; `App.ephAt(jd)`, `App.azel(lat, lon, v)`
- Data: `App.sites` (name, short, lat, lon, masks, psr_km, raw), `App.sitesJson`, `App.psr` (outlines), `App.eph` (table dates)
- **Custom landing spot:** `await App.addSpot(lat, lonEast)` adds ONE spot (replaces the previous), selects it and emits `'spot'` (+ `'site'`).
  It rejects with a plain-English `Error` (show `err.message`) if the spot is more than `App.MAX_SPOT_KM` (290) km from the pole.
  `App.clearSpot()` removes it. The row has `custom: true, approx: true, label`, `why` (one-line reason, use it in the (i) tip) ("approximate, 240 m + 640 m terrain" or "... 640 m ..."),
  `psr_km: null` (show "unknown"), `poleKm`, `ground_m`, `edge_rays`. Every number for it MUST show `site.label`: the engine measured up to
  ~20 points sun % error at the named sites (e.g. Shackleton 65 vs 84). ~0.4-0.7 s per spot (MEASURED). **On `'spot'`, rebuild anything
  built per site (pins, lists): `App.sites` changed length.** Do not rank a custom spot among the named sites without its label
  (engine, MEASURED: Malapert Earth 63% exact vs 100% on the coarse grid; a 640 m grid averages away a nearby bump on the summit). `App.state.spot` = null | {lat, lon, label, n}.
- Words: `App.iso(jd)`, `App.dayDate(d)`, `App.plainH(h)`; presets `App.PRESETS` (example values, not NASA's)

Rules that stay true everywhere: sunlight % = mean visible share of the Sun's disc; night/darkness = Sun centre below the
terrain horizon; Earth contact = any part of Earth's disc above it (geometry, not a radio link); one landing per day at 00:00 UTC.

## Other missions (missions.js, owned by the missions chat; loaded by core before App.ready resolves)

- State: `App.state.missions = {on, caution (km, our assumption, default 5), cn (show Chang'e rows)}`. Change with a NEW object.
- `Missions.near(site?)` -> `[{m, km, ruleKm, needKm, inside, coordinate}]`; `Missions.summary(site?)` -> `{ok, coordinate, text}`;
  `Missions.dayFail(i, d)` -> `[]` | `['keepout']` | `['coordinate']`; `Missions.LABEL` (show it wherever missions appear).
- Scene: circle of `radius_km` per placed row, styled by precision (region = dashed + "region only"), shown by default.
  Panel: `Missions.summary(site).text` + `Missions.LABEL` in small text. Drawer: `dayFail` reasons on calendar days
  ("too close to another mission's hardware" / "another mission plans to land nearby then: coordinate").
- Full note: missions chat's `missions-integration.md`.

## Working rules

- Product goal: anyone understands any part in 0.5 s. Plain English, no unexplained angles. Light theme for the projector is a known TODO (coordinator).
- No git, no commits, no pushes. No edits in the team repo or the engine worktree.
- After each result: a vault note `vault\log\YYYY-MM-DD-HHMM-<chat>-<topic>.md` (use the real clock: `Get-Date -Format yyyy-MM-dd-HHmm`)
  and one line in `vault\AI_USE.md`; new library/font/image/data -> `vault\CREDITS-PENDING.md`. Follow `vault\AGENTS.md`.
- Test in the browser after every change: no console errors, the drawer tabs still fit (no scrolling), your area works with the others.
- When done with a step, tell Eren in two lines what changed and how to see it.
