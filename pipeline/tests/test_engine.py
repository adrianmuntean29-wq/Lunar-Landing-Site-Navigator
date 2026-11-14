"""Engine tests. Fast ones need no data; the regression test needs the 80 m DEM + network (skipped otherwise).

Run from pipeline/:  python -m pytest -q tests
"""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import dem  # noqa: E402
import horizon  # noqa: E402
import metrics  # noqa: E402


def test_projection_matches_pyproj():
    pyproj = pytest.importorskip("pyproj")
    t = pyproj.Transformer.from_crs(pyproj.CRS.from_proj4("+proj=longlat +R=1737400 +no_defs"),
                                    pyproj.CRS.from_proj4(dem.PROJ4), always_xy=True)
    for lat, lon in [(-89.7849, 203.97), (-89.4505, 222.84), (-88.6952, 291.7154), (-85.9756, 357.8876)]:
        assert np.allclose(dem.latlon_to_xy(lat, lon), t.transform(lon, lat), atol=1e-6)


def test_projection_round_trip_and_orientation():
    # lon 0 is straight up (+y), 90 E is right (+x)
    x, y = dem.latlon_to_xy(-89.0, 0.0)
    assert abs(x) < 1e-6 and y > 0
    x, y = dem.latlon_to_xy(-89.0, 90.0)
    assert x > 0 and abs(y) < 1e-6
    lat, lon = dem.xy_to_latlon(*dem.latlon_to_xy(-88.68, 292.1))
    assert np.isclose(lat, -88.68) and np.isclose(lon, 292.1)


def test_curvature_dip():
    # flat terrain: a point 100 km away sits 1.649 deg below the horizontal (d / 2R)
    el = horizon.elevation_deg(dem.R_MOON, 100e3 / dem.R_MOON, dem.R_MOON)
    assert np.isclose(el, -np.degrees(100e3 / (2 * dem.R_MOON)), atol=1e-3)


def test_flat_moon_horizon_is_below_zero_and_auto_stop_is_exact():
    z = np.zeros((400, 400), np.float32)
    g = dem.Grid(z=z, pixel=1500.0, x_min=-300000.0, y_max=300000.0, name="flat")
    m_auto, info = horizon.horizon_mask(-89.5, 30.0, g, dem_max_m=0.0, sub=1, frac=0.02)
    assert (m_auto < 0).all()                      # curvature: open sky everywhere
    d = horizon.distances(0, 1500.0, 1500.0, 0.02, 650e3)
    assert info["stop_km_max"] <= d[63] / 1000 + 1e-9   # flat: every ray stops after its first 64-sample block
    m_full, _ = horizon.horizon_mask(-89.5, 30.0, g, dem_max_m=1e6, sub=1, frac=0.02)  # bound never reached
    assert np.allclose(m_auto, m_full)


def test_sun_fraction_limits():
    assert np.isclose(metrics.sun_fraction(0.0, 1.0), 1.0)
    assert np.isclose(metrics.sun_fraction(1.0, 0.0), 0.0)
    assert np.isclose(metrics.sun_fraction(0.5, 0.5), 0.5)


def test_mask_lookup_uses_bin_centres_and_wraps():
    m = np.zeros(360)
    m[0] = 1.0
    assert np.isclose(metrics.mask_at(m, 0.5), 1.0)
    assert np.isclose(metrics.mask_at(m, 1.0), 0.5)
    assert np.isclose(metrics.mask_at(m, 360.0), 0.5)   # between bin 359 (0) and bin 0 (1)


def test_longest_run():
    assert metrics.longest_run([False, True, True, False, True]) == 2.0
    assert metrics.longest_run([False, False]) == 0.0


def test_azel_compass():
    # a site at the pole-side of lon 0: a direction toward lon 0 on the equator is due north-ish? Use exact case:
    # site on the equator at lon 0, Sun straight up -> el 90; Sun toward lon 90 on the equator -> az 90 (east)
    az, el = metrics.azel(np.array([[1.0, 0, 0]]), 0.0, 0.0)
    assert np.isclose(el[0], 90.0)
    az, el = metrics.azel(np.array([[0.0, 1.0, 0]]), 0.0, 0.0)
    assert np.isclose(az[0], 90.0) and np.isclose(el[0], 0.0)


DEM_OK = (dem.DATA_DIR / dem.DEM_80M).exists()
PSR_OK = (dem.DATA_DIR / "psr" / "LPSR_80S_20MPP_ADJ.shp").exists() or (dem.DATA_DIR / "psr" / "LPSR_80S_20MPP_ADJ.SHP").exists()


@pytest.mark.skipif(not PSR_OK, reason="PSR shapefile not downloaded")
def test_psr_distance():
    import build_psr
    lat, lon = dem.xy_to_latlon(6890.0, -4210.0)       # Shackleton crater floor (lowest point near the pole)
    assert build_psr.nearest_psr_km(lat, lon) == 0.0
    assert build_psr.nearest_psr_km(-89.4505, 222.84) > 1.0   # C1 ridge is sunlit, not in shadow
    assert len(build_psr.load_large()) == 1531                 # PGDA 90's own count of PSRs >= 1 km^2


@pytest.mark.skipif(not DEM_OK, reason="80 m DEM not downloaded")
@pytest.mark.parametrize("site,lat,lon,mast,expected", [
    ("S", -89.7849, 203.97, 0, 79.1),    # home server 79.1 (Glaser 2018 surface: 81.0)
    ("S", -89.7849, 203.97, 2, 83.4),    # home server 83.4
    ("C1", -89.4505, 222.84, 2, 85.6),   # home server 85.6 (Glaser 2018 at 2 m: 88.0)
])
def test_regression_against_home_server(site, lat, lon, mast, expected):
    """Two independent implementations (laptop + home server) must agree within 0.1 points."""
    far = dem.load_far()
    near = dem.load_near(lat, lon)
    sky = metrics.fetch_sky()
    m, info = horizon.horizon_mask(lat, lon, far, near, mast_m=mast)
    st = metrics.stats(metrics.site_series(m, sky, lat, lon, info["h0_m"], mast))
    assert abs(st["sun_pct"] - expected) < 0.1
    assert info["edge_rays"] == 0


def test_calendar_limits_and_relay():
    import windows
    H = 24 * 10
    sun_up = np.ones(H, bool)
    sun_up[30:40] = False                      # a 10 h night on day 1
    ser = dict(sun_frac=sun_up.astype(float), sun_up=sun_up, earth_up=np.zeros(H, bool))
    margin = np.where(sun_up, 1.0, -1.0)
    kw = dict(length_d=2, min_sun_pct=50, min_earth_pct=50, max_night_h=5, min_touchdown_deg=0, sun_margin=margin)
    days = windows.calendar(ser, 0, 8, **kw)
    assert len(days) == 8                                   # day 8 would run past the table end
    assert days[0]["fails"] == ["earth", "night"]           # window 0-48 h holds the 10 h night
    assert days[2]["fails"] == ["earth"]                    # window 48-96 h: no night
    relay = windows.calendar(ser, 0, 8, relay=True, **kw)
    assert relay[2]["pass_"] and relay[0]["fails"] == ["night"]
