import os
from fastapi import APIRouter, Query, HTTPException, Body
from typing import List, Optional, Dict, Any
from app.db.database import get_database
from app.services.core_logic.routing import evaluate_routes, lookup_area, search_areas
from app.services.fetchers.firms import fetch_firms_data
from app.services.core_logic.forecasting import generate_xgb_forecast, load_history, fetch_meteo_forecast, MODEL_VERSION
from app.services.core_logic.health_insights import generate_local_ai_insight
import datetime

router = APIRouter()

# ─── City / Location metadata ─────────────────────────────────────────────────

@router.get("/cities")
async def get_cities():
    return ["Chennai", "Delhi"]

@router.get("/locations")
async def get_locations(city: str):
    """Sensor stations with AQI data."""
    import asyncio
    db = get_database()
    # Only get the top locations that the worker actually computes
    locations = await db.city_areas.find({"city": city}, {"_id": 0}).to_list(1000)

    async def enrich(loc):
        snap = await db.aqi_snapshots.find_one(
            {"city": city, "location": loc["name"]},
            sort=[("timestamp", -1)],
            projection={"_id": 0, "aqi": 1, "aqi_category": 1, "aqi_color": 1}
        )
        if snap:
            loc.update(snap)
            return loc, True
        return loc, False

    results = await asyncio.gather(*[enrich(loc) for loc in locations])
    with_data = [loc for loc, has in results if has]
    without_data = [loc for loc, has in results if not has]
    return with_data + without_data


@router.get("/areas/search")
async def search_area_names(city: str, q: str = Query(..., min_length=1)):
    """Autocomplete for area names (MongoDB city_areas collection)."""
    results = await search_areas(city, q, limit=10)
    return results


