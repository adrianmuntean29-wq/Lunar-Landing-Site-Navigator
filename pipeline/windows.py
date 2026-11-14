"""Landing-window calendar, reference implementation (Python), to cross-check the page's JavaScript.

Definition (mirrors FRONTEND's planner, vault log 2026-11-14-1505):
- One landing per day at 00:00 UTC. A mission covers [touchdown, touchdown + length) in 1 h steps.
- Limits, checked in this order (the first failing one is the cell's glyph):
  1. sun:       mean visible Sun-disc fraction over the mission >= min_sun_pct
  2. earth:     share of hours with any part of Earth's disc above the horizon >= min_earth_pct (skipped if relay=True)
  3. night:     longest run of hours with the Sun centre below the horizon, inside the mission window, <= max_night_h
  4. touchdown: Sun centre elevation above the terrain horizon at touchdown >= min_touchdown_deg
- Horizon = the site's 360-bin mask for the chosen mast height (sites.json).

Run from pipeline/:  python windows.py   (writes data/windows_reference.json)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import metrics

PRESETS = {  # FRONTEND's example values (UNVERIFIED as requirements; labelled "example values" on the page)
    "robotic": dict(length_d=13, min_sun_pct=70, min_earth_pct=50, max_night_h=48, min_touchdown_deg=0),
    "crew": dict(length_d=6, min_sun_pct=95, min_earth_pct=50, max_night_h=0, min_touchdown_deg=0),
}
ORDER = ("sun", "earth", "night", "touchdown")


def calendar(series, first_hour, days, length_d, min_sun_pct, min_earth_pct, max_night_h, min_touchdown_deg,
             relay=False, sun_margin=None):
    """Evaluate one landing per day. `series` = metrics.site_series(...) hourly arrays starting at hour 0 of the table.
    `sun_margin` = Sun elevation minus horizon (deg) per hour (computed if None). Returns a list of day dicts."""
    L = int(round(length_d * 24))
    frac, sun_up, earth_up = series["sun_frac"], series["sun_up"], series["earth_up"]
    if sun_margin is None:
        raise ValueError("pass sun_margin = sun_el - mask_at(mask, sun_az)")
    out = []
    for d in range(days):
        t = first_hour + 24 * d
        if t + L > frac.size:
            break
        w = slice(t, t + L)
        v = dict(
            sun_pct=float(frac[w].mean() * 100),
            earth_pct=float(earth_up[w].mean() * 100),
            night_h=metrics.longest_run(~sun_up[w]),
            touchdown_deg=float(sun_margin[t]),
        )
        fails = []
        if v["sun_pct"] < min_sun_pct:
            fails.append("sun")
        if not relay and v["earth_pct"] < min_earth_pct:
            fails.append("earth")
        if v["night_h"] > max_night_h:
            fails.append("night")
        if v["touchdown_deg"] < min_touchdown_deg:
            fails.append("touchdown")
        out.append(dict(hour=t, pass_=not fails, fails=fails, **{k: round(x, 3) for k, x in v.items()}))
    return out


def main():
    root = Path(__file__).resolve().parents[1]
    sites = json.loads((root / "data" / "sites.json").read_text())
    sky = metrics.fetch_sky()
    cases = []
    for site_id, mast, preset, relay in [("A", "2", "robotic", False), ("B", "2", "crew", False),
                                         ("C", "0", "robotic", True), ("D", "10", "robotic", False)]:
        s = next(x for x in sites["sites"] if x["id"] == site_id)
        mask = np.asarray(s["masks"][mast])
        ser = metrics.site_series(mask, sky, s["lat"], s["lon_e"], s["ground_m"], float(mast))
        margin = ser["sun_el"] - metrics.mask_at(mask, ser["sun_az"])
        p = PRESETS[preset]
        days = calendar(ser, 0, 365, relay=relay, sun_margin=margin, **p)
        n_pass = sum(d["pass_"] for d in days)
        cases.append(dict(site=site_id, mast_m=int(mast), preset=preset, limits=p, relay=relay,
                          first_landing="2027-01-01T00:00Z", landings=len(days), passing=n_pass,
                          days=[dict(date=str(np.datetime64("2027-01-01") + i), **{k: v for k, v in d.items() if k != "hour"})
                                for i, d in enumerate(days)]))
        print(f"{site_id} mast {mast} {preset}{' relay' if relay else ''}: {n_pass}/{len(days)} landing days pass")
    doc = dict(
        generated_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        purpose="answer key for the page's landing-window calendar (2027, one landing per day at 00:00 UTC)",
        definition=__doc__.split("Run from")[0].strip(),
        sky=f"hourly, {sky['time'][0]} to {sky['time'][-1]} UTC (JPL Horizons)",
        sites_json_generated=sites["generated_utc"],
        cases=cases,
    )
    out = root / "data" / "windows_reference.json"
    out.write_text(json.dumps(doc, indent=0).replace('"pass_"', '"pass"'))
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
