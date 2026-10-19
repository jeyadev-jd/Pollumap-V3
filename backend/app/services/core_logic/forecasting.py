"""
XGBoost 24-hour pollutant forecast, trained ONLY on real stored history.

Changes from the earlier version (documented for the research chapter):
* The synthetic 30-day training history is removed. The earlier model learned the
  behaviour of a random-walk generator, so its output was not evidence of skill.
* Wind direction, rainfall and the other meteorological fields are no longer
  random or model-guessed. They come from the Open-Meteo numerical forecast.
* If there is not enough stored history, NO forecast is produced (an empty list)
  instead of a fabricated one.
* Output smoothing is removed so the forecast can be evaluated exactly as produced.

What the stored history is: whatever the worker saved in `aqi_snapshots`. Check the
`pollutants_source` field of the snapshots before interpreting forecasts: forecasting a
model-derived series (for example CAMS) is not the same as forecasting station measurements.
"""

import datetime
import json
import urllib.parse
import urllib.request
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

IST_OFFSET = datetime.timedelta(hours=5, minutes=30)

POLLUTANTS = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co']

# Minimum hourly rows of real history needed before any forecast is produced (7 days).
MIN_HISTORY_HOURS = 168
HISTORY_DAYS = 60
MODEL_VERSION = 'xgboost_v2_real_history'

_HARD_BOUNDS = {
    'pm25': (0.0, 500.0), 'pm10': (0.0, 800.0), 'o3': (0.0, 400.0),
    'no2': (0.0, 400.0), 'so2': (0.0, 200.0), 'co': (0.0, 5000.0),
}

_OPEN_METEO_VARS = [
    'temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'wind_direction_10m',
    'surface_pressure', 'shortwave_radiation', 'precipitation',
]


# ─── Real weather forecast (replaces random / synthetic meteo) ────────────────

def fetch_meteo_forecast(lat: float, lon: float, hours: int = 24, timeout: int = 20) -> List[Dict[str, Any]]:
    """Hourly numerical weather forecast from Open-Meteo for the next `hours` hours.

    Returns a list of dicts with keys: temperature, humidity, wind_speed, wind_direction,
    pressure, solar_radiation, rainfall. Returns [] if the request fails; callers must
    then leave the fields empty and never invent values.
    """
    q = urllib.parse.urlencode({
        'latitude': lat, 'longitude': lon, 'hourly': ','.join(_OPEN_METEO_VARS),
        'forecast_hours': hours + 1, 'timezone': 'UTC',
    })
    try:
        with urllib.request.urlopen(f'https://api.open-meteo.com/v1/forecast?{q}', timeout=timeout) as r:
            h = json.load(r)['hourly']
    except Exception:
        return []
    times = pd.to_datetime(h['time'])
    now = pd.Timestamp.utcnow().tz_localize(None).floor('h')
    out = []
    for i, t in enumerate(times):
        if t <= now:
            continue
        out.append({
            'time': t.to_pydatetime(),
            'temperature': h['temperature_2m'][i],
            'humidity': h['relative_humidity_2m'][i],
            'wind_speed': h['wind_speed_10m'][i],
            'wind_direction': h['wind_direction_10m'][i],
            'pressure': h['surface_pressure'][i],
            'solar_radiation': h['shortwave_radiation'][i],
            'rainfall': h['precipitation'][i],
        })
    return out[:hours]


# ─── Real history ─────────────────────────────────────────────────────────────

async def load_history(db, city: str, location: str, days: int = HISTORY_DAYS) -> List[Dict[str, Any]]:
    """Stored snapshots for one location, oldest first."""
    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    cur = db.aqi_snapshots.find(
        {'city': city, 'location': location, 'timestamp': {'$gte': since}},
        {'_id': 0, 'timestamp': 1, 'pollutants_final': 1},
    ).sort('timestamp', 1)
    return await cur.to_list(length=None)


def history_to_frame(snapshots: List[Dict[str, Any]]) -> pd.DataFrame:
    """Snapshots -> regular hourly DataFrame (hour means, gaps up to 3 h interpolated)."""
    rows = []
    for s in snapshots:
        pf = s.get('pollutants_final') or {}
        row = {'timestamp': s['timestamp']}
        for p in POLLUTANTS:
            v = pf.get(p)
            row[p] = float(v) if v is not None else np.nan
        rows.append(row)
    if not rows:
        return pd.DataFrame(columns=['timestamp'] + POLLUTANTS)
    df = pd.DataFrame(rows).set_index('timestamp').sort_index()
    df = df.resample('1h').mean()
    df = df.interpolate(limit=3)
    df = df.reset_index()
    df['hour'] = (df['timestamp'] + IST_OFFSET).dt.hour
    df['day_of_week'] = (df['timestamp'] + IST_OFFSET).dt.weekday
    df['month'] = (df['timestamp'] + IST_OFFSET).dt.month
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
    return df


