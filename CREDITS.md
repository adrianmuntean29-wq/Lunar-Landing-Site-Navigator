# Credits, licences and sources

The NASA Space Apps 2026 Participant Terms require every source to be cited and every non-NASA material to be freely
available or OSI-licensed, with its licence listed here.

## Our own work
- All code in this repository was written by team Peaks of Light during NASA Space Apps 2026 (Alba Iulia, 14-15 November 2026),
  with the help of AI tools (see the AI-use section of the README).
- Licence of our code: MIT (see `LICENSE`).

## NASA data
| Source | Used for | Link | Licence / terms |
|---|---|---|---|
| JPL Horizons API (DE441 ephemeris, `MOON_ME` frame) | Sub-solar and sub-Earth points 2026-2036, 6 h steps (`data/subpoints.json`, made by `pipeline/make_subpoints.py`); per-site reference series in the engine | https://ssd.jpl.nasa.gov/horizons/ | NASA/JPL public service |
| NASA GSFC PGDA product 90: LOLA south-pole DEM `LDEM_80S_80MPP_ADJ` and `LDEM_80S_20MPP_ADJ` (Barker et al. 2023, doi:10.3847/PSJ/acf3e1; data doi:10.60903/gsfcpgda-lola-spole) | Terrain heights, horizon masks, terrain grids and tiles, south-polar relief map | https://pgda.gsfc.nasa.gov/products/90 | NASA data; cite paper + data DOI |
| NASA GSFC PGDA product 90: permanently shadowed regions `LPSR_80S_20MPP_ADJ` | `data/psr.json`, distance to permanent shadow | https://pgda.gsfc.nasa.gov/products/90 | NASA data; cite with the DEM |
| NASA GSFC PGDA product 69, LOLA illumination and Earth-visibility maps (Mazarico et al.) | Validation: our sunlight and Earth-visibility percentages compared with these maps | https://pgda.gsfc.nasa.gov/products/69 | NASA data |
| NASA GSFC PGDA product 78: High-Resolution LOLA Topography for Lunar South Pole Sites (Barker), site regions | The six boxes our engine searched for their best-lit point (sites E-I) | https://pgda.gsfc.nasa.gov/products/78 | NASA data |
| NASA GSFC PGDA product 90: surface roughness `LDRM_80S_1000MPP_ADJ_ROUGH_100M` / `_200M` | Input to the team's flat, smooth terrain zones (`data/zones.json`) | https://pgda.gsfc.nasa.gov/products/90 | NASA data; cite with the DEM |
| LRO NAC south-pole mosaic (1 m) and LRO WAC south-pole mosaic (100 m), served by NASA Moon Trek (WMTS tiles) | "Seen from orbit", descent and ascent cameras in `mission.html` (loaded live, not stored) | https://trek.nasa.gov/moon/ | NASA data (LRO, LROC/ASU) |
| NASA GSFC PGDA product 81: South Pole LOLA DEM Mosaic, 5 m/pixel (`ldem_87s_5mpp`; Barker et al. 2021, doi:10.1016/j.pss.2020.105119) | Base of the team's terrain maps and zones (elevation map; slope map derived by the team from this DEM) | https://pgda.gsfc.nasa.gov/products/81 | NASA data; cite paper |
| USGS Astrogeology Science Center, Astropedia: LRO LOLA Shade SPole45 100 m v04 | Hillshade underlay of the team's zone map | https://astrogeology.usgs.gov/search (product "LRO LOLA Shade SPole45 100m v04") | USGS / NASA LOLA data, public domain; credit USGS Astrogeology and the LOLA team |
| NASA NTRS 20250011660, Artemis candidate regions and criteria | Background for the site list | https://ntrs.nasa.gov/citations/20250011660 | NASA document |
| NASA, LRO images of the IM-1 Odysseus lander | IM-1 landing position | https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/ | NASA content |

## Other data
| Source | Used for | Link | Licence / terms |
|---|---|---|---|
| Open-Meteo forecast API and historical weather API (ERA5 reanalysis) | Launch-site weather in the mission view (loaded live, not stored) | https://open-meteo.com/ | Data CC BY 4.0, attribution "Weather data by Open-Meteo.com" |
| NASA NSSDCA, Apollo landing site coordinates (from LRO images, Wagner et al. 2017, Icarus 283) | Apollo 11, 15, 17 positions in the mission view | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html | NASA content |
| LROC (LRO Camera team, ASU) image pages with measured lander positions | Chandrayaan-3, Chang'e 4, Chang'e 6, SLIM, Blue Ghost M1 and IM-2 Athena positions in the mission view | https://lroc.im-ldi.com/images/1314 · /1100 · /1374 · /1358 · /1407 · /1408 | LROC/ASU, NASA mission data |
| LROC image page of the IM-2 target | Site J (IM-2 Athena target) | https://lroc.im-ldi.com/images/1401 | LROC/ASU, NASA mission data |
| Maritime Launch Services, Spaceport Nova Scotia (Canso, NS) | Launch-site location; the coordinates (about 45.35 N, 61.02 W) are approximate, the operator does not publish them | https://maritimelaunch.com/ | Facts cited |
| Flat, smooth terrain zones (`data/zones.json`) | Team analysis by Tudor in ArcGIS from LOLA slope and hillshade, PGDA 90 roughness and permanently shadowed regions; drawn as "Flat, smooth terrain (team analysis)", not NASA regions and not chosen for sunlight | this repository | MIT (our work) |

