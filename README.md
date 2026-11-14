# South Pole Navigator

**Team Peaks of Light** · NASA Space Apps Challenge 2026 · Alba Iulia, Romania · Challenge: *Lunar Landing Site Navigator*

**Live demo:** https://adrianmuntean29-wq.github.io/Lunar-Landing-Site-Navigator/ · **Repository:** https://github.com/adrianmuntean29-wq/Lunar-Landing-Site-Navigator

> The data is public, but using it takes expert tools and hours. We turn it into an answer you can check in seconds:
> which spots and weeks work, and why. Then you can fly the mission.

## Who it is for

Teams in the early planning stage of a south-pole landing (concept studies, proposals, future CLPS-style missions) who need
to know which spots and which weeks give their spacecraft enough sunlight and Earth contact, and who must re-check that in
seconds when the launch slips. The same pages show students and the public why the lunar south pole is hard, and what a
landing there looks like.

It is a comparison and screening tool. It is not a flight-planning tool.

## What it does

At the south pole the Sun circles close to the horizon and the Earth bobs up and down near it, so a crater rim a few
kilometres away decides whether a lander has power and a direct line to Earth. For every site and date the pages check the
Sun and the Earth against the **real terrain horizon** computed from NASA LOLA elevation data.

**Landing calendar (`index.html`)**
- **One cell per landing day:** good day to land or not, with the reason. Days a **crewed** landing works have their own colour.
- **Your limits, as sliders:** mission length, sunlight %, Earth contact %, longest night, Sun at touchdown. Presets for a
  6-day crewed stay and a 13-day robotic mission are **example values, not NASA requirements**; the Earth 25% default is the
  value listed in a 2024 NASA presentation.
- **Ten sites, ranked** under the same limits: four published sites (C1, S, GR1, MP1), the best-lit point in six NASA site
  boxes found by our engine, and the IM-2 target for comparison.
- **3D map lit by the real Sun**, on LOLA terrain: all ten sites (230 × 230 km) or a close-up of the pole (48 × 48 km),
  with yearly sunlight and Earth-visibility layers. Tap the terrain to add your own site.
- **Mast height 0 / 2 / 10 m**, a **relay** switch (turns off the Earth rule), and the distance to the nearest permanent shadow.
- **Fly it:** one click opens the chosen day in the mission view, crewed or robotic.

**Mission view (`mission.html`)**
- A summary card in plain words: is the day good, when the crew launches, lands and comes home.
- **Launch dates from Spaceport Nova Scotia (Canada):** the two daily times the parking orbit lines up with the Moon, Δv and
  propellant for the real Earth–Moon distance, the site's verdict at landing, and launch weather (Open-Meteo forecast and
  2015–2024 statistics).
- **Replays:** the launch at the pad (sky from the real Sun height there), the flight in 3D, the touchdown at the site under
  the real Sun and Earth over the LOLA horizon, the crew on the surface, and the liftoff of the ascent stage.
- **Seen from orbit:** the site on the real LRO photo mosaic (2 m per pixel), with the directions to the Sun and Earth.
- The same data and rules as the calendar: checked over a year at C1, S, GR1 and MP1, 1,411 of 1,412 landing days get the
  same verdict on both pages.

## How to use it

1. Open the live demo (no login, desktop or phone).
2. Pick a site and a mission (crew or robotic), or set your own limits.
3. Read the calendar. Click a day to see why, then **Fly it with a crew** or **Fly it robotic**.
4. In the mission view, press **Play the whole mission**.

To run locally, serve the folder over HTTP (the pages fetch their data files): `python -m http.server 8000`, then open
`http://localhost:8000/`. Opening `index.html` by double-click does not work, because browsers block file reads from a
local page.

## Data (NASA first)

| Source | Used for |
|---|---|
| **LOLA south-pole DEM, NASA GSFC PGDA product 90** (`LDEM_80S_80MPP_ADJ`, `LDEM_80S_20MPP_ADJ`, Barker et al. 2023) | Terrain heights, horizon masks, 3D map |
| **LOLA permanently shadowed regions, PGDA product 90** (`LPSR_80S_20MPP_ADJ`) | Distance to permanent shadow |
| **PGDA product 78** site regions (High-Resolution LOLA Topography for Lunar South Pole Sites) | The six NASA site boxes our engine searched for their best-lit point |
| **JPL Horizons** (DE441 ephemeris, Moon mean-Earth frame `MOON_ME`) | Sun and Earth positions seen from the Moon |
| **LRO NAC and WAC south-pole mosaics, NASA Moon Trek** | Seen from orbit, descent and ascent cameras |
| Gläser et al. 2018; De Rosa et al. 2012 | Site coordinates (C1, S, GR1, MP1) and published values we validate against |
| Dwyer Cianciolo 2024, "Artemis Human Landing System Update" (NASA, NTRS 20240009596) | The Earth-contact default (25%), quoted as listed there |
| Open-Meteo (forecast and ERA5 archive) | Launch-site weather |

Full list with licences: [CREDITS.md](CREDITS.md).

## Method

**Offline (Python, `pipeline/`).**
- For each named site, a 360-direction **terrain horizon**: rays walk outward over the LOLA surface (sphere R = 1737.4 km,
  Moon curvature included), using 20 m terrain within 10 km of the site and 80 m terrain beyond, 4 rays per degree.
- **Automatic horizon reach:** each ray stops once even the tallest terrain on the map could no longer rise above the horizon
  already found, or at the map edge (flagged).
