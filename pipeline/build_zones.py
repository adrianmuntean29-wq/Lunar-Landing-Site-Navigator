"""Build data/zones.json: the team's candidate landing zones (teammate Tudor) for the map.

Source: `Export_Candidate_Landing_Zones` shapefile Tudor drew in ArcGIS 10.6.1 (sent 2026-11-14), GCS_Moon_2000
(sphere 1737400 m, degrees). 11 polygons, IDs 6, 8, 13-21. Its README lists what he drew them from: LOLA hillshade,
PGDA 90 roughness, PGDA 90 PSR outlines, LOLA 5 m DEM + slope. These are a TEAM ANALYSIS, not NASA regions.

Per zone we add: area (equal-area projection), centroid, distance to the pole, share inside the app's permanently
shadowed outlines (psr.json), and the median PGDA 90 roughness at a 100 m baseline (1 km cells inside the zone).

Inputs (outside git): data/zones_src/Export_Candidate_Landing_Zones.* and
data/zones_src/LDRM_80S_1000MPP_ADJ_ROUGH_100M.tiff (PGDA 90, copied from origin/main 31bd3f8 `surface roughness/`).
Run from pipeline/:  python build_zones.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import dem

ROOT = Path(__file__).resolve().parents[1]
# 2026-11-15: Tudor's NEW set (16 polygons, no attributes; id = file order). The first set (11 polygons) was
# Export_Candidate_Landing_Zones, see vault log 2026-11-14-2120-engine-zones-json.
SRC = ROOT / "data" / "zones_src" / "Landing_Zones"
ROUGH = ROOT / "data" / "zones_src" / "LDRM_80S_1000MPP_ADJ_ROUGH_100M.tiff"
PSR = ROOT / "data" / "psr.json"
OUT = ROOT / "data" / "zones.json"
ROUND_M = 10
R = 1737400.0
LAEA = "+proj=laea +lat_0=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m"   # equal-area, for km^2 only


def main():
    import shapefile
    import rasterio
    from rasterio.features import geometry_mask
    from pyproj import Transformer
    from shapely.geometry import Polygon, shape
    from shapely.ops import transform, unary_union
    from build_sites import code_version

    to_st = Transformer.from_crs("+proj=longlat +R=1737400 +no_defs", dem.PROJ4, always_xy=True)
    to_ea = Transformer.from_crs("+proj=longlat +R=1737400 +no_defs", LAEA, always_xy=True)
    to_ll = Transformer.from_crs(dem.PROJ4, "+proj=longlat +R=1737400 +no_defs", always_xy=True)

    psr_doc = json.loads(PSR.read_text())
    psr = unary_union([Polygon(p["rings"][0], p["rings"][1:]) .buffer(0) for p in psr_doc["polygons"]])

    rough = rasterio.open(ROUGH)
    rgrid = rough.read(1)

    zones = []
    with shapefile.Reader(str(SRC)) as r:
        for n, sr in enumerate(r.iterShapeRecords(), start=1):
            zid = int(sr.record[0]) or n   # OBJECTID is 0 in the new set
            g_ll = shape(sr.shape.__geo_interface__)
            g_ll = g_ll.segmentize(0.01)                      # ~0.3 km steps, so straight edges follow the sphere
            g_st = transform(to_st.transform, g_ll).buffer(0)
            g_ea = transform(to_ea.transform, g_ll)
            c = g_st.centroid
            lon, lat = to_ll.transform(c.x, c.y)
            psr_pct = 100.0 * g_st.intersection(psr).area / g_st.area
            inside = ~geometry_mask([g_st.__geo_interface__], out_shape=rgrid.shape, transform=rough.transform)
            vals = rgrid[inside]
            vals = vals[np.isfinite(vals)]
            simp = g_st.simplify(20.0, preserve_topology=True)
            polys = simp.geoms if simp.geom_type == "MultiPolygon" else [simp]
            rings = []
            for p in polys:
                for ring in [p.exterior, *p.interiors]:
                    rings.append((np.round(np.asarray(ring.coords) / ROUND_M) * ROUND_M).astype(int).tolist())
            zones.append(dict(
                id=zid, name=f"Zone {zid}", rings=rings,
                area_km2=round(g_ea.area / 1e6, 1),
                lat=round(lat, 4), lon_e=round(lon % 360.0, 4),
                x=int(round(c.x / ROUND_M) * ROUND_M), y=int(round(c.y / ROUND_M) * ROUND_M),
                pole_km=round(R * np.radians(90.0 + lat) / 1000.0, 1),
                psr_pct=round(psr_pct, 1),
                rough100_median_m=round(float(np.median(vals)), 2) if vals.size else None,
                rough100_cells=int(vals.size),
            ))
    zones.sort(key=lambda z: z["id"])
    doc = dict(
        generated_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        versions=dict(zones="Landing_Zones (Tudor, ArcGIS, sent 2026-11-15; 16 polygons, ids = file order)",
                      rough="LDRM_80S_1000MPP_ADJ_ROUGH_100M (PGDA 90)", psr=psr_doc["versions"]["psr"],
                      code=code_version()),
        # Relabelled 2026-11-15 (Eren): exact masks found no zone well lit (best point 50.9% sun vs C1 85.6%;
        # vault log 2026-11-15-0942-engine-zones-sunlight-exact), so the label says what the zones are: flat and smooth.
        label="Flat, smooth terrain (team analysis)",
        note="Drawn by teammate Tudor in ArcGIS from LOLA hillshade, LOLA 5 m slope, PGDA 90 roughness and "
             "permanently shadowed regions. Selected for flat, smooth ground, not for sunlight: our exact check "
             "(2 m mast, 2027-2031) found at most ~51% sun inside any zone of the first set. Most of this ground is dark "
             "most of the time; only a few points are well lit. Not NASA regions.",
        crs=dem.PROJ4, units="m", coord_round_m=ROUND_M,
        rings="first ring = outline, later rings = holes; [x, y] pairs",
        zones=zones,
    )
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    for z in zones:
        print(f"zone {z['id']:>2}: {z['area_km2']:>6} km2  {z['lat']:.3f} {z['lon_e']:.2f}E  pole {z['pole_km']:>5} km  "
              f"psr {z['psr_pct']:>5}%  rough100 {z['rough100_median_m']} m ({z['rough100_cells']} cells)")
    print(f"zones.json: {len(zones)} zones, {OUT.stat().st_size / 1e3:.1f} kB")


if __name__ == "__main__":
    main()