## Images and textures
| File | Source | Credit |
|---|---|---|
| `assets/moon_color_4k.jpg`, `assets/lroc_color_2k.jpg` | NASA Scientific Visualization Studio, CGI Moon Kit (ID 4720), LROC WAC colour mosaic (Arizona State University), https://svs.gsfc.nasa.gov/4720 | NASA's Scientific Visualization Studio |
| `assets/moon_normal_4k.jpg` (baked by us) | Derived from CGI Moon Kit `ldem_16_uint.tif` (LOLA elevation), https://svs.gsfc.nasa.gov/4720 | NASA's Scientific Visualization Studio; LOLA team, NASA GSFC |
| `assets/moon_normal_s80_2k.jpg`, `assets/site_detail_normal.jpg`, `assets/site_outer_heights.bin` (baked by us) | Derived from PGDA product 90 `LDEM_80S_80MPP_ADJ` | As the DEM row above |
| `assets/earth_bmng_2k.jpg` (resized by us) | NASA Earth Observatory, Blue Marble Next Generation with topography and bathymetry, December 2004 | NASA Earth Observatory (Reto Stöckli, NASA GSFC) |
| `favicon.svg` (tab icon and loading-screen logo) | Logo: SVG written by Claude (Anthropic), AI-generated; no NASA elements. Marked "Logo drawn by AI (Claude)" on the loading screen and in the file's title. | Our project (MIT) |

No music, sound effects or voice. The only AI-generated image is the logo above.

## Papers and documents
- Gläser, P. et al. (2018). Illumination conditions at the lunar poles: implications for future exploration. *Planetary and Space
  Science* 162. Sites C1 (Connecting Ridge) and S (Shackleton rim); published sunlight values used for validation.
  https://ntrs.nasa.gov/citations/20170007365
- De Rosa, D. et al. (2012). Characterisation of potential landing sites for the European Space Agency's Lunar Lander project.
  *Planetary and Space Science* 74. Site coordinates GR1 (de Gerlache rim) and MP1 (Malapert). https://arxiv.org/abs/1208.5587
- Mazarico, E. et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211. Horizon method.
- Barker, M. K. et al. (2023). A New View of the Lunar South Pole from the Lunar Orbiter Laser Altimeter (LOLA). *Planetary Science
  Journal* 4, 183. doi:10.3847/PSJ/acf3e1. Data: PGDA product 90, doi:10.60903/gsfcpgda-lola-spole.
- Barker, M. K. et al. (2021). *Planetary and Space Science* 203, 105119. doi:10.1016/j.pss.2020.105119. Data: PGDA product 81
  (South Pole LOLA DEM Mosaic, 5 m).
- Dwyer Cianciolo, A. (2024). "Artemis Human Landing System Update", NASA presentation, NTRS 20240009596.
  The Earth-contact default (25%), quoted as listed there ("as listed in a NASA presentation (2024)").
- NASA (2011). Recommendations to Space-Faring Entities: How to Protect and Preserve the Historic and Scientific Value of
  U.S. Government Lunar Artifacts, Rev A. Keep-out distances 2.0 km / 0.5 km (non-binding).
- Meeus, J. (1998). *Astronomical Algorithms*, 2nd ed., Willmann-Bell. Moon and Sun positions for the mission view's 3D scene
  and launch times (checked against JPL Horizons).
- IAU sidereal time formula (Greenwich mean sidereal time) for the launch-site rotation.
- Other-missions positions (`data/missions.csv`): each row cites its source in the file (LROC image pages, agency releases,
  USGS Gazetteer of Planetary Nomenclature, published papers).

## Third-party software
| Package | Version | Licence | Where |
|---|---|---|---|
| three.js | 0.160.0 (jsDelivr CDN) | MIT | 3D views (page) |
| IBM Plex Sans, IBM Plex Mono (Google Fonts) | | SIL Open Font License 1.1 | pages |
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

## Tools
- Claude Code (Anthropic): AI coding and research assistant. See the AI-use section of the README.
- GitHub and GitHub Pages: hosting.