- Terrain grids for the 3D map (240 m and 640 m), and the permanent-shadow outlines from PGDA 90.

**In the browser (JavaScript).**
- Sun and Earth directions from a JPL Horizons table of sub-solar and sub-Earth points (6-hour steps, 2026–2036),
  interpolated and corrected for the site's position on the Moon, including Earth parallax.
- Definitions used on both pages:
  - **sunlight %** = average visible share of the Sun's disc above the terrain horizon;
  - **night / sunset** = the Sun's centre below the terrain horizon;
  - **Earth contact** = any part of the Earth's disc above the terrain horizon (line of sight, not a radio link budget);
  - one landing per day at 00:00 UTC; values sampled every hour.
- The 3D map computes each point's horizon in 64 directions out to 46 km, with the Moon's curvature.
- Mission view: patched conics for the trajectory, Δv and mass (rocket equation), launch times from the alignment of the
  parking orbit with the Moon's position on arrival. These are simplified models, labelled on the page; they do not change
  the site numbers.

## Validation

| Check | Result | Span | Label |
|---|---|---|---|
| Sub-point sky table vs per-site JPL Horizons | max Sun elevation 0.0007°, Earth elevation 0.0006°, Earth azimuth 0.006° | 2027 | MEASURED |
| **Shackleton rim S**, sunlight at the surface vs Gläser et al. 2018 | **79.1%** vs published 81.0% | ours 2027–2031; Gläser long-term average | MEASURED vs paper |
| **Connecting Ridge C1**, sunlight at 2 m vs Gläser et al. 2018 | **85.6%** vs published 88.0% | ours 2027–2031; Gläser long-term average | MEASURED vs paper |
| Engine vs a second, independently written horizon code | S 0 m 79.1%, S 2 m 83.4%, C1 2 m 85.6%, within 0.1 points | 2027–2031 | MEASURED |
| Landing calendar vs mission view, same site and day | 1,411 of 1,412 landing days give the same verdict; the one difference is a grazing Sun at touchdown (0.02° vs −0.0°) | one year, C1, S, GR1, MP1, Earth limit 50% at the time | MEASURED |
| Seen-from-orbit projection vs the LRO mosaic | Shackleton's permanently dark floor falls where our formula puts it | — | CHECKED |

**What we learned while validating.**
- **Terrain resolution changes the answer.** On a 1 km grid the best 5-year sunlight near the pole was 65.8%; with 20 m
  terrain, narrow ridges such as S and C1 reach about 80% and more.
- **Values at ground level are fragile.** A 0.7° slope within 100 m of C1 moves its surface sunlight from 84.5% to 55.8%,
  so we lead with 2 m mast values.
- **Night length near the limit.** When the Sun grazes the horizon, a tiny difference can split one night in two, so night
  lengths near a limit are approximate.

## Limits (read before using a number)

- **Geometry only.** No battery, thermal, radio link budget, slope hazard or landing-accuracy model.
- **Validated sites: S and C1.** GR1, MP1 and the six site-box points use the same method without a published reference.
  At MP1, Haworth and DM2 some horizon directions reach the edge of the terrain map, so their horizon may be low there
  (the page says so; at DM2 sunlight is an upper bound).
- Permanent shadow is a model of where the Sun never shines, **not a map of ice**.
- Slider presets are **example values**; the 2024 NASA value is quoted as listed there, not as a standard.
- The mission view's trajectory, launch times, weather ranking and replays are simplified or illustrative, and say so on
  the page. Shadows in the LRO photos are from when LRO took them, not from the date shown.
- This is not a NASA product and not a flight tool.

## Repository layout

| Path | What |
|---|---|
| `index.html` | Landing calendar and 3D map |
| `mission.html` | Mission view |
| `data/` | Files the pages read: `subpoints.json`, `sites.json`, `heights.bin`, `region_heights.bin`, and engine outputs (`psr.json`, `cap_heights.bin`, metadata) |
| `pipeline/` | Python engine: DEM reading, horizon masks, statistics, permanent shadow, terrain grids, the Horizons table (`make_subpoints.py`), tests |
| `docs/PLAN.md` | The team's working notes: deadlines, pitch plan, checklist |

Rebuild the data: see [pipeline/README.md](pipeline/README.md). The DEM files (80 m: 181 MB; 20 m: 2.7 GB) come from PGDA
and are not stored in git. Tests: `pytest pipeline/tests`.

## Prior work and use of AI

The Alba Iulia rulebook allows earlier work if it is declared and not presented as new ("You may arrive with an idea,
research or existing code").

- **Before the event (6–13 November):** Adrian chose the challenge and, with Claude (Anthropic), built a first 3D view of the
  pole on generated terrain with simplified Sun and Earth positions. Its renderer is still the base of the 3D map in
  `index.html`; its generated terrain is now only a fallback, labelled on the page.
- **During the event:** the Python engine on real LOLA terrain and the ten sites (Eren), the JPL Horizons table, the landing
  calendar, the real-terrain 3D map, the mission view with its replays and LRO images, validation, and this documentation.
- We used Claude Code (Anthropic) as a coding and research assistant. People chose the problem, made the product and design
  decisions, and checked the outputs: positions against JPL Horizons, results against published studies, and one page
  against the other.

## Team

Peaks of Light (5 members), NASA Space Apps Challenge 2026, Alba Iulia.

## Licence

Code: MIT (see [LICENSE](LICENSE)). Data and images keep their own terms (see [CREDITS.md](CREDITS.md)).
