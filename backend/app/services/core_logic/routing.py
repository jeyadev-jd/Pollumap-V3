"""
routing.py — Offline A* routing on KML road graph with exposure science.

Strategy for 3 distinct routes:
  1. Fastest  → standard A* (minimise distance)
  2. Cleanest → penalised A* (edge weight × concentration penalty)
  3. Balanced → penalised A* (50/50 distance+concentration)

Exposure model: E = C × IR × t
Results cached in MongoDB `route_cache` (30-min TTL).
"""

import math
import asyncio
import hashlib
import datetime
import re
import networkx as nx
from typing import List, Dict, Optional
from app.db.database import get_database

# ─── Transport modes ───────────────────────────────────────────────────────────
MODE_CONFIG = {
    "car":     {"speed_kmh": 35, "ir": 0.012, "label": "Car",     "icon": "🚗"},
    "bus":     {"speed_kmh": 20, "ir": 0.015, "label": "Bus",     "icon": "🚌"},
    "bike":    {"speed_kmh": 40, "ir": 0.025, "label": "Bike",    "icon": "🏍️"},
    "walking": {"speed_kmh": 5,  "ir": 0.020, "label": "Walking", "icon": "🚶"},
    "cycling": {"speed_kmh": 15, "ir": 0.035, "label": "Cycling", "icon": "🚴"},
}

# ─── Graph (loaded once) ───────────────────────────────────────────────────────
import os
KML_FILE = os.getenv("POLLUMAP_KML", os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "chennai.kml"))
_G: Optional[nx.Graph] = None
_nodes_list: list = []
_lock = asyncio.Lock()


async def get_graph() -> nx.Graph:
    global _G, _nodes_list
    if _G is not None:
        return _G
    async with _lock:
        if _G is not None:
            return _G
        loop = asyncio.get_event_loop()
        _G, _nodes_list = await loop.run_in_executor(None, _build_graph)
    return _G


def _build_graph():
    G = nx.Graph()
    try:
        import geopandas as gpd  # imported lazily so the module loads without GIS dependencies
        roads = gpd.read_file(KML_FILE, driver="KML")
        for geom in roads.geometry:
            if geom is None:
                continue
            segs = (list(geom.geoms) if geom.geom_type == "MultiLineString"
                    else [geom] if geom.geom_type == "LineString" else [])
            for seg in segs:
                coords = list(seg.coords)
                for i in range(len(coords) - 1):
                    a = (coords[i][0], coords[i][1])
                    b = (coords[i+1][0], coords[i+1][1])
                    d = _haversine(a[1], a[0], b[1], b[0])
                    G.add_edge(a, b, weight=d)
        if G.number_of_nodes() > 0:
            largest_cc = max(nx.connected_components(G), key=len)
            G = G.subgraph(largest_cc).copy()
        print(f"[routing] Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges", flush=True)
    except Exception as e:
        print(f"[routing] KML error: {e}", flush=True)
    return G, list(G.nodes)


