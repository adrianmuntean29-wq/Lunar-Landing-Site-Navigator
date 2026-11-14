"""Build data/psr.json: permanently shadowed regions (PSRs) for the map, and the distance from a site to the nearest one.

Why (Eren, 2026-11-14 14:20): water ice is the reason missions target the south pole; ice can only last where the Sun
never shines, and a lander needs sun. So the useful question is "how close is a sunny spot to permanent shadow".
A PSR is a lighting MODEL, not an ice detection: label it "permanently shadowed (LOLA model)", never "ice".

Source: PGDA product 90 `LPSR_80S_20MPP_ADJ` shapefile (Barker et al. 2023), 506,349 polygons at 20 m, polar
stereographic metres (same projection as our DEM). We keep PSRs >= 1 km^2 (the product's own large-PSR subset size):
smaller ones are tiny pockets next to almost every rim and would make "distance to shadow" meaningless.

Run from pipeline/ (after downloading the shapefile set into <DATA_DIR>/psr/, see README):  python build_psr.py
"""
from __future__ import annotations

import json
import pickle
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import dem

SRC = dem.DATA_DIR / "psr" / "LPSR_80S_20MPP_ADJ"
CACHE = dem.CACHE_DIR / "psr_large.pkl"
OUT = Path(__file__).resolve().parents[1] / "data" / "psr.json"
MIN_AREA_KM2 = 1.0
SIMPLIFY_M = 120.0   # display only; distances use the full 20 m outlines
ROUND_M = 10         # output coordinates rounded to 10 m


def load_large():
    """Unsimplified PSR polygons >= MIN_AREA_KM2 as shapely geometries (cached)."""
    if CACHE.exists():
        return pickle.loads(CACHE.read_bytes())
    import shapefile
    from shapely.geometry import shape

    out = []
    with shapefile.Reader(str(SRC)) as r:
        i_area = [f[0] for f in r.fields[1:]].index("area_km2")
        for sr in r.iterShapeRecords():
            area = float(sr.record[i_area])
            if area >= MIN_AREA_KM2:
                out.append((int(sr.record[0]), area, shape(sr.shape.__geo_interface__)))
    dem.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE.write_bytes(pickle.dumps(out))
    return out


_TREE = None


def nearest_psr_km(lat_deg, lon_e_deg):
    """Straight-line distance (km, in projected metres) from a site to the edge of the nearest PSR >= 1 km^2; 0 if inside."""
    global _TREE
    from shapely.geometry import Point
    from shapely.strtree import STRtree

    if _TREE is None:
        geoms = [g for _, _, g in load_large()]
        _TREE = (STRtree(geoms), geoms)
    tree, geoms = _TREE
    p = Point(*dem.latlon_to_xy(lat_deg, lon_e_deg))
    i = tree.nearest(p)
    return round(geoms[i].distance(p) / 1000.0, 2)


def _rings(geom):
    polys = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
    out = []
    for p in polys:
        for ring in [p.exterior, *p.interiors]:
            c = (np.round(np.asarray(ring.coords) / ROUND_M) * ROUND_M).astype(int)
            if len(c) >= 4:
                out.append(c.tolist())
    return out


def main():
    from build_sites import code_version

    large = load_large()
    polys = []
    for gid, area, g in large:
        s = g.simplify(SIMPLIFY_M, preserve_topology=True)
        rings = _rings(s)
        if rings:
            polys.append(dict(id=gid, area_km2=round(area, 2), rings=rings))
    doc = dict(
        generated_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        versions=dict(psr=f"LPSR_80S_20MPP_ADJ shapefile (PGDA 90, {dem.DEM_DATE})", code=code_version()),
        label="permanently shadowed (LOLA model)",
        note="lighting model, not an ice detection; PSRs >= 1 km^2 only; outlines simplified for display",
        crs=dem.PROJ4, units="m", min_area_km2=MIN_AREA_KM2, simplify_m=SIMPLIFY_M, coord_round_m=ROUND_M,
        rings="first ring of each polygon part is its outline, later rings are holes; [x, y] pairs",
        count=len(polys), total_area_km2=round(sum(p["area_km2"] for p in polys), 1),
        polygons=polys,
    )
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"psr.json: {len(polys)} PSRs >= {MIN_AREA_KM2} km^2, {doc['total_area_km2']} km^2, "
          f"{OUT.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
