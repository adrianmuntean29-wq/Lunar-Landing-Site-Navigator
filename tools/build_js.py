"""Build the two page scripts from their source files, and stamp cache-busting versions into the pages.

The code of each page is split by role under src/<page>/, numbered in the order it runs. Most files are parts of one
app function and share its scope (startApp() for the calendar, __boot() for the mission view): the build puts them
back inside that function, in order, so the result runs exactly like one file. The browser loads the built file:

    src/calendar/*.js -> js/calendar.js   (index.html)
    src/mission/*.js  -> js/mission.js    (mission.html)

It also writes ?v=<hash> on the page's script and stylesheet tags, so a browser never mixes a new page with an old file.

Usage, from the repository root:
    python tools/build_js.py          build and stamp
    python tools/build_js.py --check  fail if a built file or a stamp is out of date (used by the tests)
"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PAGES = {
    "calendar": {
        "html": "index.html",
        "css": "css/calendar.css",
        "before": ["00-ephemeris.js"],
        "open": "function startApp(){\n'use strict';\n",
        "inside": ["01-terrain.js", "02-light.js", "03-sites.js", "04-webgl.js", "05-labels.js", "06-panels.js",
                   "07-charts.js", "08-interaction.js", "09-planner.js", "10-loop.js"],
        "close": "}\n",
        "after": ["11-boot.js"],
    },
    "mission": {
        "html": "mission.html",
        "css": "css/mission.css",
        "before": [],
        "open": "/* the page boots after its two data files are in: embedded copies (offline build) or data/*.json next to the page */\n"
                "function __boot(){\n(function(){\n'use strict';\n",
        "inside": ["01-config.js", "02-helpers.js", "03-orbit.js", "04-sky.js", "05-state.js", "06-timeline.js",
                   "07-draw3d.js", "08-polemap.js", "09-panels.js", "10-surface-view.js", "11-launch-replay.js",
                   "12-lro-imagery.js", "13-surface-draw.js", "14-launch-dates.js", "15-controls.js"],
        "close": "})();\n}\n",
        "after": ["16-loader.js"],
    },
}
HEADER = "/* Built by tools/build_js.py from src/{page}/ - edit those files, then run: python tools/build_js.py */\n"


def bundle(page: str, cfg: dict) -> str:
    def read(names):
        return "".join((ROOT / "src" / page / n).read_text() for n in names)
    return HEADER.format(page=page) + read(cfg["before"]) + cfg["open"] + read(cfg["inside"]) + cfg["close"] + read(cfg["after"])


def short_hash(text: str) -> str:
    return hashlib.sha1(text.encode()).hexdigest()[:8]


def stamp(html: str, path: str, version: str) -> str:
    """Set ?v=version on the one tag that loads path (src= or href=)."""
    pat = re.compile(r'((?:src|href)="' + re.escape(path) + r')(\?v=[0-9a-f]+)?(")')
    if len(pat.findall(html)) != 1:
        raise SystemExit(f"expected exactly one tag loading {path}")
    return pat.sub(lambda m: m.group(1) + "?v=" + version + m.group(3), html)


def main(check: bool) -> int:
    stale = []
    for page, cfg in PAGES.items():
        js_path = ROOT / "js" / f"{page}.js"
        js = bundle(page, cfg)
        if not js_path.exists() or js_path.read_text() != js:
            stale.append(str(js_path.relative_to(ROOT)))
            if not check:
                js_path.write_text(js)
        html_path = ROOT / cfg["html"]
        html = html_path.read_text()
        new = stamp(html, f"js/{page}.js", short_hash(js))
        new = stamp(new, cfg["css"], short_hash((ROOT / cfg["css"]).read_text()))
        for shared in ("js/sky.js", "js/theme.js"):
            new = stamp(new, shared, short_hash((ROOT / shared).read_text()))
        if new != html:
            stale.append(cfg["html"])
            if not check:
                html_path.write_text(new)
    if check and stale:
        print("out of date:", ", ".join(stale), "- run: python tools/build_js.py")
        return 1
    print("up to date" if not stale else "built: " + ", ".join(stale))
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv[1:]))
