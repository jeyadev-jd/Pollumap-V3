import datetime
import random
from typing import Dict, Any, List

def generate_local_ai_insight(
    city: str,
    location: str,
    aqi: int,
    aqi_category: str,
    pollutants: Dict[str, float],
    meteo: Dict[str, float],
    sources: Dict[str, float],
    forecast_24h: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Synthesizes a personalized 'AI-like' natural language health insight 
    based on current local conditions and forecast.
    """
    
    # Analyze the prominent factors
    traffic_idx = meteo.get("traffic_index", 40)
    temp = meteo.get("temperature_2m", 30)
    humidity = meteo.get("relative_humidity_2m", 60)
    
    # 1. Opening statement based on general AQI
    if aqi < 50:
        opening = f"Excellent atmospheric conditions in {location}. The air is clean and optimal for all outdoor activities."
    elif 50 <= aqi <= 100:
        opening = f"Air quality in {location} is currently acceptable ({aqi_category}). However, unusually sensitive individuals should consider limiting prolonged outdoor exertion."
    elif 100 < aqi <= 200:
        opening = f"Caution advised. Air quality in {location} has degraded to {aqi_category} levels. Sensitive groups are at risk of health effects."
    else:
        opening = f"Critical Alert: The air quality in {location} is severely hazardous ({aqi_category}). Everyone may experience acute health effects."

    # 2. Contextual analysis (why is it like this?)
    context_parts = []
    if sources.get("Traffic", 0) > 40 or traffic_idx > 60:
        context_parts.append("heavy localized traffic emissions")
    if sources.get("Industrial", 0) > 30:
        context_parts.append("industrial exhaust accumulation")
    if sources.get("Biomass/Dust", 0) > 30:
        context_parts.append("elevated dust and biomass burning in the wider region")
    
    context_sentence = ""
    if context_parts:
        if len(context_parts) == 1:
            context_sentence = f"Our models indicate this is primarily driven by {context_parts[0]}."
        elif len(context_parts) == 2:
            context_sentence = f"This current profile is heavily influenced by {context_parts[0]} and {context_parts[1]}."
        else:
            context_sentence = f"Multiple factors are converging here, notably {context_parts[0]}, {context_parts[1]}, and {context_parts[2]}."

    # 3. Weather / Meteorology impact
    weather_sentence = ""
    if meteo.get("wind_speed_10m", 0) < 5:
        weather_sentence = "Stagnant wind patterns are currently preventing pollutant dispersion, allowing particulate matter to pool at ground level."
    elif temp > 35 and humidity > 70:
        weather_sentence = "High temperatures over 35°C combined with high humidity are exacerbating smog formation and apparent heat stress."
    elif temp < 15:
        weather_sentence = "Winter inversion layers are trapping cold, dense polluted air near the surface."
    else:
        weather_sentence = "Current moderate wind patterns are assisting in regional dispersion, preventing further immediate degradation."

    # 4. Actionable Health Recommendations
    recommendations = []
    if aqi > 100:
        recommendations.append("Wear a well-fitted N95/KN95 mask if you must go outdoors.")
        recommendations.append("Keep windows closed to prevent indoor PM2.5 accumulation.")
    else:
        recommendations.append("Good time to open windows and aerate indoor spaces.")
        
    if traffic_idx > 70:
        recommendations.append(f"Avoid exercising or walking near major arterial roads in {location} right now due to peak traffic congestion.")
        
    if "Industrial" in context_parts:
        recommendations.append("Those with asthma should ensure their inhalers are readily accessible due to active industrial VOC off-gassing.")

    if not recommendations:
        recommendations.append("Maintain normal healthy routines, no special precautions necessary.")
        
    # 5. Bring in forecast context
    forecast_sentence = ""
    if forecast_24h and len(forecast_24h) > 0:
        avg_future_aqi = sum(f.get("predicted_aqi", aqi) for f in forecast_24h[:12]) / min(12, len(forecast_24h))
        if avg_future_aqi > (aqi + 20):
            forecast_sentence = "Predictive modeling suggests conditions will significantly worsen over the next 12 hours. Plan outdoor activities accordingly."
        elif avg_future_aqi < (aqi - 20):
            forecast_sentence = "A noticeable improvement in air quality is forecast by tomorrow morning as atmospheric conditions shift."
        else:
            forecast_sentence = "Current particulate levels are expected to remain relatively stable throughout the day."

    # Stitch the narrative together
    narrative = f"{opening} {context_sentence} {weather_sentence} {forecast_sentence}"
    
    # Format the final AI generated insight package
    return {
        "summary": narrative.strip(),
        "recommendations": recommendations,
        "key_drivers": [s.title() for s in context_parts] if context_parts else ["Mixed sources"],
        "generated_at": datetime.datetime.now().isoformat(),
        "confidence": round(random.uniform(0.85, 0.98), 2)  # Simulate AI confidence score
    }
