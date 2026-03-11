import httpx
from app.db.database import get_database

OVERPASS_API_URL = "https://overpass-api.de/api/interpreter"

async def fetch_city_areas(city: str):
    """Fetches administrative suburbs/neighborhoods for a given city and stores in DB"""
    db = get_database()
    
    # Check cache first
    existing = await db.city_areas.count_documents({"city": city})
    if existing > 0:
        print(f"✅ {city} areas already cached.")
        return
        
    print(f"Fetching Overpass areas for {city}...")
    
    if city.lower() == "delhi":
        query = """[out:json][timeout:25];area["name"="Delhi"]["boundary"="administrative"]->.searchArea;node["place"="suburb"](area.searchArea);out center;"""
    else: # Default Chennai from blueprint
        query = """[out:json][timeout:25];area["name"="Chennai"]->.searchArea;(node["place"="suburb"](area.searchArea);node["place"="neighbourhood"](area.searchArea););out body;"""
        
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(OVERPASS_API_URL, data=query, timeout=30.0)
            if response.status_code == 200:
                data = response.json()
                docs = []
                for node in data.get("elements", []):
                    tags = node.get("tags", {})
                    name = tags.get("name")
                    lat, lon = node.get("lat"), node.get("lon")
                    if name and lat and lon:
                        docs.append({
                            "city": city,
                            "osm_id": f"node/{node['id']}",
                            "name": name,
                            "type": tags.get("place", "suburb"),
                            "lat": lat,
                            "lon": lon
                        })
                if docs:
                    await db.city_areas.insert_many(docs)
                    print(f"✅ Cached {len(docs)} areas for {city}")
        except Exception as e:
            print(f"Error fetching areas: {e}")

async def fetch_osm_sources(city: str):
    """Fetches high-pollution sources from OSM for a given city and caches them"""
    db = get_database()
    
    existing = await db.osm_sources.count_documents({"city": city})
    if existing > 0:
        print(f"✅ {city} static OSM sources already cached.")
        return
        
    print(f"Fetching static OSM sources for {city}...")
    
    query = f"""[out:json][timeout:180];area["name"="{city}"]["boundary"="administrative"]->.searchArea;(way["landuse"="industrial"](area.searchArea);way["industrial"~"factory|chemical|refinery|steel_works"](area.searchArea);way["man_made"="works"](area.searchArea);node["man_made"="kiln"](area.searchArea);way["power"="plant"](area.searchArea);way["landuse"~"landfill|quarry|brownfield"](area.searchArea);way["highway"~"motorway|trunk|primary"](area.searchArea);node["amenity"="fuel"](area.searchArea);way["construction"="site"](area.searchArea););out center;"""
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(OVERPASS_API_URL, data=query, timeout=120.0)
            if response.status_code == 200:
                data = response.json()
                docs = []
                for el in data.get("elements", []):
                    tags, s_type = el.get("tags", {}), "unknown"
                    if tags.get("landuse") == "industrial": s_type = "industrial"
                    elif tags.get("landuse") in ["landfill", "quarry", "brownfield"]: s_type = "landfill_quarry_brownfield"
                    elif tags.get("power") == "plant": s_type = "power_plant"
                    elif tags.get("highway") in ["motorway", "trunk", "primary"] or tags.get("amenity") == "fuel": s_type = "major_road_or_fuel"
                    elif tags.get("construction") == "site": s_type = "construction"
                    elif tags.get("man_made") == "kiln": s_type = "kiln"
                    
                    center = el.get("center", {})
                    lat, lon = center.get("lat", el.get("lat")), center.get("lon", el.get("lon"))
                    
                    if lat and lon and s_type != "unknown":
                        docs.append({
                            "city": city,
                            "type": s_type,
                            "name": tags.get("name", "N/A"),
                            "lat": lat,
                            "lon": lon
                        })
                if docs:
                    await db.osm_sources.insert_many(docs)
                    print(f"✅ Cached {len(docs)} OSM sources for {city}")
        except Exception as e:
            print(f"Error fetching OSM sources: {e}")
