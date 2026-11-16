"""Do both pages give the same landing verdicts as the Python engine?

The engine's answer key, data/windows_reference.json, holds four cases (site, mast height, limits) with a verdict for every
landing day of 2027, computed in Python from an hourly JPL Horizons table. This script opens the landing calendar
(index.html) and the mission view (mission.html) in headless Chromium, asks each page for its own verdicts on the same
cases through a small test hook (window.__planner.evaluate, window.__mission.check), and counts the days that differ.

Run from the repository root:  python pipeline/validation/pages_vs_engine.py
Needs: pip install playwright && python -m playwright install chromium. No network: outside requests are blocked.
Writes pipeline/validation/pages_vs_engine.json.
"""
from __future__ import annotations

import functools
import http.server
import json
import socket
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).with_suffix(".json")
FAIL_NAME = {"sun": "sun", "earth": "earth", "night": "night", "td": "touchdown"}


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(_Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{port}"


def compare(ref_days, page_days):
    n = len(ref_days)
    diff_verdict = diff_reason = 0
    worst = {"sun_pct": 0.0, "earth_pct": 0.0, "night_h": 0.0, "touchdown_deg": 0.0}
    examples = []
    for r, p in zip(ref_days, page_days):
        if p is None:
            diff_verdict += 1
            continue
        fails = [FAIL_NAME[f] for f in p["fails"]]
        if bool(p["pass"]) != bool(r["pass"]):
            diff_verdict += 1
            if len(examples) < 5:
                examples.append({"date": r["date"], "engine": r["fails"] or "pass", "page": fails or "pass",
                                 "engine_sun": r["sun_pct"], "page_sun": round(p["sun"], 3),
                                 "engine_td": r["touchdown_deg"], "page_td": round(p["td"], 3)})
        elif (fails[:1] or ["pass"]) != (r["fails"][:1] or ["pass"]):
            diff_reason += 1
        for k, v in (("sun_pct", p["sun"]), ("earth_pct", p["earth"]), ("night_h", p["night"]), ("touchdown_deg", p["td"])):
            worst[k] = max(worst[k], abs(v - r[k]))
    return {"days": n, "verdicts_differ": diff_verdict, "first_reason_differs": diff_reason,
            "max_abs_diff": {k: round(v, 3) for k, v in worst.items()}, "examples": examples}


def main():
    from playwright.sync_api import sync_playwright

    ref = json.loads((ROOT / "data" / "windows_reference.json").read_text())
    srv, base = serve()
    results = {"answer_key": "data/windows_reference.json (" + ref["generated_utc"] + ")", "cases": []}
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            pages = {}
            for name, path, ready in (("calendar", "index.html", "!!window.__planner"),
                                      ("mission", "mission.html", "!!(window.__mission && window.__mission.check)")):
                pg = b.new_page()
                pg.route("**/*", lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
                pg.goto(f"{base}/{path}")
                pg.wait_for_function(ready, polling=500, timeout=180000)
                print("loaded", path, flush=True)
                pages[name] = pg
            for case in ref["cases"]:
                L = case["limits"]
                lim = {"len": L["length_d"], "sun": L["min_sun_pct"], "earth": L["min_earth_pct"], "night": L["max_night_h"],
                       "td": L["min_touchdown_deg"], "relay": bool(case["relay"])}
                start, n = case["first_landing"][:10], case["landings"]
                row = {"site": case["site"], "mast_m": case["mast_m"], "preset": case.get("preset"), "limits": L,
                       "engine_passing": case["passing"]}
                cal = pages["calendar"].evaluate("([i, m, l, s, n]) => window.__planner.evaluate(i, m, l, s, n)",
                                                 [case["site"], case["mast_m"], lim, start, n])
                mis = pages["mission"].evaluate("([i, m, l, s, n]) => window.__mission.check(i, m, l, s, n)",
                                                [case["site"], case["mast_m"], lim, start, n])
                row["calendar"] = compare(case["days"], cal)
                row["calendar"]["passing"] = sum(1 for d in cal if d and d["pass"])
                row["mission"] = compare(case["days"], mis)
                row["mission"]["passing"] = sum(1 for d in mis if d and d["pass"])
                results["cases"].append(row)
            b.close()
    finally:
        srv.shutdown()
    tot = {k: sum(c[k]["verdicts_differ"] for c in results["cases"]) for k in ("calendar", "mission")}
    days = sum(c["calendar"]["days"] for c in results["cases"])
    results["summary"] = {"landing_days": days, "calendar_differs": tot["calendar"], "mission_differs": tot["mission"]}
    OUT.write_text(json.dumps(results, indent=1) + "\n")
    print(f"{'site':4} {'mast':>4}  {'engine':>6}  {'calendar':>8} {'differ':>6}  {'mission':>7} {'differ':>6}")
    for c in results["cases"]:
        print(f"{c['site']:4} {c['mast_m']:>4}  {c['engine_passing']:>6}  {c['calendar']['passing']:>8} {c['calendar']['verdicts_differ']:>6}"
              f"  {c['mission']['passing']:>7} {c['mission']['verdicts_differ']:>6}")
    print(f"landing days: {days}; verdicts that differ from the engine: calendar {tot['calendar']}, mission view {tot['mission']}")
    print("worst value gaps:", {k: [c[k]["max_abs_diff"] for c in results["cases"]] for k in ("calendar", "mission")})


if __name__ == "__main__":
    main()
