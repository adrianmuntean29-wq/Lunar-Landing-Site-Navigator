# Frontend: browser ephemeris + MVP page (local only, not committed)

Branch `frontend-mvp` in the local clone (based on `english-ui`, PR #1). Nothing committed or pushed; waits for Eren's "push".

## What was built
- `pipeline/make_subpoints.py`: one JPL Horizons call (target 301, observer 500@399, quantities 14,15,19,20,
  2026-01-01 to 2031-01-01 hourly). Keeps every 6th row, stores Moon-centred x,y,z of Earth (km) and Sun (1000 km).
  Stops if the header does not name the mean-Earth frame (Horizons prints `Target pole/equ : MOON_ME`).
- `data/subpoints.json`: 7305 rows, 278 KB (MEASURED, file size).
- **There is no separate `ephem.js`.** The ephemeris code is inline in `index.html` (`ephAt`: 4-point cubic Lagrange in xyz;
  `azel`: subtract site position = parallax, project to local east/north/up, azimuth clockwise from north).
- Page: fake sine-wave Sun/Earth removed; 4 published sites (Glaser 2018 C1 and S, De Rosa 2012 GR1 and MP1) + lat/lon input;
  UTC start-date picker; headline "Sunset/Sunrise in N h, Earthset/Earthrise in N h" (disc centre vs horizon);
  horizon chart on true azimuth with the real Sun/Earth paths; `CREDITS.md` in the repo (uncommitted).
- Optional loader for `data/sites.json` (`{sites:[{id, mask_deg[360]}]}`). **Built as a placeholder only, not as the agreed
  contract** (DECISIONS open item 4). Until it exists every site uses a flat 0 deg horizon and the page says so.

## Measured
- Accuracy vs Horizons topocentric (`CENTER='coord@301'`, `SITE_COORD='222.84,-89.4505,0'`, `QUANTITIES='4'`, airless,
  TLIST 2461375.5 / 2461480.25 / 2462000.75, Sun 10 and Earth 399; compared in the browser with `azel(ephAt(jd))`):
  max error **0.0042 deg** (Earth azimuth), all others <= 0.0003 deg. **MEASURED, n = 6.**
  The research figure 0.0005 deg el (`ephem-libs.md`, n = 721 per site) is the research session's test, not this one.
- Flat-horizon site percentages on the page are placeholders. **Do not quote.**

## 3D view right now (DECISIONS open item 5)
- Neither globe.gl nor three.js. `index.html` uses Adrian's **hand-written WebGL** on a flat pole-centred grid
  (257 x 257 at 375 m, generated demo terrain), now lit by the real Sun as seen from the pole. No site pins on it,
  because the real sites are not on the demo terrain. The page labels it "generated demo".

## Changed
- The page must now be served over HTTP (it fetches `data/subpoints.json`). Opening `index.html` as a file shows an error.
  Local test: `python -m http.server 8765` in the repo folder.

## Open
- Eren: push / PR of the MVP; open items 2 (sunset definition), 4 (file contract), 5 (3D approach).
- Next proposed step (not started): mission panel with sliders (date, mission length, min sun %, min Earth %, max darkness,
  mast height) + ranked site table + landing-window calendar. Red team first (playbook rule 5).
