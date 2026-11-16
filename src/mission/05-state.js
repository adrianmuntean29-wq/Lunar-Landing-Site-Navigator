/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): page
   state (launch site and date, picked sites) and recomputing the mission. */
/* =====================================================================
   state
   ===================================================================== */
var launchIdx = 0, active = 'crewed', view = 'system', mapMode = 'pole';
var picks = {crewed: DEFAULT_PICKS.crewed.slice(), robotic: DEFAULT_PICKS.robotic.slice()};
var target = {crewed: null, robotic: null};
var results = {crewed: [], robotic: []}, budgets = {}, mission = null;
var cam = {yaw: -0.9, pitch: 0.62, zoom: 1};
var met = 0, playing = false, warp = 6, customN = 0;
var launchMs = Math.floor((Date.now() + 7*86400000)/3600000)*3600000;
function siteById(id){ for (var i = 0; i < SITES.length; i++) if (SITES[i].id === id) return SITES[i]; return null; }

/* the hourly table starts yesterday and covers ~18 months, so moving the launch inside it needs no rebuild */
function tableStart(){
  var day = 86400000, t0 = Math.floor(Date.now()/day)*day - day, span = (MODEL.tableDays - MODEL.year - 40)*day;
  return launchMs >= t0 && launchMs <= t0 + span ? t0 : Math.floor(launchMs/day)*day - day;
}
function recompute(){
  buildTable(tableStart());
  budgets.crewed = budget('crewed'); budgets.robotic = budget('robotic');
  ['crewed', 'robotic'].forEach(function(k){
    var list = picks[k].map(siteById).filter(Boolean).map(function(s){ return analyse(s, k); });
    list.sort(function(a, b){ return b.score - a.score; });
    results[k] = list;
    if (!target[k] || picks[k].indexOf(target[k]) < 0) target[k] = list.length ? list[0].site.id : null;
  });
  buildMission();
}
/* move the launch so that mission k lands at table hour i */
function planFor(k, i){
  autoBest = false;
  launchMs = Math.round((tabTime(i) - missionTimes(k).land*86400000)/3600000)*3600000;
  syncDate();
}

