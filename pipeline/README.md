# Engine pipeline

Python precomputes; the static page reads the files in `data/`.

| File | What | Built by |
|---|---|---|
| `data/sites.json` | 360-bin horizon masks (masts 0/2/10 m) + 2027 and 5-year stats for the named sites | `build_sites.py` |
| `data/heights.bin` + `terrain_meta.json` | +/-60 km at 240 m, 3D view only | `build_terrain.py` |
| `data/cap_heights.bin` + `cap_meta.json` | whole cap at 640 m, approximate masks for clicked spots | `build_terrain.py` |
| `data/psr.json` | 1,531 permanently shadowed regions >= 1 km^2, outlines for the map (LOLA model, not ice) | `build_psr.py` |

## Run
```bash
pip install numpy scipy rasterio pyproj pytest pyshp shapely
curl -L -C - -o ../data/LDEM_80S_80MPP_ADJ.TIF https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF
mkdir -p ../data/psr && for e in SHP SHX DBF PRJ; do curl -L -C - -o ../data/psr/LPSR_80S_20MPP_ADJ.$e https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LPSR_80S_20MPP_ADJ.$e; done
cd pipeline
python -m pytest -q tests
python build_psr.py      # before build_sites (gives psr_km)
python build_sites.py
python build_terrain.py
```
The 80 m DEM (181 MB) and caches live outside git, in `PEAKS_DATA_DIR` (default: the folder `data/` next to the repo checkout).
20 m windows around each site and the 5-year Horizons table are fetched once and cached there.

## Modules
- `dem.py`: terrain loading, polar stereographic projection, 20 m windows.
- `horizon.py`: horizon mask (true azimuth, exact curvature, automatic reach, 20 m near / 80 m far).
- `metrics.py`: 5-year Sun/Earth table from one Horizons call, per-site azimuth/elevation, statistics.

## Rules (team decisions)
Sun % = disc-fraction mean; night = Sun centre below the horizon; Earth visible = any part of its disc above the horizon
(geometry only, not a radio link); site height from the 20 m DEM; headline the 2 m mast values (surface values swing with
small slopes near the site).

## Data
LOLA LDEM_80S_80MPP_ADJ / 20MPP_ADJ, PGDA product 90 (Barker et al. 2023, doi:10.3847/PSJ/acf3e1). JPL Horizons API.
