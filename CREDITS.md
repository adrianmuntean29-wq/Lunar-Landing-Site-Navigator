# Credits, licences and sources

The NASA Space Apps 2026 Participant Terms require every source to be cited and every non-NASA material to be freely
available or OSI-licensed, with its licence listed here. (Based on the team's credits file by Eren, extended for the mission view.)

## Our own work
- Code by team Peaks of Light for NASA Space Apps 2026 (Alba Iulia, 14–15 November 2026), with the help of AI tools. One part
  predates the event and is declared in the README ("Prior work and use of AI"): the first 3D view on generated terrain
  (6–13 November), whose renderer is the base of the 3D map in `index.html`.
- Licence of our code: MIT (see `LICENSE`).

## NASA data
| Source | Used for | Link | Licence / terms |
|---|---|---|---|
| JPL Horizons API (DE441 ephemeris, `MOON_ME` frame) | Sub-solar and sub-Earth points 2026–2036, 6 h steps (`data/subpoints.json`, made by `pipeline/make_subpoints.py`); per-site reference series in the engine | https://ssd.jpl.nasa.gov/horizons/ | NASA/JPL public service |
| NASA GSFC PGDA product 90: LOLA south-pole DEM `LDEM_80S_80MPP_ADJ` and `LDEM_80S_20MPP_ADJ` (Barker et al. 2023, doi:10.3847/PSJ/acf3e1; data doi:10.60903/gsfcpgda-lola-spole) | Terrain heights, horizon masks, terrain grids (`heights.bin`, `cap_heights.bin`, `region_heights.bin`) | https://pgda.gsfc.nasa.gov/products/90 | NASA data; cite paper + data DOI |
| NASA GSFC PGDA product 90: permanently shadowed regions `LPSR_80S_20MPP_ADJ` | `data/psr.json`, distance to permanent shadow | https://pgda.gsfc.nasa.gov/products/90 | NASA data; cite with the DEM |
| NASA GSFC PGDA product 78: High-Resolution LOLA Topography for Lunar South Pole Sites (Barker), site regions | The six boxes our engine searched for their best-lit point (sites E–I) | https://pgda.gsfc.nasa.gov/products/78 | NASA data |
| NASA GSFC PGDA product 69, LOLA illumination and Earth-visibility maps (Mazarico et al.) | Validation of sunlight and Earth-visibility percentages | https://pgda.gsfc.nasa.gov/products/69 | NASA data |
| LRO NAC south-pole mosaic (1 m) and LRO WAC south-pole mosaic (100 m), served by NASA Moon Trek (WMTS tiles) | "Seen from orbit", descent and ascent cameras in `mission.html` (loaded live, not stored) | https://trek.nasa.gov/moon/ | NASA data (LRO, LROC/ASU) |
| NASA NTRS 20250011660, Artemis candidate regions and criteria | Background for the site list | https://ntrs.nasa.gov/citations/20250011660 | NASA document |
| NASA, LRO images of the IM-1 Odysseus lander | IM-1 landing position | https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/ | NASA content |

## Other data
| Source | Used for | Link | Licence / terms |
|---|---|---|---|
| Open-Meteo forecast API and historical weather API (ERA5 reanalysis) | Launch-site weather in the mission view (loaded live, not stored) | https://open-meteo.com/ | Data CC BY 4.0, attribution "Weather data by Open-Meteo.com" |
| Wikipedia, "List of artificial objects on the Moon" and "Mons Mouton" | Coordinates of past landings shown for reference | https://en.wikipedia.org/wiki/List_of_artificial_objects_on_the_Moon | CC BY-SA 4.0 (facts cited, no text copied) |
| LROC image page of the IM-2 target | Site J (IM-2 Athena target) | https://lroc.im-ldi.com/images/1401 | LROC/ASU, NASA mission data |
| Space Odyssey Hub, Spaceport Nova Scotia | Launch-site coordinates | https://spaceodysseyhub.com/compare/spaceports/spaceport-nova-scotia | Facts cited |

## Papers, books and documents
- Gläser, P. et al. (2018). Illumination conditions at the lunar poles: implications for future exploration. *Planetary and Space
  Science* 162. Sites C1 (Connecting Ridge) and S (Shackleton rim); published sunlight values used for validation.
  https://ntrs.nasa.gov/citations/20170007365
- De Rosa, D. et al. (2012). Characterisation of potential landing sites for the European Space Agency's Lunar Lander project.
  *Planetary and Space Science* 74. Site coordinates GR1 (de Gerlache rim) and MP1 (Malapert). https://arxiv.org/abs/1208.5587
- Mazarico, E. et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211. Horizon method.
- Barker, M. K. et al. (2023). LOLA south-pole DEM (PGDA product 90). *Planetary Science Journal*, doi:10.3847/PSJ/acf3e1.
- Dwyer Cianciolo, A. (2024). "Artemis Human Landing System Update", NASA presentation, NTRS 20240009596.
  The Earth-contact default (25%), quoted as listed there.
- Meeus, J. (1998). *Astronomical Algorithms*, 2nd ed., Willmann-Bell. Moon and Sun positions for the mission view's 3D scene
  and launch times (checked against JPL Horizons).
- IAU sidereal time formula (Greenwich mean sidereal time) for the launch-site rotation.

## Third-party software
| Package | Version | Licence | Where |
|---|---|---|---|
| IBM Plex Sans, IBM Plex Mono, Saira Condensed (Google Fonts) | | SIL Open Font License 1.1 | pages |
| NumPy | 2.4.2 | BSD-3-Clause (with bundled MIT/0BSD/Zlib/CC0 parts) | engine |
| SciPy | 1.17.1 | BSD-3-Clause | engine |
| rasterio | 1.5.2 | BSD-3-Clause | engine (DEM reading) |
| GDAL (bundled in the rasterio wheel) | 3.12.2 | MIT | engine via rasterio |
| affine | 3.0.1 | BSD-3-Clause | via rasterio |
| pyproj / PROJ | 3.8.0 / 9.8.1 | MIT | engine tests |
| pyshp | 3.1.8 | MIT | engine (`build_psr.py`) |
| shapely | 2.2.0 | BSD-3-Clause | engine (`build_psr.py`) |
| pytest | 9.2.0 | MIT | engine tests |
| Python standard library | 3.14 | PSF License | `pipeline/` |

The pages themselves use no JavaScript libraries: hand-written WebGL and Canvas 2D.

No music, sound effects, voice or AI-generated images.

## Tools
- Claude Code (Anthropic): AI coding and research assistant. See the AI-use section of the README.
- GitHub and GitHub Pages: hosting.
