"""Test 2: are the Sun and Earth where NASA JPL Horizons says they are, as seen from the landing site?

The page computes Sun/Earth azimuth and elevation itself (js/core.js, App.stateAt) from a 6-hour Horizons table.
Here we ask the live JPL Horizons API for an observer standing ON the Moon at each site (CENTER=coord@301, the
site's height from data/sites.json) and compare, airless apparent azimuth/elevation, at several dates.

Run from pipeline/:  python validation/page_vs_horizons.py   (needs internet for the Horizons API)
"""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _page import page  # noqa: E402

JDS = [2461406.5, 2461500.25, 2461650.75, 2461800.5, 2462000.0]   # 2027-01-01 00:00 ... 2028-05-25 12:00 UTC
SITES = ["A", "D", "F", "J"]                                        # C1, MP1, SL2, IM-2


def horizons(body, lat, lon_e, alt_km):
    q = dict(format="text", COMMAND=f"'{body}'", OBJ_DATA="NO", MAKE_EPHEM="YES", EPHEM_TYPE="OBSERVER", CENTER="'coord@301'",
             COORD_TYPE="GEODETIC", SITE_COORD=f"'{lon_e},{lat},{alt_km}'", TLIST=" ".join(f"'{j}'" for j in JDS),
             TLIST_TYPE="JD", QUANTITIES="'4'", ANG_FORMAT="DEG", CSV_FORMAT="YES", APPARENT="AIRLESS", EXTRA_PREC="YES")
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(q)
    text = urllib.request.urlopen(url, timeout=60).read().decode()
    rows = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    return [tuple(float(v) for v in r.split(",")[3:5]) for r in rows]   # (azimuth, elevation) in degrees


def main():
    with page() as (pg, errors):
        got = pg.evaluate("""(a) => { const out = {}; for (const s of App.sites) { if (s.custom || !a.ids.includes(s.raw.id)) continue;
            out[s.raw.id] = {name: s.name, lat: s.lat, lon: s.lon, ground: s.raw.ground_m,
              v: a.jds.map(j => { const x = App.stateAt(s, j); return [x.su.az, x.su.el, x.ea.az, x.ea.el]; })}; } return out; }""",
                          dict(ids=SITES, jds=JDS))
    wrap = lambda a: (a + 180) % 360 - 180
    rows = []
    for sid, s in got.items():
        sun, earth = horizons("10", s["lat"], s["lon"], s["ground"] / 1000), horizons("399", s["lat"], s["lon"], s["ground"] / 1000)
        for k, jd in enumerate(JDS):
            p = s["v"][k]
            rows.append(dict(site=sid, name=s["name"], jd=jd, d_sun_az=wrap(p[0] - sun[k][0]), d_sun_el=p[1] - sun[k][1],
                             d_earth_az=wrap(p[2] - earth[k][0]), d_earth_el=p[3] - earth[k][1]))
            r = rows[-1]
            print(f"{sid} JD {jd}: Sun el page {p[1]:+.4f} / Horizons {sun[k][1]:+.4f}   Earth el page {p[3]:+.4f} / Horizons {earth[k][1]:+.4f}"
                  f"   diff (deg) sun az {r['d_sun_az']:+.4f} el {r['d_sun_el']:+.4f}  earth az {r['d_earth_az']:+.4f} el {r['d_earth_el']:+.4f}")
    mx = {k: round(max(abs(r[k]) for r in rows), 4) for k in ["d_sun_az", "d_sun_el", "d_earth_az", "d_earth_el"]}
    print(f"\nRESULT max |page - Horizons| in degrees: {mx}  (the Sun's disc is 0.53 deg wide)")
    (Path(__file__).parent / "page_vs_horizons.json").write_text(json.dumps(dict(max_abs_deg=mx, rows=rows), indent=1))


if __name__ == "__main__":
    main()
