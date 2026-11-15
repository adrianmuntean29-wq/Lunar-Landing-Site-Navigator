"""Build data/sites.json: exact horizon masks + reference statistics for the named sites.

Run from pipeline/:  python build_sites.py
Needs: the 80 m DEM in DATA_DIR (see dem.py), network for 20 m windows, PGDA error layers and Horizons.
Format agreed with FRONTEND (vault logs 2026-11-14-1215 / 1245 / product plan).
"""
from __future__ import annotations

import json
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import dem
import horizon
import metrics

BOX = "best-lit point in NASA site box"
BOX_SRC = ("engine search (2 m mast, 2027-2031) inside PGDA product 78 site box {box}; filters from NASA 2024 HLS presentation "
           "(slope < 10 deg over 100 m, Earth >= 25%); vault log 2026-11-14 more-sites")
TEAM = "best-lit flat point in team terrain zone (Tudor)"
TEAM_SRC = "Tudor's ArcGIS terrain zones (slope, roughness, PSR) + team engine light search"
SITES = [
    dict(id="A", name="Connecting Ridge (C1)", lat=-89.4505, lon_e=222.84, source="Glaser et al. 2018, site C1",
         kind="published study point",
         reference=[dict(paper="Glaser et al. 2018", mast_m=0, sun_pct=76.0), dict(paper="Glaser et al. 2018", mast_m=2, sun_pct=88.0)]),
    dict(id="B", name="Shackleton rim (S)", lat=-89.7849, lon_e=203.97, source="Glaser et al. 2018, site S",
         kind="published study point", reference=[dict(paper="Glaser et al. 2018", mast_m=0, sun_pct=81.0)]),
    dict(id="C", name="de Gerlache rim (GR1)", lat=-88.6952, lon_e=291.7154, source="De Rosa et al. 2012, region GR1 centre",
         kind="published study region centre", reference=[]),
    dict(id="D", name="Malapert massif (MP1)", lat=-85.9756, lon_e=357.8876, source="De Rosa et al. 2012, region MP1 centre",
         kind="published study region centre", reference=[]),
    # Added 2026-11-14 (Eren: "best point per box"); points found on the home server, REPORT3.md
    dict(id="E", name="Leibnitz beta plateau (Site20v2)", lat=-85.480995, lon_e=29.566051, kind=BOX,
         source=BOX_SRC.format(box="Site20v2 Leibnitz beta plateau"), reference=[]),
    dict(id="F", name="de Gerlache rim 2 (SL2)", lat=-88.394084, lon_e=291.375386, kind=BOX,
         source=BOX_SRC.format(box="SL2 de Gerlache rim"), reference=[]),
    dict(id="G", name="Nobile rim 1 (Site06)", lat=-85.275953, lon_e=36.945850, kind=BOX,
         source=BOX_SRC.format(box="Site06 Nobile rim 1"), reference=[]),
    dict(id="H", name="Haworth (Haworth box)", lat=-86.372490, lon_e=336.685177, kind=BOX,
         source=BOX_SRC.format(box="Haworth"), reference=[]),
    dict(id="I", name="Nobile rim 2 (DM2)", lat=-84.055542, lon_e=59.248651, kind=BOX,
         source=BOX_SRC.format(box="DM2 Nobile rim 2") + "; many rays reach the map edge, so sun % is an upper bound",
         reference=[]),
    dict(id="J", name="IM-2 Athena target", lat=-84.78, lon_e=29.13, kind="historic target (comparison)",
         source="published IM-2 target point, LROC https://lroc.im-ldi.com/images/1401; the lander ended ~250 m away, "
                "on its side in a crater (collectSPACE); inside IM-2's own keep-out", reference=[]),
    # Added 2026-11-15 (Eren lifted the freeze 11:00; tudor-data session): points inside Tudor's new terrain zones, found with
    # exact masks at 2 m (2027-2031) and slope-checked on PGDA 90 SLP_100M; vault log 2026-11-15-1054-tudor-data-new-set-tests
    dict(id="K", name="de Gerlache rim, team zone 3 (TZ3)", lat=-88.6077, lon_e=291.965, kind=TEAM, source=TEAM_SRC, reference=[]),
    dict(id="L", name="Haworth area, team zone 13 (TZ13)", lat=-86.9956, lon_e=335.673, kind=TEAM, source=TEAM_SRC, reference=[]),
    dict(id="M", name="Shackleton area, team zone 9 (TZ9)", lat=-88.8440, lon_e=127.587, kind=TEAM, source=TEAM_SRC, reference=[]),
    dict(id="N", name="Tudor's proposed site (TP1)", lat=-88.0453, lon_e=283.03, kind="team proposed site (Tudor)", source=TEAM_SRC,
         reference=[]),
]
MASTS_M = [0, 2, 10]
NEAR_M = 10000.0
WINDOW_2027 = slice(0, 8760)  # 2027-01-01 00:00 .. 2027-12-31 23:00 UTC hourly


