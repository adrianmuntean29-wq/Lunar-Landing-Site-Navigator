"""LOLA south-pole terrain: loading, map projection and sampling.

Data: PGDA product 90 (Barker et al. 2023), LDEM_80S_*MPP_ADJ, Float32 heights in metres above the
1737.4 km sphere, south polar stereographic, MOON_ME frame of DE421. Grids span +/-304 km from the pole,
north-up, top-left corner (-304000, +304000).

Why two resolutions: the horizon of a polar site is set by terrain up to ~270 km away (80 m is enough
there), but the site's own height and the ground within a few km decide whether the Sun clears the
nearest bump. Home-server runs (vault log 2026-11-14-1400) showed 20 m terrain beyond 5 km changes
nothing, while the site height source alone moved Shackleton S from 56% to 84% sunlight.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.ndimage import map_coordinates

R_MOON = 1737400.0  # m, LOLA reference sphere
PROJ4 = "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m"
HALF_EXTENT = 304000.0  # m, grid edge distance from the pole

PGDA_BASE = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/"
DEM_80M = "LDEM_80S_80MPP_ADJ.TIF"
DEM_20M = "LDEM_80S_20MPP_ADJ.TIF"
DEM_DATE = "2023-07-07"  # Last-Modified of the PGDA files

# Data lives outside git (181 MB / 2.7 GB). Default: <event folder>/data, next to the repo checkout.
DATA_DIR = Path(os.environ.get("PEAKS_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
CACHE_DIR = DATA_DIR / "cache"


def latlon_to_xy(lat_deg, lon_e_deg):
    """Planetocentric lat / east lon (deg) -> polar stereographic x, y (m). x toward 90 E, y toward 0 E."""
    lat = np.radians(lat_deg)
    lon = np.radians(lon_e_deg)
    rho = 2.0 * R_MOON * np.tan(np.pi / 4.0 + lat / 2.0)
    return rho * np.sin(lon), rho * np.cos(lon)


def xy_to_latlon(x, y):
    rho = np.hypot(x, y)
    lat = -(90.0 - np.degrees(2.0 * np.arctan(rho / (2.0 * R_MOON))))
    lon = np.degrees(np.arctan2(x, y)) % 360.0
    return lat, lon


@dataclass
class Grid:
    """A north-up raster in polar stereographic metres."""
    z: np.ndarray        # (rows, cols) float32, NaN = no data
    pixel: float         # m
    x_min: float         # left edge of column 0 (m)
    y_max: float         # top edge of row 0 (m)
    name: str

    @property
    def x_max(self):
        return self.x_min + self.z.shape[1] * self.pixel

    @property
    def y_min(self):
        return self.y_max - self.z.shape[0] * self.pixel

    def inside(self, x, y, margin=1.0):
        """True where (x, y) is at least `margin` pixels inside the grid."""
        m = margin * self.pixel
        return (x >= self.x_min + m) & (x <= self.x_max - m) & (y >= self.y_min + m) & (y <= self.y_max - m)

    def sample(self, x, y):
        """Bilinear height at (x, y). Points outside get the nearest edge value; check `inside` first."""
        col = (np.asarray(x) - self.x_min) / self.pixel - 0.5
        row = (self.y_max - np.asarray(y)) / self.pixel - 0.5
        shape = np.shape(col)
        out = map_coordinates(self.z, [row.ravel(), col.ravel()], order=1, mode="nearest")
        return out.reshape(shape)

    def sample_latlon(self, lat_deg, lon_e_deg):
        x, y = latlon_to_xy(lat_deg, lon_e_deg)
        return self.sample(x, y)


def _read_full(path: Path, name: str) -> Grid:
    import rasterio
    with rasterio.open(path) as ds:
        z = ds.read(1).astype(np.float32)
        t = ds.transform
        if abs(ds.scales[0] - 1) > 0 or abs(ds.offsets[0]) > 0:
            raise ValueError(f"{path}: unexpected scale/offset {ds.scales}/{ds.offsets} (radius, not height?)")
        return Grid(z=z, pixel=t.a, x_min=t.c, y_max=t.f, name=name)


def load_far(path: Path | None = None) -> Grid:
    """The whole 80 m grid in RAM (231 MB). Download it once: see pipeline/README.md."""
    path = Path(path) if path else DATA_DIR / DEM_80M
    if not path.exists():
        raise FileNotFoundError(f"{path} missing. curl -L -C - -o '{path}' {PGDA_BASE}{DEM_80M}")
    return _read_full(path, DEM_80M)


def load_near(lat_deg, lon_e_deg, radius_m=12000.0, src: str | None = None) -> Grid:
    """A 20 m window around a site, read over HTTP (COG range reads) and cached as .npz.

    `src` may point at a local copy of LDEM_80S_20MPP_ADJ.TIF; default is the PGDA URL via /vsicurl/.
    """
    import rasterio
    from rasterio.windows import from_bounds

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = f"ldem20_{lat_deg:.4f}_{lon_e_deg:.4f}_{int(radius_m)}.npz"
    cache = CACHE_DIR / key
    if cache.exists():
        d = np.load(cache)
        return Grid(z=d["z"], pixel=float(d["pixel"]), x_min=float(d["x_min"]), y_max=float(d["y_max"]), name=DEM_20M)

    x, y = latlon_to_xy(lat_deg, lon_e_deg)
    url = src or f"/vsicurl/{PGDA_BASE}{DEM_20M}"
    env = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".TIF", GDAL_HTTP_MAX_RETRY="5")
    with rasterio.Env(**env):
        with rasterio.open(url) as ds:
            win = from_bounds(x - radius_m, y - radius_m, x + radius_m, y + radius_m, ds.transform)
            win = win.round_offsets().round_lengths()
            z = ds.read(1, window=win).astype(np.float32)
            t = ds.window_transform(win)
    grid = Grid(z=z, pixel=t.a, x_min=t.c, y_max=t.f, name=DEM_20M)
    np.savez_compressed(cache, z=z, pixel=grid.pixel, x_min=grid.x_min, y_max=grid.y_max)
    return grid


def read_point(filename: str, lat_deg, lon_e_deg, radius_m=0.0):
    """Value of another PGDA 90 layer (e.g. *_ERR, *_EFFRES) at a site: centre pixel, or the max within radius."""
    import rasterio
    from rasterio.windows import Window

    x, y = latlon_to_xy(lat_deg, lon_e_deg)
    env = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".TIF")
    with rasterio.Env(**env):
        with rasterio.open(f"/vsicurl/{PGDA_BASE}{filename}") as ds:
            row, col = ds.index(x, y)
            k = int(np.ceil(radius_m / ds.res[0]))
            # sites are far from the grid edge; a boundless read builds a VRT that fails over /vsicurl/
            a = ds.read(1, window=Window(col - k, row - k, 2 * k + 1, 2 * k + 1)).astype(np.float64)
    return float(a[k, k]) if radius_m <= 0 else float(np.nanmax(a))


def save_meta(path: Path, **meta):
    path.write_text(json.dumps(meta, indent=1))
