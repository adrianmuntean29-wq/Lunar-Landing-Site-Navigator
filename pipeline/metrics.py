"""Sun and Earth against a horizon mask: sky table, per-site azimuth/elevation, and the statistics.

Sky table: ONE JPL Horizons call (target Moon 301, observer Earth centre) gives the sub-Earth and sub-solar
points on the Moon every hour for 5 years. From those we get Sun and Earth directions in the Moon-fixed
(MOON_ME) frame, valid for any site. Checked against per-site Horizons az/el (`CENTER='coord@301'`):
max error Sun el 0.0007 deg, Earth el 0.0006, Earth az 0.006 (MEASURED, laptop and home server).

Rules (vault DECISIONS, 2026-11-14):
- Sun % = mean visible fraction of the Sun's disc (radius 0.2666 deg), horizontal-chord approximation.
- Night / sunset = Sun CENTRE below the mask (Eren, 12:10).
- Earth visible = any part of its disc (radius 0.95 deg) above the mask; geometry only, not a radio link.
"""
from __future__ import annotations

import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

from dem import CACHE_DIR, R_MOON

HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api"
AU_M = 149597870700.0
SUN_RADIUS_DEG = 0.2666
EARTH_RADIUS_DEG = 0.95


# ---------------------------------------------------------------- sky table
def _horizons(params: dict) -> str:
    q = {k: f"'{v}'" for k, v in params.items()}
    q["format"] = "text"
    url = HORIZONS_API + "?" + urllib.parse.urlencode(q, safe="',@")
    with urllib.request.urlopen(url, timeout=300) as r:
        text = r.read().decode()
    if "$$SOE" not in text:
        raise RuntimeError("Horizons returned no table:\n" + text[:1500])
    return text


def fetch_sky(start="2027-01-01", stop="2031-12-31 23:00", step="1h", cache=True):
    """Return dict(time=str array, sun=(H,3) unit vectors, earth=(H,3) metres, header=str), Moon-fixed frame."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = CACHE_DIR / f"sky_{start}_{stop}_{step}.npz".replace(" ", "T").replace(":", "")
    if cache and key.exists():
        d = np.load(key)
        return dict(time=d["time"], sun=d["sun"], earth=d["earth"], header=str(d["header"]))
    text = _horizons(dict(COMMAND="301", EPHEM_TYPE="OBSERVER", CENTER="500@399", START_TIME=start, STOP_TIME=stop,
                          STEP_SIZE=step, QUANTITIES="14,15,20", CSV_FORMAT="YES", ANG_FORMAT="DEG"))
    header = text.split("$$SOE")[0]
    if "ME" not in header:  # Horizons prints "Target pole/equ : MOON_ME"
        raise RuntimeError("Horizons header does not name the mean-Earth (ME) frame")
    rows = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    t = np.array([r.split(",")[0].strip() for r in rows])
    a = np.array([[float(v) for v in r.split(",")[3:8]] for r in rows])  # ObsSub lon, lat, SunSub lon, lat, delta AU
    sun = unit_vector(a[:, 2], a[:, 3])
    earth = unit_vector(a[:, 0], a[:, 1]) * (a[:, 4] * AU_M)[:, None]
    np.savez_compressed(key, time=t, sun=sun, earth=earth, header=header)
    return dict(time=t, sun=sun, earth=earth, header=header)


def unit_vector(lon_e_deg, lat_deg):
    lon, lat = np.radians(lon_e_deg), np.radians(lat_deg)
    return np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], axis=-1)


# ---------------------------------------------------------------- per-site angles
def site_basis(lat_deg, lon_e_deg):
    """Local up, east, north unit vectors in the Moon-fixed frame."""
    lat, lon = np.radians(lat_deg), np.radians(lon_e_deg)
    up = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.cross(up, east)
    return up, east, north


def azel(vectors, lat_deg, lon_e_deg, site_radius_m=None):
    """True azimuth (deg, clockwise from north) and elevation (deg) of direction/position vectors.

    Give `site_radius_m` for a body at finite distance (Earth): its position minus the site position is
    used (parallax, ~0.26 deg at the pole; mandatory). Leave None for unit directions (Sun).
    """
    up, east, north = site_basis(lat_deg, lon_e_deg)
    v = np.asarray(vectors, dtype=np.float64)
    if site_radius_m is not None:
        v = v - site_radius_m * up
    v = v / np.linalg.norm(v, axis=-1, keepdims=True)
    az = np.degrees(np.arctan2(v @ east, v @ north)) % 360.0
    el = np.degrees(np.arcsin(np.clip(v @ up, -1, 1)))
    return az, el


# ---------------------------------------------------------------- mask lookup and statistics
def mask_at(mask, az_deg):
    """Horizon elevation at any azimuth: linear between bin centres k+0.5, periodic."""
    x = np.concatenate([[-0.5], np.arange(360) + 0.5, [360.5]])
    y = np.concatenate([[mask[-1]], mask, [mask[0]]])
    return np.interp(np.mod(az_deg, 360.0), x, y)


def sun_fraction(horizon_el, sun_el):
    """Visible share of the Sun's disc: horizon as a horizontal chord across a uniform disc."""
    u = np.clip((horizon_el - sun_el) / SUN_RADIUS_DEG, -1.0, 1.0)
    return (np.arccos(u) - u * np.sqrt(1.0 - u * u)) / np.pi


def longest_run(flags, step_h=1.0):
    """Longest run of True, in hours."""
    f = np.concatenate([[False], np.asarray(flags, bool), [False]]).astype(np.int8)
    d = np.diff(f)
    starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
    return float((ends - starts).max() * step_h) if starts.size else 0.0


def site_series(mask, sky, lat_deg, lon_e_deg, ground_m=0.0, mast_m=0.0):
    """Hourly arrays for one site: sun fraction, sun up (centre), earth visible, sun/earth az-el."""
    s_az, s_el = azel(sky["sun"], lat_deg, lon_e_deg)
    e_az, e_el = azel(sky["earth"], lat_deg, lon_e_deg, site_radius_m=R_MOON + ground_m + mast_m)
    frac = sun_fraction(mask_at(mask, s_az), s_el)
    sun_up = s_el > mask_at(mask, s_az)
    earth_up = e_el + EARTH_RADIUS_DEG > mask_at(mask, e_az)
    return dict(sun_frac=frac, sun_up=sun_up, earth_up=earth_up, sun_az=s_az, sun_el=s_el, earth_az=e_az, earth_el=e_el)


def stats(series, step_h=1.0):
    """Percentages and longest night for a series (any window: slice the arrays first)."""
    return dict(
        sun_pct=round(float(series["sun_frac"].mean() * 100), 2),
        earth_pct=round(float(series["earth_up"].mean() * 100), 2),
        both_pct=round(float((series["sun_up"] & series["earth_up"]).mean() * 100), 2),
        longest_night_h=longest_run(~series["sun_up"], step_h),
    )