def code_version():
    root = Path(__file__).resolve().parents[1]
    try:
        h = subprocess.run(["git", "-C", str(root), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
        dirty = subprocess.run(["git", "-C", str(root), "status", "--porcelain", "--untracked-files=no", "pipeline"],
                               capture_output=True, text=True).stdout.strip()
        return f"{h}{'+uncommitted' if dirty else ''}"
    except OSError:
        return "unknown"


def quality(layer, lat, lon, ndigits):
    """PGDA 90 per-pixel quality value at the site, or None (these layers failed to read on 2026-11-14:
    tile decode error on the 20 m ERR file, then HTTP 403; the DEM itself kept working)."""
    try:
        return round(dem.read_point(layer, lat, lon), ndigits)
    except Exception as e:  # noqa: BLE001 - quality is optional, never block the build on it
        print(f"  {layer}: not read ({type(e).__name__})")
        return None


def psr_distance(lat, lon):
    """km to the nearest permanently shadowed region >= 1 km^2 (build_psr.py), or None if the shapefile is missing."""
    try:
        import build_psr
        return build_psr.nearest_psr_km(lat, lon)
    except (ImportError, FileNotFoundError, OSError) as e:
        print(f"  psr_km: not computed ({type(e).__name__})")
        return None


def main(out=Path(__file__).resolve().parents[1] / "data" / "sites.json"):
    t_start = time.time()
    far = dem.load_far()
    dem_max = float(np.nanmax(far.z))
    sky = metrics.fetch_sky()
    eph = re.search(r"DE\d{3}", sky["header"])
    versions = dict(
        dem=f"{dem.DEM_80M} (PGDA 90, {dem.DEM_DATE})",
        dem_near=f"{dem.DEM_20M} (PGDA 90, {dem.DEM_DATE}), 0-{NEAR_M/1000:.0f} km",
        ephemeris=f"JPL Horizons {eph.group(0) if eph else '(DE not stated)'}, MOON_ME, {sky['time'][0]} to {sky['time'][-1]} UTC hourly",
        code=code_version(),
    )
    out_sites = []
    for s in SITES:
        near = dem.load_near(s["lat"], s["lon_e"], radius_m=NEAR_M + 2000)
        masks, stats_2027, stats_5y, info0, edge = {}, {}, {}, None, {}
        for mast in MASTS_M:
            m, info = horizon.horizon_mask(s["lat"], s["lon_e"], far, near, near_m=NEAR_M, mast_m=mast, dem_max_m=dem_max)
            info0 = info0 or info
            edge[str(mast)] = info["edge_rays"]
            ser = metrics.site_series(m, sky, s["lat"], s["lon_e"], info["h0_m"], mast)
            masks[str(mast)] = [round(float(v), 2) for v in m]
            stats_2027[str(mast)] = metrics.stats({k: v[WINDOW_2027] for k, v in ser.items()})
            stats_5y[str(mast)] = metrics.stats(ser)
        refs = []
        for r in s["reference"]:
            ours = stats_5y[str(r["mast_m"])]["sun_pct"]
            refs.append(dict(r, ours_5y_sun_pct=ours, diff_points=round(ours - r["sun_pct"], 1)))
        out_sites.append(dict(
            id=s["id"], name=s["name"], lat=s["lat"], lon_e=s["lon_e"], source=s["source"], kind=s["kind"],
            ground_m=round(info0["h0_m"], 1),
            err_m=quality("LDEM_80S_20MPP_ADJ_ERR.TIF", s["lat"], s["lon_e"], 2),
            effres_m=quality("LDEM_80S_20MPP_ADJ_EFFRES.TIF", s["lat"], s["lon_e"], 1),
            psr_km=psr_distance(s["lat"], s["lon_e"]),
            # Fixed 2026-11-15: edge rays depend on the mast (a higher eye sees farther, so more rays reach the map edge).
            # The flag used to come from the 0 m mask only; it now follows the 2 m headline mast, with every mast listed.
            stop_km_max=round(info0["stop_km_max"], 1), edge_rays=edge["2"], truncated=edge["2"] > 0,
            edge_rays_by_mast=edge,
            masks=masks,
            reference_stats=dict(window="2027-01-01/2027-12-31T23:00Z hourly", **{"by_mast": stats_2027}),
            reference_stats_5y=dict(window="2027-01-01/2031-12-31T23:00Z hourly", **{"by_mast": stats_5y}),
            reference=refs or None,
        ))
        print(f"{s['id']} {s['name']}: ground {info0['h0_m']:.1f} m, 2 m mast 5y sun {stats_5y['2']['sun_pct']}%, "
              f"earth {stats_5y['2']['earth_pct']}%, edge rays {info0['edge_rays']}")

    doc = dict(
        generated_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        versions=versions,
        rules=dict(
            azimuth="true, clockwise from north; bin k covers [k, k+1) deg, value = max of 4 sub-rays; look up between centres k+0.5",
            reach="auto: ray stops when even the DEM maximum could not rise above the horizon found, or at the grid edge",
            dem_max_m=round(dem_max, 2),
            sun_pct="mean visible fraction of the Sun's disc (radius 0.2666 deg)",
            night="Sun centre below the mask",
            earth="visible if any part of a 0.95 deg disc is above the mask; geometry only, not a radio link",
            ground="site height from the 20 m DEM; 20 m terrain within near range, 80 m beyond",
        ),
        sites=out_sites,
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=1))
    print(f"wrote {out} ({out.stat().st_size/1024:.0f} KB) in {time.time()-t_start:.0f} s")


def merge_only(ids):
    """Compute only `ids` and add/replace them in the existing sites.json, leaving every other site's entry untouched."""
    out = Path(__file__).resolve().parents[1] / "data" / "sites.json"
    tmp = out.with_name("sites_only.json")
    global SITES
    keep = SITES
    SITES = [s for s in keep if s["id"] in ids]
    main(tmp)
    SITES = keep
    old, new = json.loads(out.read_text()), json.loads(tmp.read_text())
    byid = {s["id"]: s for s in old["sites"]}
    byid.update({s["id"]: s for s in new["sites"]})
    old["sites"] = [byid[s["id"]] for s in SITES if s["id"] in byid]
    old["generated_utc"] = new["generated_utc"]
    old["versions"]["code"] = new["versions"]["code"]
    out.write_text(json.dumps(old, indent=1))
    tmp.unlink()
    print(f"merged {sorted(ids)} into {out}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 2 and sys.argv[1] == "--only":
        merge_only(set(sys.argv[2].split(",")))
    else:
        main()