async def _get_nearest_station_name(db, city, lat, lon):
    recent = await db.aqi_snapshots.find(
        {"city": city},
        projection={"location": 1, "lat": 1, "lon": 1, "_id": 0}
    ).sort("timestamp", -1).limit(100).to_list(100)

    unique_stations = {}
    for s in recent:
        loc = s.get("location")
        if loc and loc not in unique_stations and "lat" in s and "lon" in s:
            unique_stations[loc] = s

    if not unique_stations:
        return None

    def _haversine(lat1, lon1, lat2, lon2):
        import math
        R = 6371000
        p1, p2 = math.radians(lat1), math.radians(lat2)
        a = math.sin(math.radians(lat2-lat1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(lon2-lon1)/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    closest = min(unique_stations.values(), key=lambda s: _haversine(lat, lon, s["lat"], s["lon"]))
    return closest["location"]

@router.get("/current")
async def get_current(city: str, location: str):
    db = get_database()
    latest = await db.aqi_snapshots.find_one(
        {"city": city, "location": location},
        sort=[("timestamp", -1)],
        projection={"_id": 0}
    )
    if not latest:
        # Fallback to nearest station
        target = await db.city_areas.find_one({"city": city, "name": location})
        if target and "lat" in target and "lon" in target:
            nearest = await _get_nearest_station_name(db, city, target["lat"], target["lon"])
            if nearest:
                latest = await db.aqi_snapshots.find_one(
                    {"city": city, "location": nearest},
                    sort=[("timestamp", -1)],
                    projection={"_id": 0}
                )
                if latest:
                    latest["location"] = location
                    latest["lat"] = target["lat"]
                    latest["lon"] = target["lon"]
                    latest["_is_inferred"] = True
                    return latest
        raise HTTPException(status_code=404, detail="No recent data for this location.")
    return latest


@router.get("/history")
async def get_history(city: str, location: str, hours: int = Query(24)):
    db = get_database()
    cursor = db.aqi_snapshots.find(
        {"city": city, "location": location},
        projection={"_id": 0}
    ).sort("timestamp", -1).limit(hours)
    results = await cursor.to_list(length=hours)
    
    if not results:
        target = await db.city_areas.find_one({"city": city, "name": location})
        if target and "lat" in target and "lon" in target:
            nearest = await _get_nearest_station_name(db, city, target["lat"], target["lon"])
            if nearest:
                cursor = db.aqi_snapshots.find(
                    {"city": city, "location": nearest},
                    projection={"_id": 0}
                ).sort("timestamp", -1).limit(hours)
                results = await cursor.to_list(length=hours)
                for r in results:
                    r["location"] = location
                    r["lat"] = target["lat"]
                    r["lon"] = target["lon"]
                    r["_is_inferred"] = True
                    
    return results[::-1]


@router.get("/forecast")
async def get_forecast(city: str, location: str, hours: int = Query(24)):
    db = get_database()
    cursor = db.aqi_forecasts.find(
        {"city": city, "location": location},
        projection={"_id": 0}
    ).sort("forecast_for", 1).limit(hours)
    results = await cursor.to_list(length=hours)
    
    if not results:
        target = await db.city_areas.find_one({"city": city, "name": location})
        if target and "lat" in target and "lon" in target:
            nearest = await _get_nearest_station_name(db, city, target["lat"], target["lon"])
            if nearest:
                cursor = db.aqi_forecasts.find(
                    {"city": city, "location": nearest},
                    projection={"_id": 0}
                ).sort("forecast_for", 1).limit(hours)
                results = await cursor.to_list(length=hours)
                for r in results:
                    r["location"] = location
                    
    return results


@router.post("/forecast/generate")
async def generate_forecast(city: str, location: str):
    """
    Trigger XGBoost forecast generation for a specific city+location.
    Trains XGBoost on the real snapshots stored for this location, predicts
    24 h, clears old forecasts and inserts the new ones. Returns 409 when
    there is not enough history; it never fabricates a forecast.
    """
    db = get_database()

    # ── 1. Get the latest real snapshot as the anchor ──────────────────────
    latest = await db.aqi_snapshots.find_one(
        {"city": city, "location": location},
        sort=[("timestamp", -1)]
    )
    if not latest:
        raise HTTPException(
            status_code=404,
            detail=f"No snapshot data found for {location} in {city}. Run the worker first."
        )

    location_doc = {"city": city, "name": location,
                    "lat": latest.get("lat"), "lon": latest.get("lon")}

    # ── 2. Train on real stored history; real weather forecast for meteorology ──
    history = await load_history(db, city, location)
    meteo_fc = fetch_meteo_forecast(latest.get("lat"), latest.get("lon"), 24)
    forecasts = generate_xgb_forecast(location_doc, history, meteo_fc, hours_ahead=24)
    if not forecasts:
        raise HTTPException(
            status_code=409,
            detail=f"Not enough stored history for {location} in {city} to forecast "
                   f"({len(history)} snapshots). The worker must run for several days first."
        )

    # ── 3. Clear stale forecasts, insert fresh ones ────────────────────────
    await db.aqi_forecasts.delete_many({"city": city, "location": location})
    await db.aqi_forecasts.insert_many(forecasts)

    return {
        "status": "ok",
        "message": f"Generated {len(forecasts)} XGBoost forecast points for {location}.",
        "model": MODEL_VERSION,
        "trained_on_hours": forecasts[0].get("trained_on_hours"),
        "anchor_timestamp": latest.get("timestamp"),
    }



@router.delete("/cache/clear")
async def clear_route_cache():
    """Delete all cached routes (for testing / after data updates)."""
    db = get_database()
    result = await db.route_cache.delete_many({})
    return {"deleted": result.deleted_count}


@router.get("/osm-sources")
async def get_osm_sources(city: str):
    db = get_database()
    cursor = db.osm_sources.find({"city": city}, projection={"_id": 0})
    return await cursor.to_list(length=5000)


@router.get("/fires")
async def get_fires(city: str):
    """Active fire spots from NASA FIRMS."""
    if city == "Chennai":
        bounds = [79.8, 12.7, 80.4, 13.3]
    else:
        bounds = [76.8, 28.4, 77.4, 28.9]
    firms_key = os.getenv("NASA_FIRMS_API_KEY")
    if not firms_key:
        return []  # no key configured: report no data rather than failing or guessing
    fires = await fetch_firms_data(firms_key, bounds)
    return fires

@router.post("/analytics/save")
async def save_analytics(payload: Dict[str, Any] = Body(...)):
    """Save multi-pollutant correlation analysis to DB."""
    db = get_database()
    payload["saved_at"] = datetime.datetime.now()
    result = await db.health_analytics.insert_one(payload)
    return {"status": "success", "id": str(result.inserted_id)}


@router.post("/insights/generate")
async def generate_insights(city: str, location: str):
    """Generate and save local AI health insights."""
    db = get_database()
    # Need latest snapshot
    latest = await db.aqi_snapshots.find_one(
        {"city": city, "location": location},
        sort=[("timestamp", -1)]
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No snapshot data found.")

    # Need 24h forecast
    cursor = db.aqi_forecasts.find({"city": city, "location": location}).sort("forecast_for", 1).limit(24)
    forecast_24h = await cursor.to_list(length=24)

    insight_data = generate_local_ai_insight(
        city=city,
        location=location,
        aqi=latest.get("aqi", 0),
        aqi_category=latest.get("aqi_category", "Unknown"),
        pollutants=latest.get("pollutants_final", {}),
        meteo=latest.get("meteo", {}),
        sources=latest.get("sources", {}),
        forecast_24h=forecast_24h
    )

    insight_doc = {
        "city": city,
        "location": location,
        "timestamp": datetime.datetime.now().isoformat(),
        "insight": insight_data
    }
    
    await db.health_insights.insert_one(insight_doc.copy())
    # Return without the ObjectId error by avoiding the db object id
    return insight_doc

@router.get("/insights/history")
async def get_insights_history(city: str, location: str, limit: int = 10):
    db = get_database()
    cursor = db.health_insights.find(
        {"city": city, "location": location},
        projection={"_id": 0}
    ).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(length=limit)

# ─── Routing ──────────────────────────────────────────────────────────────────

@router.get("/optimal-route")
async def get_optimal_route(
    city: str,
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    mode: str = Query("car", description="Transport mode: car | bus | walking | cycling"),
):
    """Route by coordinates with multi-mode exposure analysis."""
    try:
        result = await evaluate_routes(city, start_lat, start_lon, end_lat, end_lon, mode)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing error: {e}")


@router.get("/route-by-area")
async def get_route_by_area(
    city: str,
    start_area: str,
    end_area: str,
    mode: str = Query("car", description="Transport mode: car | bus | walking | cycling"),
):
    """
    Route by area names (looked up from MongoDB city_areas).
    Returns fastest, cleanest, balanced routes + per-mode exposure comparison.
    """
    start = await lookup_area(city, start_area)
    if not start:
        raise HTTPException(status_code=404, detail=f"Area '{start_area}' not found in {city}.")
    end = await lookup_area(city, end_area)
    if not end:
        raise HTTPException(status_code=404, detail=f"Area '{end_area}' not found in {city}.")

    try:
        result = await evaluate_routes(
            city,
            start["lat"], start["lon"],
            end["lat"],   end["lon"],
            mode
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        # Enrich with resolved area names
        result["start_area"]  = start["name"]
        result["end_area"]    = end["name"]
        result["start"]["name"] = start["name"]
        result["end"]["name"]   = end["name"]
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing error: {e}")
