import httpx
from typing import List, Dict

CAMS_API_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
METEO_API_URL = "https://api.open-meteo.com/v1/forecast"
POLLUTANT_MAP = {'pm25': 'pm2_5', 'pm10': 'pm10', 'o3': 'ozone', 'no2': 'nitrogen_dioxide', 'so2': 'sulphur_dioxide', 'co': 'carbon_monoxide'}
METEO_VARS = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'wind_speed_10m', 'wind_direction_10m', 'shortwave_radiation']

async def fetch_cams_data(lats: List[float], lons: List[float]) -> List[Dict]:
    """Fetches CAMS background pollutant data for a list of coordinates"""
    params = {
        "latitude": lats,
        "longitude": lons,
        "current": ",".join(POLLUTANT_MAP.values()),
        "timezone": "auto"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            # We must use proper GET params formulation for array inputs with httpx
            response = await client.get(CAMS_API_URL, params=params, timeout=15.0)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    return [data] # Single coordinate fallback
        except Exception as e:
            print(f"Error fetching CAMS api: {e}")
    return []

async def fetch_meteo_data(lats: List[float], lons: List[float]) -> List[Dict]:
    """Fetches current meteorological data from OpenMeteo for coordinates"""
    params = {
        "latitude": lats,
        "longitude": lons,
        "current": ",".join(METEO_VARS),
        "timezone": "auto"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(METEO_API_URL, params=params, timeout=15.0)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    return [data]
        except Exception as e:
            print(f"Error fetching METEO api: {e}")
            
    return []
