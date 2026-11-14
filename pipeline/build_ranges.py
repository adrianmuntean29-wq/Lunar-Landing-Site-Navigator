"""How much a site's numbers move within 50 m: data/site_ranges.json.

Why: one point's sun % can swing tens of points within 20-40 m (vault GOTCHAS, log 2026-11-14-1530), so a single
value per site is fragile. For each site in data/sites.json this computes exact horizon masks (same engine and
settings as build_sites.py: 20 m terrain within 10 km, 80 m beyond, 2 m mast) at 25 points: the site, 8 points on a
25 m ring and 16 points on a 50 m ring. It reports min / median / max over those points for the 2027-2031 stats,
plus the best-lit point. No slope filter: some ring points may be too steep to land on.

Run from pipeline/:  python build_ranges.py [--only A,B] [--workers 5]
"""
from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import dem
import horizon
import metrics
from build_sites import NEAR_M, code_version

DATA = Path(__file__).resolve().parents[1] / "data"
MAST_M = 2
RINGS = [(0.0, 1), (25.0, 8), (50.0, 16)]
KEYS = ["sun_pct", "earth_pct", "both_pct", "longest_night_h"]


def ring_points(lat, lon_e):
    x0, y0 = dem.latlon_to_xy(lat, lon_e)
    pts = []
    for r, n in RINGS:
        for k in range(n):
            a = 2 * np.pi * k / n
            x, y = x0 + r * np.sin(a), y0 + r * np.cos(a)
            la, lo = dem.xy_to_latlon(x, y)
            pts.append(dict(r_m=r, lat=round(float(la), 6), lon_e=round(float(lo), 6)))
    return pts


def run_site(site):
    t0 = time.time()
    far = dem.load_far()
    dem_max = float(np.nanmax(far.z))
    sky = metrics.fetch_sky()
    near = dem.load_near(site["lat"], site["lon_e"], radius_m=NEAR_M + 2000)
    pts = ring_points(site["lat"], site["lon_e"])
    for p in pts:
        m, info = horizon.horizon_mask(p["lat"], p["lon_e"], far, near, near_m=NEAR_M, mast_m=MAST_M, dem_max_m=dem_max)
        ser = metrics.site_series(m, sky, p["lat"], p["lon_e"], info["h0_m"], MAST_M)
        p.update(ground_m=round(info["h0_m"], 1), edge_rays=info["edge_rays"], **metrics.stats(ser))
    rng = {}
    for k in KEYS:
        v = np.array([p[k] for p in pts], dtype=float)
        rng[k] = dict(min=round(float(v.min()), 2), median=round(float(np.median(v)), 2), max=round(float(v.max()), 2))
    best = max(pts, key=lambda p: p["sun_pct"])
    return dict(id=site["id"], name=site["name"], lat=site["lat"], lon_e=site["lon_e"],
                centre=pts[0], range_50m=rng, best_lit=best, points=pts, secs=round(time.time() - t0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--workers", type=int, default=5)
    a = ap.parse_args()
    sites = json.loads((DATA / "sites.json").read_text())["sites"]
    if a.only:
        sites = [s for s in sites if s["id"] in a.only.split(",")]
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        res = list(ex.map(run_site, sites))
    for r in res:
        g = r["range_50m"]
        print(f"{r['id']} centre sun {r['centre']['sun_pct']:.1f}  sun {g['sun_pct']['min']}-{g['sun_pct']['max']} "
              f"(median {g['sun_pct']['median']})  earth {g['earth_pct']['min']}-{g['earth_pct']['max']}  "
              f"night {g['longest_night_h']['min']}-{g['longest_night_h']['max']} h  {r['secs']} s", flush=True)
    doc = dict(
        generated_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        versions=dict(code=code_version(), note="same DEM, ephemeris and rules as sites.json"),
        method=f"{MAST_M} m mast, 2027-01-01..2031-12-31 hourly; 25 points per site: centre + 8 at 25 m + 16 at 50 m "
               "(polar stereographic metres); min/median/max over the 25; no slope filter",
        sites=res,
    )
    out = DATA / ("site_ranges.json" if not a.only else "site_ranges_test.json")
    out.write_text(json.dumps(doc, indent=1))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