# ─── Feature engineering and training ─────────────────────────────────────────

def _add_features(df: pd.DataFrame, target: str) -> pd.DataFrame:
    df = df.sort_values('timestamp').reset_index(drop=True)
    for lag in [1, 2, 3, 6, 12, 24]:
        df[f'{target}_lag{lag}'] = df[target].shift(lag)
    for win in [3, 6, 12]:
        df[f'{target}_roll_mean{win}'] = df[target].rolling(win).mean()
        df[f'{target}_roll_std{win}'] = df[target].rolling(win).std()
    df.dropna(inplace=True)
    return df


_FEATURE_BASE = ['hour', 'day_of_week', 'month', 'is_weekend']


def _train_and_predict(df: pd.DataFrame, target: str, future_hours: int = 24) -> List[float]:
    cols_needed = ['timestamp', 'hour', 'day_of_week', 'month', 'is_weekend', target]
    df_feat = _add_features(df[cols_needed].copy(), target)
    if len(df_feat) < MIN_HISTORY_HOURS // 2:
        return []

    lag_cols = [c for c in df_feat.columns if c.startswith(f'{target}_')]
    feature_cols = _FEATURE_BASE + lag_cols

    model = XGBRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.08, subsample=0.8,
        colsample_bytree=0.8, random_state=42, verbosity=0, n_jobs=2,
    )
    model.fit(df_feat[feature_cols].values, df_feat[target].values)

    history = list(df_feat[target].values)
    last_ts = pd.Timestamp(df_feat['timestamp'].iloc[-1])
    lo, hi = _HARD_BOUNDS.get(target, (0.0, 1e9))
    preds = []
    for h in range(1, future_hours + 1):
        local_ts = last_ts + pd.Timedelta(hours=h) + IST_OFFSET
        feat = [local_ts.hour, local_ts.weekday(), local_ts.month, int(local_ts.weekday() >= 5)]
        for lag in [1, 2, 3, 6, 12, 24]:
            feat.append(history[len(history) - lag])
        for win in [3, 6, 12]:
            window = history[-win:]
            feat.append(float(np.mean(window)))
            feat.append(float(np.std(window)) if len(window) > 1 else 0.0)
        pred = float(np.clip(model.predict(np.array(feat).reshape(1, -1))[0], lo, hi))
        history.append(pred)
        preds.append(pred)
    return [round(v, 2) for v in preds]


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_xgb_forecast(
    location_doc: Dict,
    snapshots: List[Dict[str, Any]],
    meteo_forecast: List[Dict[str, Any]],
    hours_ahead: int = 24,
    min_history_hours: int = MIN_HISTORY_HOURS,
) -> List[Dict[str, Any]]:
    """Forecast pollutants for the next `hours_ahead` hours from real stored history.

    Returns [] when there is not enough history. Meteorological fields come from
    `meteo_forecast` (Open-Meteo); if it is empty they are left as None, never invented.
    """
    city = location_doc.get('city', 'Unknown')
    loc_name = location_doc.get('name', 'Unknown')

    hist = history_to_frame(snapshots)
    usable = hist.dropna(subset=POLLUTANTS, how='all')
    if len(usable) < min_history_hours:
        print(f"[forecast] {loc_name}: {len(usable)} h of history < {min_history_hours} h required; "
              f"no forecast produced.")
        return []

    poll_preds: Dict[str, List[float]] = {}
    for p in POLLUTANTS:
        if p in hist.columns and hist[p].notna().sum() >= min_history_hours:
            preds = _train_and_predict(hist, p, hours_ahead)
            if preds:
                poll_preds[p] = preds
    if not poll_preds:
        return []

    last_ts = pd.Timestamp(hist['timestamp'].iloc[-1]).to_pydatetime()
    forecasts = []
    for h in range(hours_ahead):
        ts = last_ts + datetime.timedelta(hours=h + 1)
        mf = meteo_forecast[h] if h < len(meteo_forecast) else {}
        forecasts.append({
            'city': city,
            'location': loc_name,
            'forecast_for': ts,
            'model_version': MODEL_VERSION,
            'trained_on_hours': int(len(usable)),
            'pollutants': {p: poll_preds[p][h] for p in poll_preds},
            'meteo': {k: mf.get(k) for k in
                      ('temperature', 'humidity', 'wind_speed', 'wind_direction',
                       'pressure', 'solar_radiation', 'rainfall')},
            'meteo_source': 'open-meteo forecast' if mf else None,
        })
    return forecasts
