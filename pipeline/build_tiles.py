"""Build one detailed terrain tile per named site, for the Landing Site 3D view (display only).

Every number on the page still comes from the exact horizon masks in data/sites.json; these tiles only
let the 3D view centre on any named site (heights.bin covers just +/-60 km around the pole).

Per site in data/sites.json: a 50 x 50 km square at 100 m (500 x 500), block mean of 5 x 5 pixels of the
20 m PGDA 90 DEM (exact, no interpolation). The tile edges sit on the 100 m grid of the DEM, so the site is
within 50 m of the tile centre per axis (centre_lat / centre_lon_e give the site itself; use x/y to place it).

Output data/tiles/<id>.bin: Float32 little-endian, row-major, row 0 = north edge (+y), NaN = no data,
metres above the 1737400 m sphere. data/tiles/<id>.json: same fields as terrain_meta.json plus
site_id, centre_lat, centre_lon_e, site_x, site_y.

Run from pipeline/:  python build_tiles.py [--force] [--src <local LDEM_80S_20MPP_ADJ.TIF>]
Reads the 20 m DEM over HTTP (/vsicurl) by default: ~25 MB per site. Existing tiles are skipped unless --force.
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import dem
from build_sites import code_version

DATA = Path(__file__).resolve().parents[1] / "data"
OUT = DATA / "tiles"
SIZE_M = 50000.0
PIXEL_M = 100.0
SRC_PX = 20.0
FACTOR = int(PIXEL_M / SRC_PX)


def read_20m(x_min, y_max, src):
    import rasterio
    from rasterio.windows import Window

    url = src or f"/vsicurl/{dem.PGDA_BASE}{dem.DEM_20M}"
    env = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".TIF", GDAL_HTTP_MAX_RETRY="5",
               GDAL_HTTP_RETRY_DELAY="5")
    n = int(round(SIZE_M / SRC_PX))
    with rasterio.Env(**env):
        with rasterio.open(url) as ds:
            t = ds.transform
            assert abs(t.a - SRC_PX) < 1e-6, t
            c0 = int(round((x_min - t.c) / t.a))
            r0 = int(round((t.f - y_max) / -t.e))
            z = ds.read(1, window=Window(c0, r0, n, n)).astype(np.float32)
            nd = ds.nodata
    if nd is not None:
        z[z == nd] = np.nan
    return z


def build(site, src, far_max):
    x, y = dem.latlon_to_xy(site["lat"], site["lon_e"])
    x, y = float(x), float(y)
    x_min = round((x - SIZE_M / 2) / PIXEL_M) * PIXEL_M
    y_max = round((y + SIZE_M / 2) / PIXEL_M) * PIXEL_M
    z20 = read_20m(x_min, y_max, src)
    k = z20.shape[0] // FACTOR
    z = z20.reshape(k, FACTOR, k, FACTOR).mean(axis=(1, 3)).astype("<f4")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{site['id']}.bin").write_bytes(z.tobytes())
    meta = dict(
        generated_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        versions=dict(dem=f"{dem.DEM_20M} (PGDA 90, {dem.DEM_DATE}), block mean of 5 x 5 pixels of 20 m",
                      code=code_version()),
        purpose="3D view only (display); numbers come from the horizon masks in sites.json",
        site_id=site["id"], site_name=site["name"], centre_lat=site["lat"], centre_lon_e=site["lon_e"],
        site_x=round(x, 2), site_y=round(y, 2),
        nx=int(z.shape[1]), ny=int(z.shape[0]), pixel_m=PIXEL_M,
        x_min=x_min, y_max=y_max, x_max=x_min + z.shape[1] * PIXEL_M, y_min=y_max - z.shape[0] * PIXEL_M,
        corner="x_min/y_max are the outer edges of pixel (0,0); pixel centres sit half a pixel inside; "
               "the site is within 50 m of the tile centre on each axis, up to 71 m diagonally (tile edges on the 100 m grid of the DEM); place it with site_x, site_y",
        layout="Float32 little-endian, row-major, row 0 = north edge (+y), NaN = no data",
        units="metres above the 1737400 m sphere",
        crs=dem.PROJ4, axes="+x toward 90 E, +y toward 0 E; lon = atan2(x, y)",
        h_min=round(float(np.nanmin(z)), 1), h_max=round(float(np.nanmax(z)), 1),
        nan_count=int(np.isnan(z).sum()),
        dem_max_m=round(far_max, 2),
        dem_max_note="max of the full-resolution 80 m DEM (not this tile)",
    )
    (OUT / f"{site['id']}.json").write_text(json.dumps(meta, indent=1))
    return z, meta


def check(site, z, meta):
    """Tile height at the site (bilinear) vs sites.json ground_m (bilinear on the 20 m DEM)."""
    g = dem.Grid(z=np.asarray(z, dtype=np.float32), pixel=meta["pixel_m"], x_min=meta["x_min"], y_max=meta["y_max"], name="tile")
    h = float(g.sample(meta["site_x"], meta["site_y"]))
    size_ok = (OUT / f"{site['id']}.bin").stat().st_size == meta["nx"] * meta["ny"] * 4
    return h, h - site["ground_m"], size_ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--src", help="local path of LDEM_80S_20MPP_ADJ.TIF (default: PGDA over HTTP)")
    ap.add_argument("--only", help="comma-separated site ids")
    a = ap.parse_args()
    sites = json.loads((DATA / "sites.json").read_text())["sites"]
    if a.only:
        sites = [s for s in sites if s["id"] in a.only.split(",")]
    far_max = float(np.nanmax(dem.load_far().z))
    print("id  ground_m  tile_m  diff_m  size_ok  nan  h_min..h_max  secs")
    for s in sites:
        t0 = time.time()
        b, j = OUT / f"{s['id']}.bin", OUT / f"{s['id']}.json"
        if b.exists() and j.exists() and not a.force:
            meta = json.loads(j.read_text())
            z = np.fromfile(b, dtype="<f4").reshape(meta["ny"], meta["nx"])
        else:
            z, meta = build(s, a.src, far_max)
        h, d, ok = check(s, z, meta)
        print(f"{s['id']}  {s['ground_m']:8.1f}  {h:6.1f}  {d:+6.1f}  {ok}  {meta['nan_count']}  "
              f"{meta['h_min']}..{meta['h_max']}  {time.time() - t0:.0f}", flush=True)


if __name__ == "__main__":
    main()
