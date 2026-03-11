import math
from typing import Dict, List, Any
import numpy as np

# Pollutant specific base weights for city-wide apportionment
CITY_BASE_APPORTIONMENT = {
    'pm25': {'traffic': 0.45, 'industrial': 0.20, 'construction': 0.15, 'major_road_or_fuel': 0.15, 'power_plant': 0.05, 'kiln': 0.0, 'landfill_quarry_brownfield': 0.0},
    'pm10': {'traffic': 0.35, 'industrial': 0.20, 'construction': 0.25, 'major_road_or_fuel': 0.15, 'power_plant': 0.05, 'kiln': 0.0, 'landfill_quarry_brownfield': 0.0},
    'no2':  {'traffic': 0.70, 'industrial': 0.15, 'construction': 0.05, 'major_road_or_fuel': 0.05, 'power_plant': 0.05, 'kiln': 0.0, 'landfill_quarry_brownfield': 0.0},
    'so2':  {'traffic': 0.25, 'industrial': 0.40, 'construction': 0.05, 'major_road_or_fuel': 0.05, 'power_plant': 0.25, 'kiln': 0.0, 'landfill_quarry_brownfield': 0.0},
    'co':   {'traffic': 0.60, 'industrial': 0.10, 'construction': 0.0,  'major_road_or_fuel': 0.20, 'power_plant': 0.05, 'kiln': 0.05, 'landfill_quarry_brownfield': 0.0},
    'o3':   {'traffic': 0.55, 'industrial': 0.30, 'construction': 0.05, 'major_road_or_fuel': 0.05, 'power_plant': 0.05, 'kiln': 0.0, 'landfill_quarry_brownfield': 0.0},
    'voc':  {'traffic': 0.60, 'industrial': 0.25, 'construction': 0.05, 'major_road_or_fuel': 0.10, 'power_plant': 0.0, 'kiln': 0.0, 'landfill_quarry_brownfield': 0.0},
}

TRAFFIC_IMPACT_WEIGHTS = {'no2': 0.8, 'pm25': 0.5, 'pm10': 0.5, 'co': 0.4, 'voc': 0.3, 'so2': 0.1, 'o3': 0.1}
OSM_INFLUENCE_RADIUS_KM = 2.5
MAX_OSM_ADJUSTMENT_FACTOR = 2.0

FIRE_IMPACT_WEIGHTS = {'pm25': 1.0, 'co': 1.0, 'pm10': 0.8, 'no2': 0.6, 'o3': 0.5, 'so2': 0.2, 'voc': 0.3}
FIRE_IMPACT_SCALING_FACTOR = 10.0

