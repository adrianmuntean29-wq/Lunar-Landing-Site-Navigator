# Engine: check of the seeded first-measurements note

Checked `2026-11-14-1159-engine-first-measurements.md` against the engine session's own test output.
The numbers are right. Corrections below are labels and missing conditions, not values.

## Label corrections
- "Horizons Earth azimuths match a hand calculation": **MEASURED**, not VERIFIED. The check was against the
  engine session's own formula (az = atan2(E.d, N.d)), not an external source. Expected vs Horizons, Jan 2027:
  Shackleton box centre 172 deg (Horizons 164-179), Connecting Ridge 137.5 (130-145), de Gerlache 67.9 (60-75),
  Malapert ~0 (wraps 0-360).
- DEM header: VERIFIED (read from the file's own GeoTIFF tags). Projection vs pyproj: VERIFIED (external library).

## Missing conditions (all MEASURED, scratchpad scripts)
- Horizons "1 call, ~2.5 s" is **per body**: a site needs 2 calls per year (Sun `10`, Earth `399`), ~5 s.
- Masks: 80 m DEM loaded in RAM (0.9 s load), 1440 sub-rays (0.25 deg) max-pooled to 360 bins,
  radial step max(80 m, 0.5% of distance), observer at the surface (mast 0 m).
- Stats: Sun = disc fraction (radius 0.2666 deg, horizontal-chord formula); "night" = fraction < 0.5;
  Earth visible if centre elevation + 0.95 deg > mask (any part of the disc). 100 sites x 720 h: 10 ms.
- The validation run used **250 km reach** and **one calendar year (2027, hourly)**. Glaser 2018 values are
  long-run averages, so C1's 76.2 vs 76.0 match is partly luck until a multi-year run confirms it.
- Earth visibility in the same run: C1 54.5%, S 53.9% (MEASURED, no reference compared yet).

## Malapert gotcha, made precise
Malapert is 121.6 km from the pole, so rays toward the equator leave the +/-304 km grid after ~182 km.
At 150 km reach nothing is cut. At 250 km the last ~70 km are clamped to edge pixels (scipy `mode="nearest"`),
which is wrong data, not missing data. 150 vs 250 km gave 0.000 deg change there, but say it on the slide.

## Still open (engine)
- Shackleton S miss (55.3% vs 81.0%): untested suspects are one year vs long-run, 80 m too coarse at a narrow rim,
  and the coordinate. Next test: 20 m near field and a multi-year window. Do not quote until then.
