Read-only copies for the draft app. Do not edit here.
- sites.json (10 sites A-J since ~19:00, engine-wt uncommitted), psr.json, heights.bin, terrain_meta.json, cap_heights.bin, cap_meta.json: engine output, copied 2026-11-14 from
  engine-wt\data (engine commit 07c5981 = merged into origin/main as PR #4, bfb796e; JSON line endings differ only).
- subpoints.json: pipeline/make_subpoints.py output (JPL Horizons), from the repo clone's data\ (same bytes as origin/mission-simulator).
- missions.csv: hand-built other-missions table (coordinator owns it).
To refresh: copy again from the engine's data\ folder; never hand-edit.
- tiles/<A-J>.bin + .json: one 50 x 50 km terrain tile per named site at 100 m (500 x 500, block mean of the 20 m PGDA 90 DEM), display only; engine output from engine-wt\pipeline\build_tiles.py (uncommitted), copied 2026-11-14 19:30 from engine-wt\data\tiles. Format = heights.bin plus site_id, centre_lat, centre_lon_e, site_x, site_y.
- site_ranges.json: engine-2 (engine-wt\data, build_ranges.py, UNCOMMITTED), 25 exact masks per site (centre + 25 m + 50 m rings), 2 m mast, 2027-2031. Copied ~20:00.
zones.json  Tudor's 11 candidate landing zones (team analysis: LOLA slope/hillshade, PGDA 90 roughness, PSR), built by engine-3 (engine-wt/data/zones.json, 2026-11-14 ~21:20). Label 'Flat, smooth terrain (team analysis)' (Eren 2026-11-15; not chosen for sunlight), never NASA. Read by core.js -> App.zones / App.zoneAt.