# OSM Impact Constants
OSM_IMPACT_FACTORS = {
    'industrial': {'pm25': 1.15, 'pm10': 1.12, 'so2': 1.20, 'no2': 1.10, 'co': 1.10},
    'power_plant': {'so2': 1.25, 'no2': 1.15, 'pm25': 1.10},
    'landfill_quarry_brownfield': {'pm25': 1.12, 'pm10': 1.15},
    'major_road_or_fuel': {'no2': 1.18, 'pm25': 1.10, 'co': 1.15},
    'construction': {'pm25': 1.20, 'pm10': 1.20}, 
    'kiln': {'co': 1.25, 'pm25': 1.18}
}

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two lat/lon coordinates"""
    R = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def calculate_wind_alignment(target_lat, target_lon, target_wind_dir, source_lat, source_lon):
    """Calculates if the wind is blowing from the source to the target."""
    lat1, lon1, lat2, lon2 = map(math.radians, [target_lat, target_lon, source_lat, source_lon])
    dLon = lon2 - lon1
    y = math.sin(dLon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dLon)
    bearing = (math.degrees(math.atan2(y, x)) + 360) % 360
    # Difference between wind blowing from and the bearing to the source
    wind_alignment = abs(((target_wind_dir - bearing + 180) % 360) - 180)
    return wind_alignment

def apportion_sources(
    location_doc: Dict, 
    base_pollutant_levels: Dict[str, float],
    osm_sources: List[Dict],
    meteo: Dict,
    firms_fires: List[Dict] = None
) -> Dict[str, Dict[str, float]]:
    """
    Given a location and its final estimated pollutants, breaks it down into source categories.
    Incorporates local traffic index, OSM hotspots, and active FIRMS fires driven by wind alignment.
    """
    result = {}
    
    target_lat = location_doc['lat']
    target_lon = location_doc['lon']
    wind_dir = meteo.get('wind_direction', 90.0)
    traffic_index = meteo.get('traffic_index', 30.0)
    
    osm_categories = ['industrial', 'power_plant', 'landfill_quarry_brownfield', 'major_road_or_fuel', 'construction', 'kiln']
    
    for p, baseline in base_pollutant_levels.items():
        if baseline is None or math.isnan(baseline):
            continue
            
        base_split = CITY_BASE_APPORTIONMENT.get(p, {'traffic': 0.4, 'industrial': 0.2, 'construction': 0.1, 'major_road_or_fuel': 0.2, 'power_plant': 0.1, 'kiln': 0.0, 'landfill_quarry_brownfield': 0.0})
        
        # 1. Traffic calculation based on generalized time/weather delta
        traffic_base = baseline * base_split.get('traffic', 0)
        traffic_local = baseline * (traffic_index / 100.0) * TRAFFIC_IMPACT_WEIGHTS.get(p, 0.0)
        
        # 2. OSM hotspot multipliers driven by wind alignment
        category_scores = {cat: 0.0 for cat in osm_categories}
        total_osm_score = 0
        
        for source in osm_sources:
            dist = haversine(target_lat, target_lon, source['lat'], source['lon'])
            if dist < OSM_INFLUENCE_RADIUS_KM:
                cat = source['type']
                if cat in osm_categories:
                    impact = (OSM_IMPACT_FACTORS.get(cat, {}).get(p, 1.0) - 1.0) * (1 - (dist / OSM_INFLUENCE_RADIUS_KM))
                    if impact > 0:
                        wind_alignment = calculate_wind_alignment(target_lat, target_lon, wind_dir, source['lat'], source['lon'])
                        # If wind is blowing from source to target (+-45 deg), enhance impact
                        if wind_alignment <= 45:
                            impact *= 1.5
                        else:
                            impact *= 0.5 
                        
                        category_scores[cat] += impact
                        total_osm_score += impact
                        
        # Cap the impact to prevent runaway metrics
        max_allowed_delta = MAX_OSM_ADJUSTMENT_FACTOR - 1.0
        scale_ratio = 1.0
        if total_osm_score > max_allowed_delta:
            scale_ratio = max_allowed_delta / total_osm_score
            
        # 3. Fire impact — log-based dispersion (realistic for 10-100km range)
        total_fire_impact = 0.0
        if firms_fires:
            for fire in firms_fires:
                dist = haversine(target_lat, target_lon, fire['lat'], fire['lon'])
                dist_clamped = max(dist, 1.0)  # minimum 1 km to prevent blowup
                wind_alignment = calculate_wind_alignment(target_lat, target_lon, wind_dir, fire['lat'], fire['lon'])
                # Widen cone to 120° so regional fires still contribute
                if wind_alignment <= 120:
                    alignment_factor = max(0.05, 1.0 - (wind_alignment / 120.0))
                    # Log-based falloff: realistic for atmospheric dispersion over 20-100km
                    total_fire_impact += alignment_factor * fire['frp'] / math.log1p(dist_clamped)
                        
        fire_local = baseline * total_fire_impact * FIRE_IMPACT_WEIGHTS.get(p, 0.0) * FIRE_IMPACT_SCALING_FACTOR
            
        record = {
            'traffic': round(traffic_base + traffic_local, 2),
            'fire': round(fire_local, 2),
            'background': 0.0 # Everything is accounted for via explicit math
        }
        
        for cat in osm_categories:
            cat_base = baseline * base_split.get(cat, 0)
            cat_local = baseline * (category_scores[cat] * scale_ratio)
            record[cat] = round(cat_base + cat_local, 2)
            
        # Normalize sum to ensure it matches the final expected baseline exactly
        current_sum = sum(record.values())
        if current_sum > 0:
            correction = baseline / current_sum
            for k in record:
                record[k] = round(record[k] * correction, 2)
                
        result[p] = record

    return result
