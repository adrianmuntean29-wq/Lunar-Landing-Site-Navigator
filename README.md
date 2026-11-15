# South Pole Navigator

**Team Peaks of Light** · NASA Space Apps Challenge 2026 · Alba Iulia, Romania · Challenge: *Lunar Landing Site Navigator*

**Live demo:** [DEMO_URL] · **Repository:** [REPO_URL] · **Demo video / slides:** [DEMO_MEDIA_URL]

> The data is public, but using it takes expert tools and hours. We turn it into an answer you can check in seconds:
> which spots and weeks work, and why.

## Who it is for

Teams in the early planning stage of a south-pole landing (concept studies, proposals, future CLPS-style missions) who need
to know which spots and which weeks give their spacecraft enough sunlight and Earth contact, and who must re-check that in
seconds when the launch slips. The same view shows students and the public why the lunar south pole is hard.

It is a comparison and screening tool for many options. It is not a flight-planning tool and does not pick launch dates:
trajectory design gives candidate dates; we show which sites survive them.

## What it does

At the south pole the Sun circles close to the horizon and the Earth bobs up and down near it, so a crater rim a few
kilometres away can decide whether a lander has power and a direct line to Earth. For every site and date the tool
checks the Sun and the Earth against the **real terrain horizon** computed from NASA LOLA elevation data.

- **Landing-window calendar (lead view).** One row per month, one cell per landing day: good day to land or not, with the
  reason and the numbers in plain words (for example "not enough sunlight (66%, you need 70%)").
- **Your limits, as sliders.** Mission length, minimum sunlight %, minimum Earth contact %, longest night allowed,
  Sun above the horizon at touchdown. Presets for a short crewed stay and a robotic lunar-day mission are
  **example values, not NASA requirements**; the Earth-contact default of 25% is the value listed in a 2024 NASA presentation.
- **Time span 1, 2, 3 or 5 years** from any start date (ephemeris table covers 2026-2036).
- **Compare sites:** every site under the same limits, ranked by the number of good landing days.
- **Right now at a site:** time to sunset / sunrise and Earthset / Earthrise, Sun and Earth on the horizon chart,
  and a 3D view of the LOLA terrain lit by the real Sun.
- **Mast height 0 / 2 / 10 m** (solar panels and antenna above the ground).
- **Relay switch:** if a relay satellite is available, the Earth-contact rule is turned off.
- **Distance to permanent shadow** per site, from NASA's permanently shadowed region map ("permanently shadowed (LOLA model)";
  this is not a map of ice).
- **Other missions:** past and planned landers shown as pins, with a keep-out filter based on NASA's
  2011 non-binding recommendations (2.0 km from landers and historic sites, 0.5 km from impact sites).
- **Provenance bar:** which data versions were used and when they were computed.
- **Flat, smooth terrain and team sites (Tudor):** our teammate Tudor screened the pole in ArcGIS (LOLA slope and hillshade,
  PGDA 90 roughness, permanent shadow) and found 16 flat, smooth areas. Terrain screening alone finds flat ground, but most of
  it is dark (zone medians 15-41% sun). Our light engine on top found flat spots with 60-72% sun (2 m mast, 2027-2031): sites TZ3, TZ13, TZ9, plus
  Tudor's proposed site TP1, all in the site list (14 sites). TZ13 and TZ3 are upper bounds at the 2 m mast.
- **Missions (fly it), the mission page by Adrian:** pick a day in the calendar and press **Fly it robotic** or **Fly it with a crew**
  (or the top-left ☰ MISSIONS button) to open the mission view for that site and day; the launch and flight play by themselves: launch dates
  from Spaceport Nova Scotia (Canada), the flight to the Moon (simplified model), touchdown, the sky above the site during
  the stay, and launch weather (Open-Meteo).

## How to use it

1. Open [DEMO_URL] (no login, works in a desktop browser).
2. Pick a site, or press **Compare sites**.
3. Choose the first landing date and the time span.
4. Pick a preset (crew or robotic) or set your own limits with the sliders.
5. Read the calendar: blue = a good day to land. Click a day to see why, and to move the 3D view and timeline there.

To run locally: serve the repository folder over HTTP (the page fetches data files), for example
`python -m http.server 8000`, then open `http://localhost:8000/`.

## Data (NASA first)

| Source | Used for |
|---|---|
| **LOLA south-pole DEM, NASA GSFC PGDA product 90** (`LDEM_80S_80MPP_ADJ` and `LDEM_80S_20MPP_ADJ`, Barker et al. 2023) | Terrain heights, horizon masks, 3D view |
| **LOLA permanently shadowed regions, PGDA product 90** (`LPSR_80S_20MPP_ADJ`) | Permanent-shadow outlines and distance to shadow |
| **JPL Horizons** (DE441 ephemeris, Moon mean-Earth frame `MOON_ME`) | Sun and Earth positions seen from the Moon |
| Gläser et al. 2018; De Rosa et al. 2012 | Site coordinates (C1, S, GR1, MP1) and published values we validate against |
| Dwyer Cianciolo 2024, "Artemis Human Landing System Update" (NASA, NTRS 20240009596) | Reference values shown next to the sliders, labelled "as listed in a NASA presentation (2024)" |

Full list with licences: [CREDITS.md](CREDITS.md).

## Method

**Offline (Python, `pipeline/`).**
- For each named site, a 360-direction **terrain horizon**: rays walk outward over the LOLA surface (sphere R = 1737.4 km,
  Moon curvature included), using 20 m terrain within 10 km of the site and 80 m terrain beyond, 4 rays per degree.
  
