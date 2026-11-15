"""Test 1: does the web page compute the same landing calendar as the Python engine?

Two independent implementations read the same horizon masks (data/sites.json):
- the page: js/core.js, Sun/Earth from the 6-hour JPL Horizons table (data/subpoints.json) + interpolation;
- the engine: metrics.py, hourly JPL Horizons table (2027-2031).
For every named site and mast height (0 / 2 / 10 m) we take the page's own hourly sunlight / Earth series and its
landing-day verdicts (App.series, App.wins, page default limits), rebuild the same calendar from the engine's series,
and count the landing days where the two disagree.

Run from pipeline/:  python validation/page_vs_engine.py
Needs: pip install playwright && python -m playwright install chromium (plus the engine requirements in ../README.md).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import metrics  # noqa: E402
from _page import ROOT, page  # noqa: E402

JS = """(mast) => { App.set({mast}, 'test'); const L = App.state.lim, H = (App.state.days + L.len) * 24;
  return {days: App.state.days, lim: L, sites: App.sites.filter(s => !s.custom).map(s => {
    const r = App.series(s.i), w = App.wins(s.i);
    return {id: s.raw.id, sun: Array.from(r.sun.slice(0, H)), earth: Array.from(r.earth.slice(0, H)),
            pass: w.map(x => !x.fail.length)}; })}; }"""


def calendar(sun, earth, days, lim):
    """The page's rule (core.js windows()): mean sun %, Earth % share, longest run with the Sun centre down."""
    out = []
    for d in range(days - lim["len"] + 1):
        w = slice(d * 24, (d + lim["len"]) * 24)
        s, e = sun[w].mean() * 100, earth[w].mean() * 100
        run = night = 0
        for v in sun[w]:
            run = run + 1 if v < 0.5 else 0
            night = max(night, run)
        out.append(not (s < lim["sun"] or (not lim["relay"] and e < lim["earth"]) or night > lim["night"]))
    return out


def main():
    sites = {s["id"]: s for s in json.loads((ROOT / "data" / "sites.json").read_text())["sites"]}
    sky = metrics.fetch_sky()
    rows = []
    with page() as (pg, errors):
        for mast in ["0", "2", "10"]:
            d = pg.evaluate(JS, mast)
            for s in d["sites"]:
                e = sites[s["id"]]
                H = len(s["sun"])
                ser = metrics.site_series(np.asarray(e["masks"][mast]), sky, e["lat"], e["lon_e"], e["ground_m"], float(mast))
                py_sun, py_earth = ser["sun_frac"][:H], ser["earth_up"][:H].astype(float)
                js_sun, js_earth = np.asarray(s["sun"]), np.asarray(s["earth"])
                py_pass = calendar(py_sun, py_earth, d["days"], d["lim"])
                rows.append(dict(mast=mast, id=s["id"], page_good=sum(s["pass"]), engine_good=sum(py_pass), days=len(py_pass),
                                 disagree=sum(a != b for a, b in zip(py_pass, s["pass"])),
                                 max_sun_diff=float(np.abs(js_sun - py_sun).max()),
                                 earth_hours_differ=int((js_earth != py_earth).sum()), hours=H))
        lim, n_err = d["lim"], len(errors)
    for r in rows:
        print(f"mast {r['mast']:>2} m  {r['id']}  good days page {r['page_good']:>3} / engine {r['engine_good']:>3} of {r['days']}"
              f"  disagree {r['disagree']}  max hourly sun diff {r['max_sun_diff']:.3f}  Earth hours differ {r['earth_hours_differ']}/{r['hours']}")
    tot, dis = sum(r["days"] for r in rows), sum(r["disagree"] for r in rows)
    print(f"\nlimits {lim}; console errors {n_err}")
    print(f"RESULT: {tot - dis} of {tot} landing days agree ({dis} disagree)")
    (Path(__file__).parent / "page_vs_engine.json").write_text(json.dumps(dict(limits=lim, console_errors=n_err, rows=rows), indent=1))


if __name__ == "__main__":
    main()
