from fastapi import APIRouter, Query, HTTPException, Body
from typing import List, Optional, Dict, Any
from app.db.database import get_database
from app.services.core_logic.routing import evaluate_routes, lookup_area, search_areas
from app.services.fetchers.firms import fetch_firms_data
import datetime

router = APIRouter()

# ─── City / Location metadata ─────────────────────────────────────────────────

@router.get("/cities")
async def get_cities():
    """Supported cities."""
    return ["Chennai", "Delhi"]


@router.get("/locations")
async def get_locations(city: str):
    """All locations with AQI — data-having ones returned first."""
    import asyncio
    db = get_database()
    locations = await db.city_areas.find({"city": city}, {"_id": 0}).to_list(100)

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
    with_data    = [loc for loc, has in results if has]
    without_data = [loc for loc, has in results if not has]
    return with_data + without_data


@router.get("/areas/search")
async def search_area_names(city: str, q: str = Query(..., min_length=1)):
    """Autocomplete for area names (MongoDB city_areas collection)."""
    results = await search_areas(city, q, limit=10)
    return results


# ─── Live data ────────────────────────────────────────────────────────────────

@router.get("/current")
async def get_current(city: str, location: str):
    db = get_database()
    latest = await db.aqi_snapshots.find_one(
        {"city": city, "location": location},
        sort=[("timestamp", -1)],
        projection={"_id": 0}
    )
    if not latest:
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
    return results[::-1]


@router.get("/forecast")
async def get_forecast(city: str, location: str, hours: int = Query(24)):
    db = get_database()
    cursor = db.aqi_forecasts.find(
        {"city": city, "location": location},
        projection={"_id": 0}
    ).sort("forecast_for", 1).limit(hours)
    return await cursor.to_list(length=hours)


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
    fires = await fetch_firms_data("c72502e93dc1a16b9c2ceff0c95043fc", bounds)
    return fires

@router.post("/analytics/save")
async def save_analytics(payload: Dict[str, Any] = Body(...)):
    """Save multi-pollutant correlation analysis to DB."""
    db = get_database()
    payload["saved_at"] = datetime.datetime.now()
    result = await db.health_analytics.insert_one(payload)
    return {"status": "success", "id": str(result.inserted_id)}

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