- **Automatic horizon reach.** There is no fixed distance limit. Each ray stops once even the tallest terrain on the map
  could no longer rise above the horizon already found in that direction, or at the map edge (flagged). At 5 test sites this
  gave the same horizon as walking every ray to the edge of the map (0.0000 deg difference, MEASURED). 
- Permanent-shadow outlines: the 1,531 regions of 1 km² or larger from PGDA 90, simplified for the page. 

**In the browser (JavaScript).**
- Sun and Earth directions from a JPL Horizons table of sub-solar and sub-Earth points (6-hour steps, 2026-2036),
  interpolated and corrected for the site's position on the Moon. 
- Definitions used everywhere:
  - **sunlight %** = average visible share of the Sun's disc above the terrain horizon;
  - **night / sunset** = the Sun's centre below the terrain horizon;
  - **Earth contact** = any part of the Earth's disc above the terrain horizon. This is line of sight, not a radio link budget;
  - one landing per day at 00:00 UTC; values sampled every hour.
- No atmosphere, so no refraction: the horizon is only terrain.

## Validation

Every number here comes from our own tests (MEASURED) or a published paper. Time spans are given because they change the numbers.

| Check | Result | Span | Label |
|---|---|---|---|
| Browser Sun/Earth positions vs JPL Horizons topocentric values | max error **0.0042 deg** (Earth azimuth); all other values ≤ 0.0003 deg; n = 6 | 3 dates, Dec 2026 - Aug 2028 | MEASURED  |
| Our sub-point sky table vs per-site Horizons | max Sun elevation 0.0007 deg, Earth elevation 0.0006 deg, Earth azimuth 0.006 deg | 2027 | MEASURED  |
| Two independent implementations (Python engine with hourly Horizons vs browser with its own ephemeris path), same terrain masks | **0 of 1,460 landing days disagree** (4 sites x 365 days); sunlight per day within 0.09 points | every landing day of 2027 | MEASURED  |
| Site statistics, browser vs engine | sunlight within 0.10 points, Earth contact within 0.04 points, longest night within 1 h (4 sites x 3 mast heights) | 2027 | MEASURED  |
| **Shackleton rim S**, sunlight at the surface vs Gläser et al. 2018 | **79.1%** vs published 81.0% | ours 2027-2031; Gläser long-term average | MEASURED vs paper  |
| **Connecting Ridge C1**, sunlight at 2 m vs Gläser et al. 2018 | **85.6%** vs published 88.0% | ours 2027-2031; Gläser long-term average | MEASURED vs paper  |
| Engine regression vs a second, independently written horizon code | S 0 m 79.1%, S 2 m 83.4%, C1 2 m 85.6% agree within 0.1 points | 2027-2031 | MEASURED  |

**What we learned while validating.**
- **Terrain resolution changes the answer.** On a 1 km grid the best 5-year sunlight anywhere near the pole was 65.8%;
  with 20 m terrain, narrow ridges such as S and C1 reach about 80% and more. A coarse map undersells the best spots. 
- **Values at ground level are fragile.** A 0.7 deg slope within 100 m of C1 moves its surface sunlight from 84.5% to 55.8%.
  We therefore lead with 2 m mast values and show surface values next to them as a range. 
- **Night length near the limit.** When the Sun grazes the horizon, a 0.0001 deg difference can split one 43 h night into
  30 h + 12 h. Night lengths near a limit are shown as approximate. 

## Limits (read before using a number)

- **Geometry only.** No battery, thermal, radio link budget, slope hazard or landing-accuracy model.
- **Earth contact is not yet checked against a published source**; sunlight is (S and C1 above).
- **Validated sites: S and C1.** De Gerlache rim (GR1) and Malapert (MP1) use the same method but have no published
  reference checked. At MP1, 7 of 360 horizon directions reach the edge of the terrain map, so its horizon may be slightly low
  there. 
- Exact horizons exist for the named sites only.
- Permanent shadow is a model of where the Sun never shines, **not a map of ice**.
- Slider presets are **example values**. Reference values from the 2024 NASA presentation are quoted as listed there,
  not as a NASA standard. Mission positions come from public announcements and NASA's 2011 non-binding guidance,
  not an official registry or law.
- Small known offsets: Horizons uses the DE441 ephemeris and the LOLA map uses the DE421 frame; the effect is far below the
  numbers shown. The Horizons Moon orientation model is valid for A.D. 1550-2650.
- This is not a NASA product and not a flight tool.

## Repository layout

| Path | What |
|---|---|
| `index.html` | The page |
| `pipeline/` | Python: DEM reading, horizon masks, statistics, permanent shadow, calendar reference, tests |
| `pipeline/make_subpoints.py` | Builds the Sun/Earth table from one JPL Horizons call |
| `data/` | Files the page reads: `subpoints.json`, `sites.json`, `psr.json`, `heights.bin`, `terrain_meta.json`, `cap_heights.bin`, `cap_meta.json` |

Rebuild the data: see [pipeline/README.md](pipeline/README.md) for the commands and their order. The DEM files
(80 m: 181 MB; 20 m: 2.7 GB) are downloaded from PGDA and are not stored in git. Tests: `pytest pipeline/tests`.

## Credits

See [CREDITS.md](CREDITS.md) for every dataset, paper, library and font, with licences.

## Use of AI

We used Claude Code (Anthropic) as a coding and research assistant during the event. People chose the problem, made every
product and design decision, and checked the outputs: positions against JPL Horizons, results against published
studies, and the browser against an independently written Python engine.

## Team

Peaks of Light (5 members), NASA Space Apps Challenge 2026, Alba Iulia.
