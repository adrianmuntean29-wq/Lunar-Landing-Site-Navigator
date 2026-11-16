/* Landing calendar, global, before the app: Sun and Earth from the JPL Horizons table, through js/sky.js. */
/* ---------- ephemeris: real Sun and Earth directions from data/subpoints.json ----------
   The file holds Moon-centred x, y, z of the Earth (km) and the Sun (1000 km) in the
   MOON_ME frame every 6 h (JPL Horizons, see pipeline/make_subpoints.py). For a site we
   subtract the site's own position (parallax: ~0.26 deg for Earth) and project onto the
   site's local east / north / up. Azimuth is clockwise from north, as in Horizons. */
var EPH = null;
/* The rules live in js/sky.js, shared with the mission view. The calendar clamps to the table instead of stopping. */
function ephAt(jd){ var g = Sky.range(EPH); return Sky.interp(EPH, Math.min(Math.max(jd, g[0]), g[1])); }
function azel(latDeg, lonDeg, v, direction){ return Sky.azel(latDeg, lonDeg, v, direction); }
function jdFromDate(d){ return d.getTime()/86400000 + 2440587.5; }
function dateFromJd(jd){ return new Date((jd - 2440587.5)*86400000); }