# ─── Geometry ──────────────────────────────────────────────────────────────────
def _haversine(lat1, lon1, lat2, lon2):
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin(math.radians(lat2-lat1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(lon2-lon1)/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def _nearest_node(lon, lat):
    if not _nodes_list:
        return None
    return min(_nodes_list, key=lambda n: (n[0]-lon)**2 + (n[1]-lat)**2)


def _dist_m(path):
    return sum(_haversine(path[i][1], path[i][0], path[i+1][1], path[i+1][0])
               for i in range(len(path)-1))


def _to_coords(path):
    return [[n[0], n[1]] for n in path]


def _sample(path, step=300):
    if len(path) < 2:
        return path
    pts = [path[0]]
    for i in range(len(path)-1):
        seg = _haversine(path[i][1], path[i][0], path[i+1][1], path[i+1][0])
        n = max(1, int(seg // step))
        for j in range(1, n+1):
            r = j / n
            pts.append((path[i][0]+r*(path[i+1][0]-path[i][0]),
                         path[i][1]+r*(path[i+1][1]-path[i][1])))
    pts.append(path[-1])
    return pts


# ─── Pollution IDW ─────────────────────────────────────────────────────────────
def _idw(lat, lon, stations):
    keys = ["pm25", "pm10", "no2", "so2", "co", "o3"]
    if not stations:
        return {k: 0.0 for k in keys}
    W, V = [], {k: [] for k in keys}
    for s in stations:
        d = max(_haversine(lat, lon, s["lat"], s["lon"]), 50)
        w = 1.0 / d**2
        W.append(w)
        for k in keys:
            V[k].append(float(s.get(k) or 0))
    tw = sum(W) or 1e-9
    return {k: sum(w*v for w, v in zip(W, V[k])) / tw for k in keys}


def _C(poll):
    return (0.35*poll.get("pm25",0) + 0.20*poll.get("no2",0) +
            0.15*poll.get("pm10",0) + 0.10*poll.get("so2",0) +
            0.10*poll.get("co",0)   + 0.10*poll.get("o3",0))


def _exposure(path, dist_m, mode, stations):
    cfg = MODE_CONFIG[mode]
    dur = (dist_m / (cfg["speed_kmh"]*1000/3600)) / 60.0
    pts = _sample(path)
    concs = [_C(_idw(n[1], n[0], stations)) for n in pts]
    mean_c = sum(concs) / max(len(concs), 1)
    return {
        "duration_min": round(dur, 1),
        "distance_km": round(dist_m/1000, 2),
        "mean_concentration": round(mean_c, 2),
        "inhalation_rate": cfg["ir"],
        "exposure_ug": round(mean_c * cfg["ir"] * dur, 2),
        "speed_kmh": cfg["speed_kmh"],
    }


# ─── A* with pluggable weight function ────────────────────────────────────────
def _astar(G, src, dst, weight_fn=None):
    """Run A* with a custom per-edge weight callable(u,v,data)->float."""
    try:
        return nx.astar_path(
            G, src, dst,
            heuristic=lambda u, v: _haversine(u[1], u[0], v[1], v[0]),
            weight=weight_fn if weight_fn else "weight"
        )
    except (nx.NetworkXNoPath, nx.NodeNotFound, Exception):
        return None


# Weight on estimated pollution in the edge cost of the pollution-aware routes.
# cost(edge) = length * (1 + alpha * C_cell / C_ref), so cost is never below length and the
# haversine heuristic stays admissible. Larger alpha trades distance for cleaner air.
ROUTE_ALPHA = {"cleanest": 4.0, "balanced": 1.0}
_CELL_DEG = 0.005  # about 550 m: concentration is evaluated once per cell and cached


def _exposure_weight_fn(stations, alpha):
    """Edge-cost callable that charges for the estimated concentration at the edge midpoint."""
    if not stations or alpha <= 0:
        return None
    ref = sum(_C(s) for s in stations) / len(stations) or 1.0
    cache = {}

    def weight(u, v, data):
        lat, lon = (u[1] + v[1]) / 2.0, (u[0] + v[0]) / 2.0
        cell = (round(lat / _CELL_DEG), round(lon / _CELL_DEG))
        c = cache.get(cell)
        if c is None:
            c = cache[cell] = _C(_idw(lat, lon, stations))
        return data.get("weight", 1.0) * (1.0 + alpha * c / ref)

    return weight


def _build_routes(G, src, dst, stations=None):
    """
    Three routes:
      fastest  -> A* on edge length
      cleanest -> A* on length weighted by estimated concentration (alpha = ROUTE_ALPHA["cleanest"])
      balanced -> same with a smaller alpha (ROUTE_ALPHA["balanced"])

    Pollution enters the edge cost, so the cleaner routes are actually optimised for the
    estimated concentration field. If the field is nearly uniform (for example when it comes
    from a coarse model such as CAMS) the three routes may coincide; that is reported, not forced.
    Exposure (E = C * IR * t) is still computed afterwards by point sampling.
    """
    path_fast = _astar(G, src, dst)
    if not path_fast:
        return None, None, None
    path_clean = _astar(G, src, dst, weight_fn=_exposure_weight_fn(stations, ROUTE_ALPHA["cleanest"])) or path_fast
    path_bal = _astar(G, src, dst, weight_fn=_exposure_weight_fn(stations, ROUTE_ALPHA["balanced"])) or path_fast
    return path_fast, path_clean, path_bal


# ─── MongoDB cache ─────────────────────────────────────────────────────────────
CACHE_TTL = 1800  # 30 min


def _ckey(city, slat, slon, elat, elon, mode):
    r = f"{city}|{round(slat,4)}|{round(slon,4)}|{round(elat,4)}|{round(elon,4)}|{mode}"
    return hashlib.md5(r.encode()).hexdigest()


async def _cget(key):
    try:
        db = get_database()
        doc = await db.route_cache.find_one({"_id": key}, {"_id": 0})
        if doc:
            age = (datetime.datetime.utcnow() - doc["cached_at"]).total_seconds()
            if age < CACHE_TTL:
                r = doc["result"]
                r["_cached"] = True
                r["_cache_age_s"] = int(age)
                return r
            await db.route_cache.delete_one({"_id": key})
    except Exception: pass
    return None


async def _cset(key, result):
    try:
        db = get_database()
        await db.route_cache.replace_one(
            {"_id": key},
            {"_id": key, "cached_at": datetime.datetime.utcnow(), "result": result},
            upsert=True
        )
    except Exception: pass


# ─── Area helpers ──────────────────────────────────────────────────────────────
async def lookup_area(city, name):
    db = get_database()
    doc = await db.city_areas.find_one(
        {"city": city, "name": {"$regex": f"^{name}$", "$options": "i"}},
        {"_id": 0, "name": 1, "lat": 1, "lon": 1}
    )
    if not doc:
        doc = await db.city_areas.find_one(
            {"city": city, "name": {"$regex": name, "$options": "i"}},
            {"_id": 0, "name": 1, "lat": 1, "lon": 1}
        )
    return doc


async def search_areas(city, query, limit=10):
    db = get_database()
    safe_q = re.escape(query)
    # Match the start of any word (avoids finding 'Ram' in 'Santoshapuram')
    cur = db.city_areas.find(
        {"city": city, "name": {"$regex": f"\\b{safe_q}", "$options": "i"}},
        {"_id": 0, "name": 1, "lat": 1, "lon": 1}
    ).limit(limit * 4)  # over-fetch to handle duplicates gracefully
    
    docs = await cur.to_list(length=limit * 4)
    
    seen = set()
    unique = []
    for d in docs:
        # Avoid showing 5 identical "Ram Nagar" entries
        if d["name"] not in seen:
            seen.add(d["name"])
            unique.append(d)
            if len(unique) == limit:
                break
                
    return unique


# ─── Station fetch ────────────────────────────────────────────────────────────
async def _stations(city):
    db = get_database()
    areas = await db.city_areas.find({"city": city}, {"_id": 0}).to_list(300)

    async def snap(a):
        s = await db.aqi_snapshots.find_one(
            {"city": city, "location": a.get("name", "")},
            sort=[("timestamp", -1)],
            projection={"_id": 0, "pollutants_final": 1}
        )
        if s:
            m = s.get("pollutants_final", {})
            return {"lat": a["lat"], "lon": a["lon"],
                    **{k: m.get(k, 0) for k in ["pm25","pm10","no2","so2","co","o3"]}}
        return None

    res = await asyncio.gather(*[snap(a) for a in areas])
    return [r for r in res if r]


# ─── Main ─────────────────────────────────────────────────────────────────────
async def evaluate_routes(city, start_lat, start_lon, end_lat, end_lon, mode="car"):
    if mode not in MODE_CONFIG:
        mode = "car"

    # Cache check
    ckey = _ckey(city, start_lat, start_lon, end_lat, end_lon, mode)
    cached = await _cget(ckey)
    if cached:
        return cached

    G = await get_graph()
    if G.number_of_nodes() == 0:
        return {"error": "Road graph not loaded."}

    src = _nearest_node(start_lon, start_lat)
    dst = _nearest_node(end_lon, end_lat)
    if not src or not dst:
        return {"error": "Could not snap to road network."}

    # Fetch station data in parallel
    st = await _stations(city)

    # ─── Bounding Box Subgraph Optimization ───
    # Crop the 570k node graph to just the bounding box + padding
    # This drastically reduces A* search space and speeds up computation.
    pad = 0.06  # ~6.5 km padding around the start/end points
    min_lon, max_lon = min(start_lon, end_lon) - pad, max(start_lon, end_lon) + pad
    min_lat, max_lat = min(start_lat, end_lat) - pad, max(start_lat, end_lat) + pad

    valid_nodes = [
        n for n in G.nodes
        if min_lon <= n[0] <= max_lon and min_lat <= n[1] <= max_lat
    ]
    subG = G.subgraph(valid_nodes)

    if src not in subG or dst not in subG:
        return {"error": "Could not create a valid routing boundary."}

    # Build 3 paths via A*; the cleaner two use a pollution-weighted edge cost
    loop = asyncio.get_event_loop()
    path_fast, path_clean, path_bal = await loop.run_in_executor(
        None, _build_routes, subG, src, dst, st
    )

    if not path_fast:
        return {"error": "No path found between these locations."}

    d_fast  = _dist_m(path_fast)
    d_clean = _dist_m(path_clean)
    d_bal   = _dist_m(path_bal)

    def route(label, color, path, dist):
        e = _exposure(path, dist, mode, st)
        return {"label": label, "color": color,
                "geometry": {"type": "LineString", "coordinates": _to_coords(path)},
                "mode": mode, "mode_label": MODE_CONFIG[mode]["label"],
                "mode_icon": MODE_CONFIG[mode]["icon"], **e}

    fastest  = route("Fastest Route",  "#3b82f6", path_fast,  d_fast)
    cleanest = route("Cleanest Air",   "#10b981", path_clean, d_clean)
    balanced = route("Balanced Route", "#f59e0b", path_bal,   d_bal)

    saving_ug  = round(fastest["exposure_ug"] - cleanest["exposure_ug"], 2)
    saving_pct = round((saving_ug / max(fastest["exposure_ug"], 0.001)) * 100, 1)

    # Mode comparison on fastest path
    mode_comparison = {}
    for m, cfg in MODE_CONFIG.items():
        e = _exposure(path_fast, d_fast, m, st)
        mode_comparison[m] = {
            "label": cfg["label"], "icon": cfg["icon"],
            "duration_min": e["duration_min"],
            "exposure_ug": e["exposure_ug"],
            "ir": cfg["ir"],
            "distance_km": e["distance_km"],
        }

    result = {
        "fastest": fastest, "cleanest": cleanest, "balanced": balanced,
        "mode_comparison": mode_comparison,
        "saving_ug": saving_ug, "saving_pct": saving_pct,
        "candidates_count": 3,
        "cleanest_differs_from_fastest": path_clean != path_fast,
        "exposure_model": "E = C x IR x t with fixed pollutant weights and inhalation rates; concentration field = interpolated stored snapshots",
        "start": {"lat": start_lat, "lon": start_lon},
        "end":   {"lat": end_lat,   "lon": end_lon},
        "city": city, "mode": mode, "_cached": False,
    }

    await _cset(ckey, result)
    return result
