"""Tests for the fixes: no synthetic training data, no random weather, pollution-aware routing."""
import datetime
import pathlib
import sys

import networkx as nx
import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.services.core_logic import forecasting, routing  # noqa: E402


def _snapshots(hours, seed=0):
    rng = np.random.default_rng(seed)
    t0 = datetime.datetime(2026, 8, 1)
    out = []
    for i in range(hours):
        ts = t0 + datetime.timedelta(hours=i)
        base = 40 + 15 * np.sin(2 * np.pi * ((ts.hour + 5.5) - 6) / 24) + rng.normal(0, 3)
        out.append({"timestamp": ts, "pollutants_final": {
            "pm25": base, "pm10": base * 1.6, "o3": 30 + rng.normal(0, 2),
            "no2": 20 + rng.normal(0, 2), "so2": 5 + rng.normal(0, 0.5), "co": 400 + rng.normal(0, 20)}})
    return out


def test_no_randomness_or_synthetic_history_in_forecaster():
    src = pathlib.Path(forecasting.__file__).read_text()
    assert "import random" not in src
    assert "random.uniform" not in src
    assert not hasattr(forecasting, "_build_history")


def test_no_forecast_without_enough_real_history():
    doc = {"city": "Chennai", "name": "X"}
    assert forecasting.generate_xgb_forecast(doc, _snapshots(48), [], 24) == []
    assert forecasting.generate_xgb_forecast(doc, [], [], 24) == []


def test_forecast_uses_real_history_and_never_invents_weather():
    doc = {"city": "Chennai", "name": "X"}
    fc = forecasting.generate_xgb_forecast(doc, _snapshots(24 * 14), [], 24)
    assert len(fc) == 24
    assert fc[0]["model_version"] == forecasting.MODEL_VERSION
    assert fc[0]["trained_on_hours"] >= 24 * 14 - 5
    assert all(v is None for v in fc[0]["meteo"].values())  # nothing fabricated when no weather forecast
    assert fc[0]["meteo_source"] is None
    # forecast starts after the last stored observation
    assert fc[0]["forecast_for"] > _snapshots(24 * 14)[-1]["timestamp"]


def test_forecast_passes_through_real_weather_fields():
    doc = {"city": "Chennai", "name": "X"}
    wx = [{"temperature": 30.0, "humidity": 70, "wind_speed": 9.0, "wind_direction": 123.0,
           "pressure": 1005.0, "solar_radiation": 0.0, "rainfall": 0.4}] * 24
    fc = forecasting.generate_xgb_forecast(doc, _snapshots(24 * 14), wx, 24)
    assert fc[3]["meteo"]["wind_direction"] == 123.0
    assert fc[3]["meteo"]["rainfall"] == 0.4
    assert fc[3]["meteo_source"] == "open-meteo forecast"


def _grid_graph():
    """Two routes A to B: a short one through a polluted middle, a modestly longer clean detour."""
    G = nx.Graph()
    lat0, lon0 = 13.0, 80.0
    step = 0.01
    pts = {"A": (lon0, lat0), "M": (lon0 + step, lat0), "B": (lon0 + 2 * step, lat0),
           "D": (lon0 + step, lat0 + 0.012)}
    def w(a, b):
        return routing._haversine(pts[a][1], pts[a][0], pts[b][1], pts[b][0])
    for a, b in [("A", "M"), ("M", "B"), ("A", "D"), ("D", "B")]:
        G.add_edge(pts[a], pts[b], weight=w(a, b))
    return G, pts


def _stations(poll_mid, poll_detour):
    """One station at the midpoint of every edge, so the sampled field is known exactly there."""
    st = lambda lat, lon, v: {"lat": lat, "lon": lon, "pm25": v, "pm10": v, "no2": v, "so2": v, "co": v, "o3": v}
    return [st(13.0, 80.005, poll_mid), st(13.0, 80.015, poll_mid),
            st(13.006, 80.005, poll_detour), st(13.006, 80.015, poll_detour)]


def test_clean_route_avoids_polluted_corridor_and_fastest_does_not():
    G, pts = _grid_graph()
    fast, clean, bal = routing._build_routes(G, pts["A"], pts["B"], _stations(200.0, 10.0))
    assert pts["M"] in fast          # shortest path goes through the polluted middle
    assert pts["M"] not in clean     # the pollution-aware route takes the clean detour
    assert routing._dist_m(clean) > routing._dist_m(fast)


def test_uniform_field_gives_same_routes_not_forced_detour():
    G, pts = _grid_graph()
    fast, clean, bal = routing._build_routes(G, pts["A"], pts["B"], _stations(50.0, 50.0))
    assert clean == fast and bal == fast


def test_no_stations_falls_back_to_fastest():
    G, pts = _grid_graph()
    fast, clean, bal = routing._build_routes(G, pts["A"], pts["B"], None)
    assert clean == fast
