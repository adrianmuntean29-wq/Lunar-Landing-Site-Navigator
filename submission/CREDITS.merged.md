<!--
DRAFT for Eren's approval (SUBMISSION session, 2026-11-14 15:20).
Merged from the repo's CREDITS.md (local clone, read 15:14) + vault\CREDITS-PENDING.md (read 15:14) + libraries found in
design-drafts\app (three.js, Google Fonts). Meant to REPLACE the repo's CREDITS.md once the final page is in the repo.
Flags: UNVERIFIED = licence not read from the item's own licence file / metadata. FLAG = a line that may be untrue today.
-->

# Credits, licences and sources

The NASA Space Apps 2026 Participant Terms require every source to be cited and every non-NASA material to be freely
available or OSI-licensed, with its licence listed here.

## Our own work
- Code in this repository was written by team Peaks of Light. [FLAG 1: the current CREDITS.md says "written during the event";
  see note at the bottom before keeping that wording.]
- Licence of our code: [FLAG 2: the repo has no LICENSE file. The current CREDITS.md says NASA distributes Space Apps solutions
  under Apache-2.0; that claim is UNVERIFIED (not found in the vault's rule notes). Either add a LICENSE file (Adrian, repo owner)
  or remove the sentence.]

## NASA data
| Source | Used for | Link | Licence / terms |
|---|---|---|---|
| JPL Horizons API (DE441 ephemeris, `MOON_ME` frame) | Sub-solar and sub-Earth points **2026-2036**, 6 h steps (`data/subpoints.json`, made by `pipeline/make_subpoints.py`); per-site reference series in the engine; topocentric values used to check the page | https://ssd.jpl.nasa.gov/horizons/ | NASA/JPL public service |
| NASA GSFC PGDA product 90: LOLA south-pole DEM `LDEM_80S_80MPP_ADJ` and `LDEM_80S_20MPP_ADJ` (Barker et al. 2023, doi:10.3847/PSJ/acf3e1; data doi:10.60903/gsfcpgda-lola-spole) | Terrain heights, horizon masks, 3D view grids (`heights.bin`, `cap_heights.bin`) | https://pgda.gsfc.nasa.gov/products/90 | NASA data; cite paper + data DOI |
| NASA GSFC PGDA product 90: permanently shadowed regions `LPSR_80S_20MPP_ADJ` (shapefile) | `data/psr.json`, distance to permanent shadow (`psr_km`) | https://pgda.gsfc.nasa.gov/products/90 | NASA data; cite with the DEM |
| ~~NASA GSFC PGDA product 69, LOLA illumination and Earth-visibility maps~~ | [FLAG 3: the current CREDITS.md says "validation of our sunlight and Earth-visibility percentages", but no vault log shows a comparison against product 69. Keep only if that comparison is run before the freeze; otherwise remove or reword to "planned".] | https://pgda.gsfc.nasa.gov/products/69 | NASA data |

## Papers and documents
- Gläser, P. et al. (2018). Illumination conditions at the lunar poles: implications for future exploration. *Planetary and Space
  Science* 162. Sites C1 (Connecting Ridge) and S (Shackleton rim); published sunlight values used for validation.
  https://ntrs.nasa.gov/citations/20170007365
- De Rosa, D. et al. (2012). Characterisation of potential landing sites for the European Space Agency's Lunar Lander project.
  *Planetary and Space Science* 74. Sites GR1 (de Gerlache rim) and MP1 (Malapert). https://arxiv.org/abs/1208.5587
- Mazarico, E. et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211. Horizon method.
- Barker, M. K. et al. (2023). LOLA south-pole DEM (PGDA product 90). *Planetary Science Journal*, doi:10.3847/PSJ/acf3e1.
- Dwyer Cianciolo, A. (2024). "Artemis Human Landing System Update", NASA Langley seminar presentation, NTRS 20240009596.
  Reference values next to the sliders ("as listed in a NASA presentation (2024)"). https://ntrs.nasa.gov/citations/20240009596
  [CHECK: URL form assumed from the NTRS id.]
- [IF THE MISSIONS LAYER SHIPS] NASA (2011). Recommendations to Space-Faring Entities: How to Protect and Preserve the Historic and
  Scientific Value of U.S. Government Lunar Artifacts, Rev A. Keep-out distances 2.0 km / 0.5 km (non-binding).
  https://www.nasa.gov/pdf/617743main_NASA-USG_LUNAR_HISTORIC_SITES_RevA-508.pdf
- [IF THE MISSIONS LAYER SHIPS] Mission positions and sources: one line per source used in `missions.csv` (LROC positions, agency
  announcements). [TO FILL from the MISSIONS chat's file.]

## Third-party software
| Package | Version | Licence | Where | Status |
|---|---|---|---|---|
| three.js | 0.160.0 (jsDelivr CDN) | MIT | 3D terrain view (page) | UNVERIFIED (licence file not read; also not yet in CREDITS-PENDING) |
| IBM Plex Sans, IBM Plex Mono (Google Fonts) | | SIL Open Font License 1.1 | page | UNVERIFIED (CREDITS-PENDING says "check") |
| Saira Condensed (Google Fonts) | | SIL Open Font License 1.1 | old `index.html` | UNVERIFIED; FLAG 4: not used by the new page draft; remove if the old page is replaced |
| NumPy | 2.4.2 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 | engine | VERIFIED (package metadata) |
| SciPy | 1.17.1 | BSD-3-Clause | engine (`map_coordinates`) | VERIFIED (metadata classifier) |
| rasterio | 1.5.2 | BSD-3-Clause | engine (DEM reading, `/vsicurl`) | VERIFIED (metadata) |
| GDAL (bundled in the rasterio wheel) | 3.12.2 | MIT | engine via rasterio | UNVERIFIED (GDAL licence file not read) |
| affine | 3.0.1 | BSD-3-Clause | via rasterio | VERIFIED (metadata) |
| pyproj | 3.8.0 | MIT | engine tests (projection cross-check) | VERIFIED (metadata) |
| PROJ (bundled in the pyproj wheel) | 9.8.1 | MIT | via pyproj | UNVERIFIED (PROJ licence file not read) |
| pyshp | 3.1.8 | MIT | engine (`build_psr.py`) | VERIFIED (metadata) |
| shapely | 2.2.0 | BSD-3-Clause | engine (`build_psr.py`) | VERIFIED (metadata) |
| pytest | 9.2.0 | MIT | engine tests | VERIFIED (metadata) |
| Python standard library | 3.14 | PSF License | `pipeline/` | standard |

## Tools
- Claude Code (Anthropic): AI coding and research assistant. See the AI-use section of the README and `AI_USE.md`.
- GitHub and GitHub Pages: hosting. [CHECK: Pages is the final host.]

## Media
- No images, video, music, sound effects or voice from third parties or AI. [UPDATE if any are added: each needs a source,
  a licence, and for AI images a visible watermark.]

---

### Notes for Eren (delete before publishing)
- **FLAG 1, decision:** the team repo's Romanian README (section 10, local clone) says a prototype `index.html` on generated terrain
  existed before the event, and CREDITS.md says all code was written during the event. Both cannot stay as written. The FAQ forbids
  working on the challenge before the hackathon. I did not write either claim into these drafts. Eren + Adrian decide what is
  true and how to state it; I can then word it.
- **To move from CREDITS-PENDING when the page lands in the repo:** three.js (not listed there yet), pyshp, shapely, PSR shapefile,
  NTRS presentation; Horizons range 2026-2036 (CREDITS.md still says 2026-2030).
