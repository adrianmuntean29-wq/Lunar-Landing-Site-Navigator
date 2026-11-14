# Engine: first measurements (scratchpad tests, 2026-11-14 morning)

Seeded by the organizer from the engine session's report. Labels as reported.

## Verified
- DEM header: Float32 heights in metres, extent +/-304 km, no 1737400 offset, NaN nodata.
- Site projection equals pyproj to 0.000 m.
- Horizons Earth azimuths match a hand calculation (east longitude, true north OK).

## Speed (MEASURED)
- Horizon mask: 0.16 s at 150 km reach, 0.19 s at 250 km.
- Horizons, 1 year hourly: 1 call, ~2.5 s.
- Stats: 1.2 ms per site-year.

## Validation, first look (MEASURED; 2027 only, 80 m DEM, observer at the surface)
- Connecting Ridge C1: 76.2% sunlit vs Glaser 2018 76.0%. Match.
- Shackleton rim S: 55.3% vs Glaser 81.0%. **MISS, not explained. Do not quote.**

## Open
- Explain the Shackleton S miss (site coordinates? observer height? 80 m vs 20 m DEM? reach?).
- Horizon reach and sunset definition: see DECISIONS open items 1 and 2.
