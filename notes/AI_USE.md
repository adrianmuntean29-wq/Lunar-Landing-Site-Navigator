# AI use log (for the NASA submission)

The submission must describe how AI tools were used. One line per use. "Human check" says what a person verified.

| Time | Session | Tool / model | What it did | Human check |
|---|---|---|---|---|
| 2026-11-14 morning | research (DEM) | Claude Code | Compared LOLA DEM products, chose PGDA 90; drafted horizon method | Eren read the notes |
| 2026-11-14 morning | research (ephemeris) | Claude Code | Tested browser ephemeris routes against live Horizons | Results are test output |
| 2026-11-14 morning | research (prior art) | Claude Code | Surveyed existing tools and other teams' repos | Eren read the report |
| 2026-11-14 morning | research (frontend) | Claude Code | Surveyed frontend libraries for a south-pole view | Eren read the notes |
| 2026-11-14 morning | engine | Claude Code | Scratchpad tests: DEM header, projection, mask speed, first validation vs Glaser 2018 | Numbers compared to published values |
| 2026-11-14 ~11:00-12:00 | frontend | Claude Code | Translated index.html to English; wrote `pipeline/make_subpoints.py`; replaced the fake Sun/Earth model with real Horizons data; added sites, date picker, sunset/Earthset headline, CREDITS.md | Browser values checked against 6 live Horizons az/el values (max 0.0042 deg); Eren reviewed the page |
| 2026-11-14 morning | research (manager) | Claude Code, 4 research agents | Read NASA guides, tested a Horizons call, deep prior-art research, drafted concept proposal | Eren reviewed; concept not yet red-teamed |
| 2026-11-14 11:59 | organizer | Claude Code | Set up this vault | Eren approved the structure |
| 2026-11-14 12:01 | engine | Claude Code | Checked the seeded measurement note, filled package licences from installed metadata | Licences read from package metadata; GDAL/PROJ still to check |
| 2026-11-14 12:25 | engine | Claude Code | Benchmarks: mask speed vs accuracy, whole-pole masks, 5-year Horizons table, time layer in Python and JS | Timings are test output; sky table checked against per-site Horizons |
