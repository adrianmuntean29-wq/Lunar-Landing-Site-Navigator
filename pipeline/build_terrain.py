"""Build the two terrain grids for the page (Eren, 2026-11-14 13:25: option b).

1. data/heights.bin + terrain_meta.json: +/-60 km around the pole at 240 m, for the 3D view only.
2. data/cap_heights.bin + cap_meta.json: the whole +/-304 km cap at 640 m, for approximate horizon masks
   at clicked spots in the browser (labelled "approximate" in the UI).

Both are block means of whole 80 m pixels (240 = 3 x 80, 640 = 8 x 80), so no interpolation artefacts.
640 m instead of the 600 m first discussed: 600 is not a multiple of 80, 640 tiles the grid exactly (950 x 950).
Float32 little-endian, row-major, row 0 = north edge (+y), NaN = no data.

Run from pipeline/:  python build_terrain.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import dem
from build_sites import code_version

OUT = Path(__file__).resolve().parents[1] / "data"


def block_mean(far: dem.Grid, x_min, y_max, size_m, factor):
    c0 = int(round((x_min - far.x_min) / far.pixel))
    r0 = int(round((far.y_max - y_max) / far.pixel))
    n = int(round(size_m / far.pixel))
    z = far.z[r0:r0 + n, c0:c0 + n]
    k = n // factor
    return z[:k * factor, :k * factor].reshape(k, factor, k, factor).mean(axis=(1, 3)).astype("<f4")


def write(name, meta_name, z, pixel, x_min, y_max, purpose, far_max):
    (OUT / name).write_bytes(z.tobytes())
    meta = dict(
        generated_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        versions=dict(dem=f"{dem.DEM_80M} (PGDA 90, {dem.DEM_DATE}), block mean of 80 m pixels", code=code_version()),
        purpose=purpose,
        nx=int(z.shape[1]), ny=int(z.shape[0]), pixel_m=pixel,
        x_min=x_min, y_max=y_max, x_max=x_min + z.shape[1] * pixel, y_min=y_max - z.shape[0] * pixel,
        corner="x_min/y_max are the outer edges of pixel (0,0); pixel centres sit half a pixel inside",
        layout="Float32 little-endian, row-major, row 0 = north edge (+y), NaN = no data",
        units="metres above the 1737400 m sphere",
        crs=dem.PROJ4, axes="+x toward 90 E, +y toward 0 E; lon = atan2(x, y)",
        h_min=round(float(np.nanmin(z)), 1), h_max=round(float(np.nanmax(z)), 1),
        dem_max_m=round(far_max, 2),
        dem_max_note="max of the full-resolution 80 m DEM (not this grid); use it for the auto-stop bound",
    )
    (OUT / meta_name).write_text(json.dumps(meta, indent=1))
    print(f"{name}: {z.shape[1]}x{z.shape[0]} at {pixel} m, {(OUT / name).stat().st_size / 1e6:.2f} MB, "
          f"h {meta['h_min']}..{meta['h_max']} m")


def main():
    far = dem.load_far()
    far_max = float(np.nanmax(far.z))
    OUT.mkdir(parents=True, exist_ok=True)
    z = block_mean(far, -60000.0, 60000.0, 120000.0, 3)
    write("heights.bin", "terrain_meta.json", z, 240.0, -60000.0, 60000.0, "3D view only (display)", far_max)
    z = block_mean(far, -304000.0, 304000.0, 608000.0, 8)
    write("cap_heights.bin", "cap_meta.json", z, 640.0, -304000.0, 304000.0,
          "approximate horizon masks at clicked spots (label: approximate, 640 m terrain)", far_max)


if __name__ == "__main__":
    main()
