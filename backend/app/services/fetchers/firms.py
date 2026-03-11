import asyncio
import httpx
import csv
import io
from datetime import date, timedelta
from typing import List, Dict

async def fetch_firms_data(api_key: str, area_bounds: List[float], day_range: int = 1) -> List[Dict]:
    """
    Fetches active fire data from NASA FIRMS.
    area_bounds: [west, south, east, north] (e.g. [77, 10, 83, 16] for Chennai/TN region)
    Returns a list of dicts with latitude, longitude, and frp (Fire Radiative Power).
    """
    start_date = (date.today() - timedelta(days=day_range)).strftime('%Y-%m-%d')
    bounds_str = ",".join(map(str, area_bounds))
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{api_key}/VIIRS_SNPP_NRT/{bounds_str}/{day_range}/{start_date}"
    
    print(f"Fetching fire data from NASA FIRMS... {url}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            text = response.text
            if "No fire detected" in text or not text.strip():
                return []
                
            reader = csv.DictReader(io.StringIO(text))
            fires = []
            for row in reader:
                try:
                    fires.append({
                        "lat": float(row["latitude"]),
                        "lon": float(row["longitude"]),
                        "frp": float(row["frp"])
                    })
                except (KeyError, ValueError):
                    continue
            return fires
    except Exception as e:
        print(f"❌ Failed to fetch NASA FIRMS data: {e}")
        return []
