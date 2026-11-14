<!--
DRAFT for Eren's approval (SUBMISSION session, 2026-11-14 15:20).
Official limit (CONTEXT.md): 30 s video OR max 7 slides INCLUDING the title, English or English subtitles. One over = not eligible.
Both are drafted; Eren picks which one goes on the NASA form (see question at the bottom).
Every number traces to a vault log (in brackets). No number from a log without a MEASURED/VERIFIED label.
-->

# Demo materials

## A. 30-second video script

Format: screen recording of the live page, light theme, 1080p, burned-in English captions. No music (or only a track with a
licence we can cite). Voice-over by a team member, or captions only. Hard stop at **0:29** so export rounding cannot push it past 30 s.

| Time | Screen | Caption / voice-over (≤ 12 words per line) |
|---|---|---|
| 0:00-0:04 | 3D LOLA terrain at the pole, Sun low, long shadows moving | "At the Moon's south pole, the Sun skims the horizon." |
| 0:04-0:08 | Zoom to a crater rim; horizon chart with Sun path touching the terrain line | "A crater rim decides if your lander has power and Earth contact." |
| 0:08-0:14 | Pick a site, press **Robotic** preset, landing calendar fills: blue days and grey days | "Pick a site and your limits. Every good landing day appears." |
| 0:14-0:19 | Hover a grey day: sentence "not enough sunlight (66%, you need 70%)" [use the real sentence on screen] | "Each day says why, in plain words." |
| 0:19-0:23 | Change first landing date by a few weeks (the slip); calendar and ranking update | "Launch slipped? Re-check in seconds." |
| 0:23-0:27 | Validation card: "Shackleton rim 79.1% vs 81.0% published" | "Real NASA LOLA terrain and JPL Horizons, checked against a published study." |
| 0:27-0:29 | Title card: South Pole Navigator · Peaks of Light · [DEMO_URL] | "Which spots and weeks work, and why." |

Notes
- The 66% / 70% sentence is an example of the page's wording; record whatever the page shows and caption it as shown.
- Numbers on the validation card: S surface 79.1% (2027-2031) vs Gläser 2018 81.0% (MEASURED, logs 1340, 1400).
- Record on the final page after the 10:30 freeze. Record twice; keep the cleaner take. Check the length in the player, not the editor.
- If a team member narrates: no AI voice unless credited (ElevenLabs then needs a credit line and an AI-use update).

## B. 7-slide outline (title counts as slide 1)

### Slide 1 · Title + "who already does this?"
- **South Pole Navigator** · Team Peaks of Light · NASA Space Apps 2026, Alba Iulia
- *Who already does this?* NASA expert tools (QuickMap, Moon Trek, JPL Horizons) and several public Space Apps projects show how
  sunny a point is, many with real terrain. **We answer a different question: where and when can I land?**
  Every landing day, for every site, under your own limits, checked against a published study.
- Pitch line (small): "The data is public, but using it takes expert tools and hours. We turn it into an answer you can check in seconds."
- Wording rule: no "nobody else does this" and no "NASA can't". QuickMap's Compute Visibility is still unchecked (log 1319),
  so we do not claim it lacks a feature.

### Slide 2 · The problem
- At the south pole the Sun circles close to the horizon; a rim a few km away decides power and Earth contact.
- Dates slip. Each slip means re-checking sites and dates.
- Our user: teams in early planning (concept studies, proposals, CLPS-style missions); the same view teaches students and the public.
- Visual: horizon chart, Sun path grazing the terrain line.

### Slide 3 · Demo (screenshot or live)
- The landing calendar for one site: blue = good day, grey = not, with the reason sentence.
- Sliders: mission length, sunlight %, Earth contact %, longest night, Sun at touchdown. Presets labelled "example values".
- Compare sites: ranked by good landing days under the same limits.
- [IF SHIPPED] mission pins + keep-out filter (our rarest feature per the competitor recheck, log 1507). Put it here if it works.

### Slide 4 · NASA data and method
- LOLA DEM, PGDA product 90 (20 m near each site, 80 m beyond); LOLA permanent-shadow map; JPL Horizons (DE441, Moon mean-Earth frame).
- Horizon: rays over curved terrain, **no fixed distance: a ray stops when terrain can no longer block the Sun** (same result as
  walking to the map edge at 5 sites, 0.0000 deg, MEASURED, log 1240).
- Python precomputes terrain; the browser computes your limits live.

### Slide 5 · Validation (numbers with labels and spans)
| Check | Result |
|---|---|
| Browser Sun/Earth vs JPL Horizons | max 0.0042 deg (n = 6) · MEASURED (log 1201) |
| Two independent implementations | 0 of 1,460 landing days disagree (4 sites, every day of 2027) · MEASURED (log 1440) |
| Shackleton rim S, surface | 79.1% vs 81.0% Gläser 2018 · ours 2027-2031 · MEASURED (logs 1340, 1400) |
| Connecting Ridge C1, 2 m mast | 85.6% vs 88.0% Gläser 2018 · ours 2027-2031 · MEASURED (logs 1340, 1400) |
- One line on why it matters: "On a 1 km grid the best spot reaches 65.8%; with 20 m terrain the ridges reach about 80%.
  Resolution changes the answer." (MEASURED, log 1400)
- Say what is not validated: Earth contact; sites GR1 and MP1.

### Slide 6 · What we do, and the limits
- We do: every landing window over 1-5 years, user limits, terrain horizon, mast height, relay switch, distance to permanent shadow,
  [IF SHIPPED] keep-out from other missions, data versions shown on the page.
- Limits: geometry only (no battery, thermal or radio link model); permanent shadow is a model, not ice; presets are examples;
  not a flight tool.

### Slide 7 · Impact and next steps
- Impact: a planning team re-checks a slipped date in seconds instead of hours; students see why the pole is hard.
- Next (only items we can defend): Earth-contact check against a published map; more sites at full resolution; battery-aware
  "longest lit period" readout; request a newer precalculation from the page.
- Team names + [DEMO_URL] + [REPO_URL] (QR code optional).

## C. Spoken pitch (local jury, 3-5 min): reuse slides 1-7
Not part of the NASA limit. Keep the order above; live demo replaces the slide 3 screenshot; keep a recorded video as backup.

---
### Decision for Eren
- **Which goes on the NASA form: the 30 s video, the 7 slides, or both?** CONTEXT.md says "30 s video OR max 7 slides". If both
  are allowed, each must stay inside its own limit.
