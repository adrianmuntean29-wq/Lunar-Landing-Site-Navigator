# Validation scripts

| Script | Checks | Result file |
|---|---|---|
| `pages_vs_engine.py` | This repository's landing calendar (`index.html`) and mission view (`mission.html`) against the engine's answer key `data/windows_reference.json`: every landing day of 2027 in four cases | `pages_vs_engine.json` |
| `page_vs_engine.py`, `page_vs_horizons.py`, `_page.py` | The team's other app, Aripi (`js/core.js`, branch `peaks-of-light-final`), against the engine and JPL Horizons. They need that app's `window.App` and do not run against the pages on this branch | `page_vs_engine.json`, `page_vs_horizons.json` |

Run from the repository root: `python pipeline/validation/pages_vs_engine.py` (needs `pip install playwright` and
`python -m playwright install chromium`).
