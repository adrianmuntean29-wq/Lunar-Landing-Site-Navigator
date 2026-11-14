"""Terrain horizon mask for one site: 360 bins of horizon elevation (deg) in TRUE azimuth.

Method (after Mazarico et al. 2011): cast rays on the 1737.4 km sphere, sample the DEM along each ray,
convert each sample to an elevation angle with the exact spherical formula, keep the maximum.

Decisions this file implements (vault DECISIONS):
- Bin k covers true azimuth [k, k+1) deg clockwise from north; its value is the max of `sub` sub-rays
  inside the bin, so a narrow peak between rays is less likely to be missed.
- Automatic reach (Eren, 2026-11-14 12:40): a ray stops once even the tallest terrain on the map could not
  rise above the horizon already found (Moon curvature makes that happen at a finite distance), or when it
  leaves the grid. MEASURED: identical (0.0000 deg) to walking every ray to the map edge at 5 sites.
- Two tiers: 20 m terrain within `near_m` of the site, 80 m beyond. The site height comes from the finest
  grid available, because it is the single biggest lever on the result.
"""
from __future__ import annotations

import numpy as np

from dem import R_MOON, Grid, latlon_to_xy

N_BINS = 360


def destination(lat, lon, az, theta):
    """Point reached from (lat, lon) along true azimuth `az` after central angle `theta` (all radians)."""
    sl, cl = np.sin(lat), np.cos(lat)
    lat2 = np.arcsin(sl * np.cos(theta) + cl * np.sin(theta) * np.cos(az))
    lon2 = lon + np.arctan2(np.sin(az) * np.sin(theta) * cl, np.cos(theta) - sl * np.sin(lat2))
    return lat2, lon2


def distances(near_m, near_px, far_px, frac, max_m):
    """Sample distances: fine steps near the site, growing with distance (error ~frac x slope)."""
    d = [near_px if near_m > 0 else far_px]
    while d[-1] < max_m:
        px = near_px if d[-1] < near_m else far_px
        d.append(d[-1] + max(px, frac * d[-1]))
    return np.asarray(d)


def elevation_deg(r1, theta, r0):
    """Elevation of a point at radius r1, central angle theta, seen from radius r0 (exact, curvature in)."""
    return np.degrees(np.arctan2(r1 * np.cos(theta) - r0, r1 * np.sin(theta)))


def horizon_mask(lat_deg, lon_e_deg, far: Grid, near: Grid | None = None, *, near_m=10000.0,
                 mast_m=0.0, sub=4, frac=0.005, dem_max_m=None, block=64, max_m=650000.0):
    """Return (mask[360] in deg, info dict).

    info: h0_m (site ground height), stop_km_max, edge_rays (bins with a ray that reached the far-grid
    edge before the automatic stop; their horizon may be slightly low), samples.
    """
    lat, lon = np.radians(lat_deg), np.radians(lon_e_deg)
    if near is None:
        near_m = 0.0
    x0, y0 = latlon_to_xy(lat_deg, lon_e_deg)
    ground = near if near is not None else far
    h0 = float(ground.sample(np.array([x0]), np.array([y0]))[0])
    r0 = R_MOON + h0 + mast_m

    if dem_max_m is None:
        dem_max_m = float(np.nanmax(far.z))
    if near is not None:
        dem_max_m = max(dem_max_m, float(np.nanmax(near.z)))
    near_px = near.pixel if near is not None else far.pixel
    D = distances(near_m, near_px, far.pixel, frac, max_m)
    TH = D / R_MOON
    is_near = D <= near_m

    # Best elevation any terrain on the map could reach at or beyond each distance.
    bound = elevation_deg(R_MOON + dem_max_m, TH, r0)
    bound = np.maximum.accumulate(bound[::-1])[::-1]

    n = N_BINS * sub
    az = np.radians((np.arange(n) + 0.5) / sub)
    best = np.full(n, -90.0)
    edge = np.zeros(n, bool)
    stop = np.zeros(n)
    active = np.arange(n)
    samples = 0

    for i0 in range(0, D.size, block):
        if active.size == 0:
            break
        sl = slice(i0, min(i0 + block, D.size))
        th = TH[sl][None, :]
        lat2, lon2 = destination(lat, lon, az[active][:, None], th)
        rho = 2 * R_MOON * np.tan(np.pi / 4 + lat2 / 2)
        x, y = rho * np.sin(lon2), rho * np.cos(lon2)

        h = np.empty_like(x)
        nm = is_near[sl]
        if nm.any():
            h[:, nm] = near.sample(x[:, nm], y[:, nm])
        if (~nm).any():
            h[:, ~nm] = far.sample(x[:, ~nm], y[:, ~nm])
        inside = far.inside(x, y)
        samples += h.size

        el = elevation_deg(R_MOON + h, th, r0)
        el[~inside] = -90.0
        best[active] = np.maximum(best[active], el.max(axis=1))

        left = ~inside.all(axis=1)
        edge[active[left]] = True
        nxt = sl.stop
        done = left | (nxt >= D.size)
        if nxt < D.size:
            done |= best[active] >= bound[nxt]
        stop[active[done]] = D[nxt - 1]
        active = active[~done]

    mask = best.reshape(N_BINS, sub).max(axis=1)
    info = dict(h0_m=h0, stop_km_max=float(stop.max() / 1000), edge_rays=int(edge.reshape(N_BINS, sub).any(axis=1).sum()),
                samples=int(samples))
    return mask, info
