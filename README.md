# Peaks of Light — South Pole Navigator

**NASA Space Apps Challenge 2026 · Alba Iulia, Romania · 14–15 November**
Challenge: **Lunar Landing Site Navigator**
Team: **Peaks of Light** (Adrian, Eren)

An interactive 3D map of the lunar south pole. For any landing site and any date, it shows when the site has sunlight (power) and when it can see Earth (direct-to-Earth communications), computed from the terrain.

> **Built on real NASA data:** terrain horizons from LRO LOLA elevation models (our Python engine in `pipeline/`), Sun and Earth positions from JPL Horizons, and LRO photo mosaics in the mission view. What existed before the event and what we built during the weekend is listed in [section 10](#10-transparency-prior-work-and-tools).

---

## Contents

1. [Deadlines and rules that can disqualify us](#1-deadlines-and-rules-that-can-disqualify-us)
2. [The challenge and why we chose it](#2-the-challenge-and-why-we-chose-it)
3. [The idea: what we are building](#3-the-idea-what-we-are-building)
4. [The app](#4-the-app)
5. [How the computation works](#5-how-the-computation-works)
6. [NASA data we use](#6-nasa-data-we-use)
7. [Weekend plan](#7-weekend-plan)
8. [Pitch (3–5 minutes)](#8-pitch-35-minutes)
9. [Submission checklist](#9-submission-checklist)
10. [Transparency: prior work and tools](#10-transparency-prior-work-and-tools)
11. [Appendix: rules, prizes, logistics](#11-appendix-rules-prizes-logistics)
12. [Sources](#12-sources)

---

## 1. Deadlines and rules that can disqualify us

| When | What | If we miss it |
|---|---|---|
| **Sunday 15:00** | Local pitch form + any files or links we will use in the presentation (the form link comes by email and WhatsApp) | No cash prizes |
| **Sunday 15:30** | Pitch to the jury | — |
| **Sunday 18:50** | **Project submitted on the NASA Space Apps platform** | No local prizes and no global nomination |

- **We are a team of 2, so both of us must be on site for the whole judging session.** The rule requires two thirds of the team present; for 2 members the minimum is 2.
- Each member must be in the correct Alba Iulia event team on the NASA platform and **must not be waitlisted**.
- The project must **meaningfully use at least one NASA data resource** and answer the chosen challenge.
- **We must not fabricate data or results.** Every number we show comes from LOLA terrain and JPL Horizons. The generated fallback terrain is labelled on the page and never presented as a result.
- Prior work is allowed, but we must show **concrete progress made during the weekend** and be transparent about sources and tools, including AI.

**The jury** scores each of 5 criteria from 1 to 10, 20% each:

| Criterion | What it measures | How we address it |
|---|---|---|
| Impact | Real benefit, meaningful problem | Choosing Artemis landing sites: power + communications |
| Creativity | Originality | A "live" 3D map, day-by-day comparison, adjustable mast |
| Validity | Scientific grounding, feasibility | Comparison with NASA's official LRO illumination maps (section 6) |
| Relevance | Answers the challenge, uses NASA data | Exactly what the challenge asks: Sun and Earth relative to the horizon |
| Presentation | Clarity, demo | Live demo + backup video |

Ties are broken by Impact, then Validity, then Creativity.

---

## 2. The challenge and why we chose it

**Lunar Landing Site Navigator** (intermediate–advanced): a tool that compares landing sites and dates at the **Moon's south pole** by showing where the **Sun** and **Earth** are relative to the horizon. From that come the **power** windows (Sun above the terrain) and the **direct-to-Earth communication** windows (Earth above the terrain).

Why this challenge:

- On 6 November, only **one other team** in Alba Iulia had chosen it (Red rocket). Health Monitoring had ~5 teams and Field Shift had 4.
- It is the most engineering-heavy challenge: geometry, time windows, trade-offs. It fits our background in systems validation.
- 3D is not decoration here: the shadows inside the craters are the answer to the question.

<details>
<summary>All 14 challenges and how many Alba Iulia teams had picked them (6 November)</summary>

| Challenge | Level | Teams in Alba Iulia |
|---|---|---|
| Dancing with the SARs | Intermediate–Advanced | 0 |
| The Earth Information Jukebox | Beginner–Intermediate | 0 |
| Planet X and SPHEREx | Advanced | 0 |
| Space Mission Design Game | Beginner–Intermediate | 0 |
| Interplanetary Survival Guide: Martian Map | Intermediate | 0 |
| **Lunar Landing Site Navigator** | Intermediate–Advanced | 1 (+ us) |
| Junior Astronaut Mission Trainer | Beginner–Intermediate | 1 |
| Harmonization of MODIS and VIIRS Hot Spots | Intermediate–Advanced | 1 |
| Abandoned but not Forgotten | Beginner–Intermediate | 2 |
| Be An Earth System Trend Detective! | Advanced | 2 |
| Identify Earth Analogs (Moon/Mars) | All | 2 |
| Flame in Freefall | Intermediate–Advanced | 2 |
| Field Shift: Adapting Farms with NASA Data | Intermediate–Advanced | 4 |
| Create Health Monitoring Software for Astronauts | Intermediate | ~5 |

Counts come from the platform's team list on that date and may have changed since.
</details>

---

## 3. The idea: what we are building

At the south pole, the Sun circles the horizon once every ~29.5 days and never climbs higher than ~1.5° (plus a few tenths of a degree depending on the site's position). Earth wobbles near the horizon by ±6.7° vertically. As a result:

- ridges and peaks can be sunlit almost all the time ("peaks of light", hence the team name);
- crater floors can be in permanent shadow (permanently shadowed regions, where ice may be found);
- a good site for power is not necessarily good for communications, and vice versa.

For any site picked on the map, the **navigator** answers three questions:

1. What fraction of the time are the Sun and Earth above the horizon?
2. What is the longest period without sunlight (how long must the batteries last)?
3. On which days and hours are the power and communication windows open?

**The sites we compare** (published candidates, real coordinates): C1 on the connecting ridge and S on the Shackleton rim (Gläser et al. 2018), GR1 on the de Gerlache rim and MP1 on Malapert massif (De Rosa et al. 2012). Users can add their own.

---

## 4. The app

Files: [`index.html`](index.html) (3D map and landing calendar) and [`mission.html`](mission.html) (mission view). No dependencies. The pages read their data from `data/`, so serve the folder over HTTP.

**Running it**
- Locally: run `python -m http.server 8000` in the repo folder, then open `http://localhost:8000/`.
- Online: in the repo, **Settings → Pages → Deploy from a branch → `main` / root**. After about a minute the demo is live at `https://<user>.github.io/<repo>/`. That link goes into the pitch form and the NASA submission.

**What it does**
- A 3D map of a 48 × 48 km area around the pole, shown as a terrain block you rotate with the mouse or a finger.
- Time simulation (▶ button, 365-day slider, adjustable speed): the shadows move with the Sun.
- Three layers: **Light now**, **Sun per year** (average sunlit fraction), **Earth per year** (average Earth visibility).
- The four published sites with statistics; **tap the terrain to add your own site**, with statistics computed on the spot.
- **Horizon chart** for the selected site: the 360° terrain profile, the band the Sun travels through over a year, the area where Earth wobbles, and the current positions.
- **Year strip**: for each site, day by day, how much of the day has sunlight and how much has Earth in view. Clicking it jumps to that day.
- Adjustable vertical exaggeration (visual only, does not change the computation).
- Works on phones (touch, pinch-zoom) and in light or dark theme.

**Tech:** hand-written WebGL (no Three.js), plain JavaScript, Canvas 2D for the charts. The initial computation takes 1–2 seconds on a laptop.

### Landing calendar + mission view (branch `mission-simulator`, Saturday 14 Nov afternoon)

On this branch the two pages work as one product. Serve the folder over HTTP (for example `python -m http.server 8000`, then open `http://localhost:8000/`); GitHub Pages works too.

- **`index.html`, landing calendar:** Eren's page as of his `frontend-snapshot` branch (15:07): planner, landing-window calendar, filter funnel and site ranking on the LOLA horizons. Added here: page navigation at the top; a bar under the calendar with the chosen landing day and a **Fly this mission from Canada** button; the 3D view now uses the engine's real LOLA heights (`data/heights.bin`, 240 m) instead of the generated terrain, with pins for the four sites (C1 and S on the map, GR1 and MP1 pinned at the edge with their distance). If the heights file does not load, the view falls back to the generated terrain without pins and says so.
- **`mission.html`, mission view:** opens with the site, landing day, mission type and limits from the calendar. Works back the launch time from Spaceport Nova Scotia, plays the flight in 3D, then replays the touchdown from the site: powered descent from about 1.5 km, engine plume and dust, under the real Sun and Earth over the LOLA horizon. **Watch the landing** replays it. For a crewed mission the page also replays the liftoff when the stay ends (**Watch the liftoff**): the ascent stage lifts off on its own engine, insulation flakes fly, the descent stage stays on the surface, and an ascent camera looks down on the real LRO image.
- **Real images from orbit:** a **Seen from orbit** view shows the chosen site on the LRO NAC south-pole photo mosaic (about 1 m/px) over the LRO WAC mosaic (100 m/px), loaded live from NASA Moon Trek, with the directions to the Sun and Earth at the time shown, nearby sites, the pole and a scale bar (drag to move, scroll to zoom). During the landing replay a **descent camera** inset looks straight down on the same real image. The tiles need an internet connection; offline the views say so. Shadows in the photos are from when LRO took them, not from the date shown. Projection checked against the mosaic itself: Shackleton's permanently dark floor falls where our formula puts it.
- **Same data and rules as the calendar:** Sun and Earth from `data/subpoints.json` (JPL Horizons, DE441), terrain horizons from `data/sites.json` (LOLA masks from the engine, mast 0/2/10 m), relay switch, and the calendar's example limits (sunlight %, Earth contact %, longest night, Sun at touchdown). Checked day by day over a year at C1, S, MP1 and GR1: 1,411 of 1,412 landing days get the same verdict on both pages; the one difference is a grazing Sun at touchdown (0.02° vs −0.0°).
- **Simplified, and labelled so on the page:** trajectory, launch times, Δv and the 3D scene (patched conics, Meeus ephemeris), the best-launch-date list (Open-Meteo weather) and the landing replay (smooth descent curve, shown about 8× faster). None of these change the site numbers.
- Removed from the simulator: the crater-centre points for the Artemis regions and the "(ice)" sites. The four published sites, plus past landings for reference, remain.

---

## 5. How the computation works

### Terrain
- Computation grid: 257 × 257 points at 375 m spacing, i.e. 96 × 96 km. Only the central 48 × 48 km is displayed; the rest exists so that surrounding terrain can shadow the edges.
- Heights: real LOLA terrain from our engine (`data/heights.bin`, 240 m). If that file cannot load, the page falls back to a generated terrain (a crater near the pole, a massif toward Earth, small craters and fractal noise) and says so on the page.

### Each point's horizon
For each point and each direction (64 directions for the map, 360 for candidate sites) we march across the terrain out to 46 km and keep the maximum elevation angle:

```
angle = atan( (h(d) − d² / (2·R_Moon) − h₀) / d )
```

The `d² / (2·R)` term is the **Moon's curvature**: at 20 km, the terrain "drops" by ~115 m. The step grows with distance (6% of the distance for the map, 2.5% for sites). The march stops early once even the highest peak can no longer exceed the angle already found.

Candidate sites have their panels and antenna on a **10 m mast**.

### Sun and Earth

From one JPL Horizons table (DE441, every 6 hours, `data/subpoints.json`) of the sub-solar and sub-Earth points in the Moon's mean-Earth frame, interpolated in time. The elevation of the Sun or Earth for a site at latitude φ and longitude λ:

```
sin(elevation) = sin(φ)·sin(β) + cos(φ)·cos(β)·cos(λ_body − λ)
```

where (β, λ_body) is the sub-solar or sub-Earth point on the Moon. The Earth direction includes parallax. Solar disk radius 0.2666°, Earth disk radius 0.95°.

### Per-site statistics
We sample the year every 3 hours (2,920 instants):
- **Sun**: mean sunlit fraction of the solar disk.
- **Earth**: share of instants with more than half of Earth's disk above the terrain.
- **Both**: instants with Sun and Earth at the same time.
- **Longest night**: the longest run of instants without sunlight.

### Known limitations
- Terrain beyond 46 km is not considered.
- The 375 m resolution smooths small ridges; on real 20 m or 5 m data the results will change.

---

## 6. NASA data we use

### Terrain: LOLA (Lunar Orbiter Laser Altimeter, LRO)

| File | Coverage | Resolution | Size | Use |
|---|---|---|---|---|
| `LDEM_875S_20M` | 87.5°S → pole (~76 km radius) | 20 m | JP2 20 MB / IMG 110 MB | **Main option** for the map |
| `LDEM_85S_40M` | 85°S → pole (~150 km radius) | 40 m | JP2 21 MB / IMG 110 MB | Surrounding terrain, for the horizon |
| `ldem_87s_5mpp.tif` (PGDA) | 87°S → pole | 5 m | 3.3 GB | Too large for this weekend |
| Per-site DEMs (PGDA, e.g. `Site04` = Shackleton rim, `Site23` = Malapert massif) | ~20 × 20 km | 5 m | — | Zoom on a single site, if time allows |

Download: `https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_875S_20M.IMG` (with the `.LBL` next to it). The `.IMG` format is binary with 16-bit integer values. **Read `SCALING_FACTOR`, `OFFSET` and the projection from the `.LBL` file** before converting (polar stereographic projection, coordinates in meters).

### Validation: NASA's official illumination maps (PGDA / LRO)

| File | Contents | Resolution |
|---|---|---|
| `AVGVISIB_85S_060M_201608` | Average solar illumination | 60 m |
| `AVGVISIB_85S_060M_201608_EARTH` | Average Earth visibility | 60 m |
| `LPSR_85S_060M_201608` | Permanently shadowed regions | 60 m |

GeoTIFF download: `https://pgda.gsfc.nasa.gov/data/MoonIllumination/<NAME>.TIF`

**For Validity:** we compute the yearly average with our algorithm and compare it with `AVGVISIB_85S...` over the same area. A "ours vs. NASA" chart in the pitch is the strongest scientific argument we can bring. Large differences show our limits (resolution, ephemerides, time span).

### Real Sun and Earth positions

**Quick option: JPL Horizons.** Query the target **Moon (301)** from observer **Earth's center (500@399)**, 1-hour step, over one year, with quantities:
- **14** — sub-observer point (sub-lon, sub-lat): where Earth is seen from;
- **15** — sub-solar point (sub-lon, sub-lat): where the Sun is seen from.

Export the table as CSV and load it into the page. Check the longitude convention (east/west) against the LOLA projection.

**Precise option: NASA NAIF SPICE** (Python: `spiceypy`), with the NAIF generic kernels for time, planetary ephemerides and lunar orientation (the `MOON_ME` frame, same as LOLA, DE421).

### Data pipeline (to write on Saturday)

```
LDEM_875S_20M.IMG ──► Python (numpy): read using the .LBL, crop around the pole,
                      resample to the computation grid ──► heights.bin (Float32)
Horizons CSV ──► Python: interpolate to 1–3 hour steps ──► ephem.json
index.html ──► load heights.bin and ephem.json instead of the generated terrain
AVGVISIB_85S_060M ──► Python: compare with our average ──► chart for the pitch
```

Note: GitHub Pages serves files up to 100 MB. A 257 × 257 Float32 `heights.bin` is ~260 KB; a finer 1025 × 1025 grid is ~4 MB.

---

## 7. Weekend plan

The roles are **proposed**; we settle them on site.

| Who | Role |
|---|---|
| Adrian | Real data (LOLA, ephemerides), the algorithm, validation against NASA |
| Eren | UI and 3D, pitch deck, demo video |

### Saturday, 14 November

| Time | What | Done when |
|---|---|---|
| 11:00–13:00 | Download `LDEM_875S_20M`, `LDEM_85S_40M`, `AVGVISIB_85S_060M` (+ `_EARTH`, `LPSR`). Python script that reads `.IMG` using the `.LBL` | We have the real terrain as a numpy array |
| 11:00–13:00 | In parallel: Horizons query (quantities 14 and 15, one year, 1 h step) | We have `ephem.csv` |
| 14:00–17:00 | `heights.bin` + `ephem.json`; the page loads them instead of the generated terrain | The map shows Shackleton and the real terrain |
| 17:00 | Mentor check-in: show progress | Feedback noted |
| 20:00–22:00 | Validation: our average vs. `AVGVISIB_85S_060M`, on the same grid | A chart and a match percentage |
| evening | Real sites: Shackleton rim, connecting ridge, Malapert, plus one permanently shadowed region | Table of the 4 sites on real data |

### Sunday, 15 November

| Time | What |
|---|---|
| 09:10–12:00 | Pitch deck, backup demo video (60–90 s), final README, GitHub Pages live |
| 13:00 | Test everything: the GitHub Pages link on another laptop and on a phone, the video, the slides |
| **before 15:00** | **Pitch form** with the links (demo, repo, slides, video) |
| 15:30 | Pitch |
| **as soon as possible after the pitch, before 18:50** | **NASA platform submission** (ideally prepared before 15:00 so we only press Submit) |

If time allows:
- A mast-height switch (0 / 10 / 50 m) and its effect on the statistics.
- CSV export of the power and communication windows for the selected site.
- Voice narration of the windows (ElevenLabs has a separate award for projects that use it).

---

## 8. Pitch (3–5 minutes)

The exact time is announced before judging: 3–5 minutes of pitch plus 1–3 minutes of questions, depending on the number of teams. We prepare a 3-minute and a 5-minute version.

1. **Hook (20 s).** *"At the Moon's south pole, the Sun never climbs more than about one and a half degrees above the horizon. A crater rim can be in sunlight almost all the time, while the floor of the same crater hasn't seen the Sun in billions of years."*
2. **Problem (30 s).** Artemis landers need power from the Sun and a direct line to Earth. Both depend on terrain, location and date, and the best spot for one is often bad for the other.
3. **Solution (30 s).** *Peaks of Light*: an interactive 3D navigator that computes, from real LOLA terrain, when any site sees the Sun and the Earth.
4. **Live demo (90 s).** Play time; compare the Shackleton rim with Malapert; tap a new site; show the horizon chart.
5. **NASA data & validation (30 s).** LOLA elevation models, JPL ephemerides; our yearly illumination against NASA's official LRO illumination maps.
6. **What we built this weekend (20 s).** Say what existed before (a first 3D view on generated terrain, see section 10) and what is new: the LOLA horizon engine, the JPL Horizons ephemeris, the landing calendar and the mission view.
7. **Impact & next steps (20 s).** Mission planning, rover traverse planning, power and battery sizing, public outreach.

**Likely jury questions**
- *How accurate is it?* → The validation chart: the difference from NASA's maps and where it comes from.
- *Why not use NASA's illumination maps directly?* → They give averages; we give day-and-hour windows for any site and any mast height, plus side-by-side site comparison.
- *Lunar curvature?* → Included: ~115 m at 20 km.
- *What's missing?* → Resolution (we use 20 m, 5 m exists), terrain beyond 46 km, partial blocking of Earth's disk.

---

## 9. Submission checklist

**Local form (by Sunday 15:00)**
- [ ] Presentation format (slides + live demo)
- [ ] GitHub Pages link (demo)
- [ ] Repo link
- [ ] Slides (PDF) and backup video

**NASA Space Apps platform (by Sunday 18:50)**
- [ ] Both of us in the Peaks of Light team, at the Alba Iulia event, not waitlisted
- [ ] Challenge: Lunar Landing Site Navigator
- [ ] Title and description (text below)
- [ ] NASA data used, with links (section 6)
- [ ] Other sources and tools, including AI assistance (section 10)
- [ ] Demo link + repo (+ video or slides, if the platform asks for them)

**Project description (draft, to update with the real results):**

> *Peaks of Light is an interactive 3D navigator for the lunar south pole. Using LRO LOLA elevation models and JPL ephemerides, it computes the terrain horizon of every point and shows, for any candidate landing site and date, when the Sun is above the horizon (power) and when the Earth is visible (direct-to-Earth communications). Users can compare sites side by side, add their own site, and see yearly statistics such as the longest period without sunlight. We validated our yearly illumination results against NASA's official LRO average illumination maps.*

---

## 10. Transparency: prior work and tools

The Alba Iulia rulebook allows earlier work: *"You may arrive with an idea, research or existing code"*, as long as the team shows meaningful progress during the hackathon, does not present earlier work as new, and is transparent about tools, including AI. We state it openly, in the pitch and in the submission:

- **Before the event (6–13 November):** Adrian chose the challenge and, with the help of Claude (Anthropic's AI assistant), built a first 3D view of the pole on **procedurally generated terrain** with **simplified** Sun and Earth positions. It was first committed on Saturday 14 November at 10:48, so the git history starts there.
- **During the weekend:** the Python engine on real LOLA terrain (horizon masks, heights, permanently shadowed regions), the JPL Horizons ephemeris table, the four published sites, the landing calendar, the mission view with real LRO images, the English UI, the pitch and the submission. The generated terrain is now only a fallback, labelled on the page, and its numbers are never presented as results.

| What | Tool / source |
|---|---|
| Pre-event 3D view on generated terrain (6–13 Nov), documentation | Claude (AI assistant) |
| English translation of the UI | Eren |
| Mission simulator `mission.html` (trajectory, Δv and mass, Sun/Earth at real dates checked against JPL Horizons, best launch dates with Open-Meteo weather), 14 Nov | Claude (AI assistant); Adrian set the requirements and reviewed |
| Real LRO imagery in the mission view (Seen from orbit, descent camera; Moon Trek tiles), 14 Nov | Claude (AI assistant); Adrian set the requirements |
| Calendar + mission view combined (mission page on the team's Horizons and LOLA data, hand-off bar on the calendar, landing replay), 14 Nov | Claude (AI assistant); Adrian set the requirements and reviewed; calendar page by Eren |
| _to fill in during the weekend_ | |

---

## 11. Appendix: rules, prizes, logistics

**Schedule**
- Saturday: check-in 08:30 (with ID card or passport), opening 09:30, hacking from 11:00, lunch 13:00, mentor check-ins 17:00, day wrap-up ~21:30.
- Working overnight at the venue is allowed, but there are no beds. **The doors close at 23:00**: anyone who leaves cannot come back in until morning.
- Sunday: doors open 08:30, briefing 09:00, final sprint 09:10, **form deadline 15:00**, pitches from 15:30, **NASA submission 18:50**, awards ~19:00.

**Venue:** Gheorghe Șincai Conference Centre, Strada Gheorghe Șincai, Alba Iulia.

**Prizes (gross, paid in RON at the fixed rate 1 EUR = 5.2405 RON, by bank transfer within 30 days):**

| Place | EUR | RON |
|---|---|---|
| 1 | 3,000 | 15,721.50 |
| 2 | 2,000 | 10,481.00 |
| 3 | 1,000 | 5,240.50 |

The team designates a representative who receives the prize and signs how it will be shared. Tax depends on how and to whom it is paid; the organizers settle this at payment.

**ElevenLabs:** one free month of the Creator tier for every participant (code on Discord, `#coupon-codes`), plus separate software awards, including one for the best project built with ElevenLabs.

**Global:** top local teams can be nominated for international judging (18–30 November); global winners are announced in January 2027.

**Organizer contact:** contact@daregen.ro, the event's WhatsApp community.

---

## 12. Sources

- Participant Rulebook, NASA Space Apps Alba Iulia 2026 (Dare.Gen, final version, 6 Nov 2026)
- Official challenges: <https://www.spaceappschallenge.org/2026/challenges/>
- LOLA polar products (LDEM): <https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE>
- LOLA 5 m/pixel, 87°S mosaic: <https://pgda.gsfc.nasa.gov/products/81>
- LOLA 5 m/pixel, landing-site DEMs: <https://pgda.gsfc.nasa.gov/products/78>
- LRO polar illumination maps: <https://pgda.gsfc.nasa.gov/products/69>
- Moon Trek (NASA): <https://trek.nasa.gov/moon/>
- JPL Horizons: <https://ssd.jpl.nasa.gov/horizons/>
- NASA NAIF SPICE: <https://naif.jpl.nasa.gov/naif/>
- Barker et al., 2021, *Planetary and Space Science* 203, 105119 — cite if we use the 5 m LOLA products: <https://doi.org/10.1016/j.pss.2020.105119>
