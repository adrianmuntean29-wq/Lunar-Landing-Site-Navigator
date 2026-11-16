/* Sky: the Sun and Earth rules shared by the landing calendar (index.html) and the mission view (mission.html), so both
   pages, and the Python engine, use one definition of each.

   - table:   data/subpoints.json, JPL Horizons, Moon-centred Earth (km) and Sun (1000 km) in the MOON_ME frame every 6 h
   - interp:  4-point cubic Lagrange between table rows
   - azel:    azimuth (clockwise from lunar north) and elevation from a site. For the Earth the site's own offset from
              the Moon's centre counts (parallax, about 0.26 deg); the Sun is a pure direction, as in the engine
   - horizon: a site's 360-bin terrain mask, bin k covers azimuth [k, k+1) deg, looked up between bin centres
   - sunFrac: visible share of the Sun's disc (chord area), as the engine computes it
   - Earth counts as visible while any part of its disc is above the terrain horizon */
(function(root){
  'use strict';
  var Sky = {
    R_MOON: 1737.4,      // km, LOLA reference sphere
    SUN_R: 0.2666,       // deg, apparent radius of the Sun's disc
    EARTH_R: 0.95,       // deg, apparent radius of the Earth's disc from the Moon

    /* Moon-centred {earth, sun} vectors in km at Julian date jd, or null outside the table. */
    interp: function(tab, jd){
      var f = (jd - tab.jd0)/(tab.step_hours/24), i = Math.floor(f), u = f - i;
      if (i < 1 || i > tab.n - 3) return null;
      var w = [-u*(u - 1)*(u - 2)/6, (u + 1)*(u - 1)*(u - 2)/2, -(u + 1)*u*(u - 2)/2, (u + 1)*u*(u - 1)/6];
      var e = [0, 0, 0], s = [0, 0, 0];
      for (var k = 0; k < 4; k++){
        var r = (i - 1 + k)*3;
        for (var c = 0; c < 3; c++){ e[c] += w[k]*tab.earth_km[r + c]; s[c] += w[k]*tab.sun_1000km[r + c]*1000; }
      }
      return {earth: e, sun: s};
    },
    /* First and last Julian dates the table can interpolate. */
    range: function(tab){ return [tab.jd0 + tab.step_hours/24, tab.jd0 + (tab.n - 3)*tab.step_hours/24]; },

    /* {az, el} in degrees of a Moon-centred vector v (km) seen from a site at latDeg, lonDeg (east).
       direction = true: v is only a direction (the Sun), so no parallax. */
    azel: function(latDeg, lonDeg, v, direction){
      var R = direction ? 0 : Sky.R_MOON, la = latDeg*Math.PI/180, lo = lonDeg*Math.PI/180;
      var cla = Math.cos(la), sla = Math.sin(la), clo = Math.cos(lo), slo = Math.sin(lo);
      var dx = v[0] - R*cla*clo, dy = v[1] - R*cla*slo, dz = v[2] - R*sla;
      var up = dx*cla*clo + dy*cla*slo + dz*sla, east = -dx*slo + dy*clo, north = -dx*sla*clo - dy*sla*slo + dz*cla;
      var az = Math.atan2(east, north)*180/Math.PI;
      return {az: (az + 360) % 360, el: Math.asin(Math.max(-1, Math.min(1, up/Math.hypot(dx, dy, dz))))*180/Math.PI};
    },

    /* Terrain horizon elevation (deg) toward azimuth az from a 360-value mask. */
    horizon: function(mask, az){
      var a = ((az - 0.5) % 360 + 360) % 360, i0 = Math.floor(a), fr = a - i0;
      return mask[i0 % 360]*(1 - fr) + mask[(i0 + 1) % 360]*fr;
    },

    /* Visible share (0..1) of the Sun's disc when its centre is alt degrees above the terrain horizon. */
    sunFrac: function(alt){
      var u = Math.max(-1, Math.min(1, -alt/Sky.SUN_R));
      return (Math.acos(u) - u*Math.sqrt(1 - u*u))/Math.PI;
    },
    /* Any part of the Earth's disc above the terrain horizon. */
    earthUp: function(alt){ return alt > -Sky.EARTH_R; }
  };
  root.Sky = Sky;
})(window);
