# Engine: benchmarks for the site x date concept (RESEARCH brief, 2026-11-14)

All MEASURED on Eren's laptop (12 logical cores, Python 3.14 + NumPy, Node 24 for JS), scratchpad scripts,
80 m DEM in RAM. Nothing in the repo. Masks are 360 bins, surface observer.

## 1. One horizon mask (target < 20 ms)
| Rays/deg | Radial step | 150 km | 250 km | Error vs reference (max / mean) |
|---|---|---|---|---|
| 4 | 0.5% of d | 171 ms | 202 ms | reference |
| 2 | 1% | 53 ms | 58 ms | 0.09 / 0.009 deg |
| 1 | 1% | 25 ms | 29 ms | 0.15 / 0.024 deg |
| 1 | 2% | **14 ms** | **18 ms** | 0.21-0.40 / 0.027 deg |
| 1 | 4% | 8 ms | 9 ms | 0.38-0.65 / 0.036 deg |
- Under 20 ms costs accuracy: max error 0.2-0.4 deg (Sun radius is 0.27). Fine for a 1 km map, not for named sites.
- Named sites keep the reference setting (~0.2 s each, irrelevant for a handful).
- Nested 20 m near field NOT measured (20 m tiles not cached). Estimate: +~250 samples/ray to 5 km, ~2x time (UNVERIFIED).

## 2. Whole south pole at 1 km
- Spots within 6 deg of the pole: **104,183** (radius 182.1 km).
- Fast setting (1 ray/deg, 2%, 250 km): 23 ms/mask single core in the real loop; **~13 min with 6 workers**
  (11 workers no faster: memory-bound).
- File: uint8 (0.1 deg steps) **37.5 MB**, gzip ratio 0.42 -> ~16 MB. float16 75 MB.
- Caveat: spots beyond ~54 km (250 km reach) or ~154 km (150 km reach) from the pole have rays leaving the 80S grid.

## 3. Five-year sky table (Horizons)
- **One call returns 5 years hourly** (2027-01-01 to 2031-12-31, 43,824 rows): per-site az/el 6.3 s (2.2 MB text);
  sub-solar + sub-Earth points 9.7 s (4.6 MB text). No splitting needed.
- As float32 (Sun xyz + Earth xyz): **1.05 MB** for 5 years.
- Sub-point vectors vs per-site Horizons (2027): Sun el 0.0007, Earth el 0.0006, Earth az 0.006 deg max. Agrees with FRONTEND CODE's test.

## 4. Time layer (Sun up, Earth up per hour)
- (a) One site x 5 years: **Python 12 ms**, **JS 2.9 ms** (incl. az/el, mask lookup).
- (b) 5,000 spots x 5 years in JS: **14.3 s** single thread (~2.9 s for 1 year). Web Workers could cut it ~4x (UNVERIFIED).
- (c) Whole pole x 5 years in Python (daily counts): 4.5 ms/spot -> **~8 min single core**, ~2 min on 6 cores (estimate).
  Output: daily = 380 MB (too big for Pages); monthly = 12.5 MB.

## Gotchas found
- PGDA box centres are not good site points in general: Connecting Ridge box centre (89.46 S 222.5 E) = 36.2% sun
  over 2027-2031, vs Glaser C1 76%. Use published points (C1, S, GR1, MP1) for named sites.
- The browser cannot read the fine DEM (PGDA sends no CORS). So "~100 m detail where the user clicks" cannot be computed
  from real fine terrain in the browser. Detail masks must be precomputed offline.

## Recommendation (for Eren)
| Layer | Where | File for the page | Size |
|---|---|---|---|
| Sky table 5 y hourly | Python, once | `sky.bin` (float32) | ~1 MB |
| Named-site masks + stats | Python, reference accuracy | `sites.json` | < 50 KB |
| Pole map masks, 1 km | Python, ~13 min | `pole_masks.bin` (uint8) | 37.5 MB raw, ~16 MB gz |
| Pole map time summaries | Python, ~2-8 min | monthly sun%/earth% per spot, uint8 | 12.5 MB for 5 y |
| Detail areas ~100 m | Python, precomputed around named sites only (e.g. 10x10 km = 10k spots) | `detail_<site>.bin` | ~3.6 MB each |
| Hourly windows (calendar) | Browser, on click, from masks + sky table | none | 3 ms per spot-5y |
| heights.bin (draw + approximate clicks) | Python | ~600 m grid | ~4 MB |
- Whole pole x 5 years hourly in the browser: not viable (~5 min single thread). Ship monthly summaries; compute hourly only for clicked spots.
- Hourly landing windows for a zoomed area of 5,000 spots: 3-15 s in JS. Acceptable only with a progress bar and 1-year default.
