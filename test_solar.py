from app.services.core_logic.forecasting import generate_xgb_forecast
import datetime
import json

doc = {"city": "Chennai", "name": "Uthandi"}
cur_pol = {"pm25": 20, "pm10": 40, "o3": 30, "no2": 15, "so2": 10, "co": 300}
cur_met = {"temperature": 32, "humidity": 65, "wind_speed": 10, "solar_radiation": 400, "pressure": 1010}

forecasts = generate_xgb_forecast(doc, cur_pol, cur_met, 24)
for f in forecasts:
    local_ts = f["forecast_for"] + datetime.timedelta(hours=5, minutes=30)
    print(local_ts.hour, f["meteo"]["solar_radiation"])
