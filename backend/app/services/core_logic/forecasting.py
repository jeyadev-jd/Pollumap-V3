import random
from typing import Dict, List, Any
from datetime import datetime, timedelta

def generate_ensemble_forecast(
    location_doc: Dict, 
    current_pollutants: Dict[str, float],
    meteo_forecast: List[Dict],
    hours_ahead: int = 24
) -> List[Dict[str, Any]]:
    """
    Stub for the XGBoost + Random Forest ensemble forecast.
    Currently generates realistic synthetic variations based on current data
    and diurnal patterns to serve as a placeholder for the real ML models.
    """
    forecasts = []
    base_time = datetime.utcnow()
    
    # Simple base meteo if meteo_forecast is missing/empty
    base_temp = 32.0
    base_humidity = 65.0
    
    for h in range(1, hours_ahead + 1):
        target_time = base_time + timedelta(hours=h)
        target_hour = target_time.hour
        
        # Diurnal pattern multipliers (rush hour bumps, night dips)
        time_multiplier = 1.0
        temp_offset = 0.0
        if (8 <= target_hour <= 11) or (17 <= target_hour <= 21):
            time_multiplier = 1.3  # Rush hour
            temp_offset = 2.0
        elif target_hour >= 22 or target_hour <= 5:
            time_multiplier = 0.8  # Night
            temp_offset = -4.0
            
        forecast_row = {
            "city": location_doc.get("city"),
            "location": location_doc.get("name"),
            "forecast_for": target_time,
            "model_version": "ensemble_v1_stub",
            "pollutants": {},
            "meteo": {}
        }
        
        for p, current_val in current_pollutants.items():
            if current_val is None:
                continue
                
            # Random walk with diurnal bounding
            noise = random.uniform(0.9, 1.1)
            # Drift slightly towards the mean (preventing runaway values in synthetic mode)
            regression_factor = 0.95 
            
            predicted_val = current_val * time_multiplier * noise * regression_factor
            forecast_row["pollutants"][p] = round(predicted_val, 2)
            
        # Add basic meteo forecast stub (now comprehensive)
        forecast_row["meteo"] = {
            "temperature": round(base_temp + temp_offset + random.uniform(-1.5, 1.5), 1),
            "humidity": round(base_humidity + random.uniform(-5, 5), 1),
            "wind_speed": round(random.uniform(5, 20), 1),
            "wind_direction": round(random.uniform(0, 360), 0),
            "rainfall": round(random.uniform(0, 5) if random.random() > 0.8 else 0.0, 1),
            "solar_radiation": round(random.uniform(500, 1000) if 6 <= target_hour <= 18 else 0.0, 1),
            "pressure": round(random.uniform(1005, 1015), 1),
            "traffic_index": round(random.uniform(20, 80) * time_multiplier, 1)
        }
            
        forecasts.append(forecast_row)
        
    return forecasts
