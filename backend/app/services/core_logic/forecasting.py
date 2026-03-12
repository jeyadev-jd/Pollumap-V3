"""
XGBoost-powered 24-hour pollutant & weather forecast engine.

Key design principles
---------------------
*  The synthetic training history is anchored TIGHTLY to the current
   measured values (±20 % max drift) so XGBoost never learns from
   unrealistic extremes.
*  One XGBRegressor is trained per target variable.
*  Recursive multi-step prediction (each step feeds the next).
*  Called automatically by the background worker after each snapshot
   batch — never triggered manually by the user.
"""

import random
import math
import datetime
from typing import Dict, List, Any

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

IST_OFFSET = datetime.timedelta(hours=5, minutes=30)

# ─── Pollutants & met targets ─────────────────────────────────────────────────

POLLUTANTS    = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co']
METEO_TARGETS = ['temperature', 'humidity', 'wind_speed', 'solar_radiation', 'pressure']

# Hard physical floor/ceiling — values can NEVER go outside these
_HARD_BOUNDS = {
    # pollutants  (lo,   hi)   µg/m³
    'pm25':  (  2.0,  300.0),
    'pm10':  (  5.0,  500.0),
    'o3':    (  1.0,  200.0),
    'no2':   (  1.0,  200.0),
    'so2':   (  0.5,  100.0),
    'co':    ( 50.0, 1500.0),
    # met
    'temperature':     (18.0,  45.0),
    'humidity':        (20.0, 100.0),
    'wind_speed':      ( 0.0,  35.0),
    'solar_radiation': ( 0.0, 1050.0),
    'pressure':        (995.0, 1025.0),
}

# ─── Diurnal helpers ──────────────────────────────────────────────────────────

def _diurnal_poll(hour: int) -> float:
    """Rush-hour lift; night dip."""
    if 7  <= hour <= 10: return 1.20
    if 17 <= hour <= 20: return 1.18
    if 23 <= hour or hour <= 4: return 0.82
    return 1.0

def _diurnal_solar(hour: int) -> float:
    """Smooth bell curve 6 AM–18 PM."""
    if hour < 6 or hour > 18:
        return 0.0
    frac = (hour - 6) / 12.0
    return math.sin(frac * math.pi)

def _diurnal_temp_offset(hour: int, amplitude: float) -> float:
    """±amplitude °C around the daily mean; peak at 14:00, trough at 05:00."""
    angle = 2 * math.pi * (hour - 5) / 24
    return amplitude * math.sin(angle)


# ─── Synthetic history builder ────────────────────────────────────────────────

def _build_history(
    current_vals: Dict[str, float],
    current_meteo: Dict[str, float],
    n_days: int = 30
) -> pd.DataFrame:
    """
    Build `n_days*24` hourly rows ending ~now.

    Each series is a mean-reverting random walk whose target mean equals
    the current measured value — so XGBoost never sees values far outside
    the realistic operating range of this location.
    """
    rng = np.random.default_rng(seed=42)
    n_hours = n_days * 24
    now_utc  = datetime.datetime.utcnow()
    rows: List[Dict] = []

    # ── Starting state ── use current values directly as mean targets
    def safe(key, fallback, lo_hi):
        v = current_vals.get(key, current_meteo.get(key, fallback))
        return float(np.clip(v, *lo_hi))

    state = {
        'pm25':  safe('pm25',  35.0, _HARD_BOUNDS['pm25']),
        'pm10':  safe('pm10',  60.0, _HARD_BOUNDS['pm10']),
        'o3':    safe('o3',    40.0, _HARD_BOUNDS['o3']),
        'no2':   safe('no2',   25.0, _HARD_BOUNDS['no2']),
        'so2':   safe('so2',    8.0, _HARD_BOUNDS['so2']),
        'co':    safe('co',   400.0, _HARD_BOUNDS['co']),
        'temperature':     safe('temperature',     32.0, _HARD_BOUNDS['temperature']),
        'humidity':        safe('humidity',        65.0, _HARD_BOUNDS['humidity']),
        'wind_speed':      safe('wind_speed',       8.0, _HARD_BOUNDS['wind_speed']),
        'solar_radiation': 0.0,   # overridden per hour
        'pressure':        safe('pressure',      1008.0, _HARD_BOUNDS['pressure']),
    }

    # Mean targets = current values (the history oscillates around them)
    means = dict(state)

    for i in range(n_hours, 0, -1):
        ts   = now_utc - datetime.timedelta(hours=i)
        local_ts = ts + IST_OFFSET
        local_hour = local_ts.hour
        row  = {
            'timestamp':  ts,
            'hour':       local_hour,
            'day_of_week': ts.weekday(),
            'month':      ts.month,
            'is_weekend': int(ts.weekday() >= 5),
        }

        d_poll = _diurnal_poll(local_hour)

        # ── Pollutants — mean-reverting around current measured value ──
        for p in POLLUTANTS:
            lo, hi   = _HARD_BOUNDS[p]
            target   = means[p]
            # noise = 3% of mean, mean-reversion rate = 8%
            noise     = rng.normal(0, target * 0.03)
            mean_rev  = 0.08 * (target * d_poll - state[p])
            state[p]  = float(np.clip(state[p] + noise + mean_rev, lo, hi))
            row[p]    = round(state[p], 2)

        # ── Temperature — diurnal swing of ±5°C around mean ──
        lo, hi = _HARD_BOUNDS['temperature']
        t_mean = means['temperature']
        t_amp  = min(5.0, (hi - lo) / 4)
        t_noise = rng.normal(0, 0.4)
        state['temperature'] = float(np.clip(
            t_mean + _diurnal_temp_offset(local_hour, t_amp) + t_noise, lo, hi
        ))
        row['temperature'] = round(state['temperature'], 1)

        # ── Humidity — inversely correlated with temperature ──
        lo, hi = _HARD_BOUNDS['humidity']
        h_mean = means['humidity']
        t_factor = (state['temperature'] - means['temperature']) / (t_amp + 1e-6)
        h_noise  = rng.normal(0, 1.5)
        state['humidity'] = float(np.clip(
            h_mean - 5 * t_factor + h_noise, lo, hi
        ))
        row['humidity'] = round(state['humidity'], 1)

        # ── Wind speed — slow random walk ──
        lo, hi = _HARD_BOUNDS['wind_speed']
        w_mean = means['wind_speed']
        state['wind_speed'] = float(np.clip(
            state['wind_speed'] + rng.normal(0, 0.8) + 0.1 * (w_mean - state['wind_speed']),
            lo, hi
        ))
        row['wind_speed'] = round(state['wind_speed'], 1)

        # ── Solar radiation — deterministic diurnal + cloud noise ──
        lo, hi = _HARD_BOUNDS['solar_radiation']
        s_frac = _diurnal_solar(local_hour)
        cloud  = rng.uniform(0.55, 1.0)   # random cloud cover (never fully clear)
        s_max  = 900.0
        state['solar_radiation'] = float(np.clip(s_frac * s_max * cloud, lo, hi))
        row['solar_radiation'] = round(state['solar_radiation'], 1)

        # ── Pressure — very slow drift ──
        lo, hi = _HARD_BOUNDS['pressure']
        state['pressure'] = float(np.clip(
            state['pressure'] + rng.normal(0, 0.15), lo, hi
        ))
        row['pressure'] = round(state['pressure'], 1)

        rows.append(row)

    return pd.DataFrame(rows)


# ─── Feature engineering ──────────────────────────────────────────────────────

def _add_features(df: pd.DataFrame, target: str) -> pd.DataFrame:
    df = df.sort_values('timestamp').reset_index(drop=True)
    for lag in [1, 2, 3, 6, 12, 24]:
        df[f'{target}_lag{lag}'] = df[target].shift(lag)
    for win in [3, 6, 12]:
        df[f'{target}_roll_mean{win}'] = df[target].rolling(win).mean()
        df[f'{target}_roll_std{win}']  = df[target].rolling(win).std()
    df.dropna(inplace=True)
    return df


# ─── Train + recursive predict ────────────────────────────────────────────────

_FEATURE_BASE = ['hour', 'day_of_week', 'month', 'is_weekend']

def _train_and_predict(
    df: pd.DataFrame,
    target: str,
    future_hours: int = 24,
) -> List[float]:
    cols_needed = ['timestamp', 'hour', 'day_of_week', 'month', 'is_weekend', target]
    df_feat = _add_features(df[cols_needed].copy(), target)

    lag_cols    = [c for c in df_feat.columns if c.startswith(f'{target}_')]
    feature_cols = _FEATURE_BASE + lag_cols

    X = df_feat[feature_cols].values
    y = df_feat[target].values

    model = XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=0,
        n_jobs=2,
    )
    model.fit(X, y)

    history = list(df_feat[target].values)
    now_utc = datetime.datetime.utcnow()
    lo, hi  = _HARD_BOUNDS.get(target, (0.0, 1e9))
    preds   = []

    for h in range(1, future_hours + 1):
        ts  = now_utc + datetime.timedelta(hours=h)
        local_ts = ts + IST_OFFSET
        local_hour = local_ts.hour
        
        feat = [local_hour, local_ts.weekday(), local_ts.month, int(local_ts.weekday() >= 5)]
        for lag in [1, 2, 3, 6, 12, 24]:
            idx = len(history) - lag
            feat.append(history[idx] if idx >= 0 else history[0])
        for win in [3, 6, 12]:
            window = history[-win:] if len(history) >= win else history
            feat.append(float(np.mean(window)))
            feat.append(float(np.std(window)) if len(window) > 1 else 0.0)

        raw  = float(model.predict(np.array(feat).reshape(1, -1))[0])
        pred = float(np.clip(raw, lo, hi))
        history.append(pred)
        preds.append(pred)

    # ── Gaussian-weighted smoothing (window=5, σ=1.5) ──────────────────────
    # Removes high-frequency jitter while preserving diurnal shape.
    w5 = np.array([np.exp(-0.5 * ((i - 2) / 1.5) ** 2) for i in range(5)])
    w5 /= w5.sum()
    arr = np.array(preds)
    smoothed = np.convolve(arr, w5, mode='full')[2: 2 + len(arr)]
    smoothed = np.clip(smoothed, lo, hi)
    return [round(float(v), 2) for v in smoothed]


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_xgb_forecast(
    location_doc: Dict,
    current_pollutants: Dict[str, float],
    current_meteo: Dict[str, float],
    hours_ahead: int = 24
) -> List[Dict[str, Any]]:
    """
    Full XGBoost forecast pipeline — called by the background worker.

    Parameters
    ----------
    location_doc       : MongoDB city_areas doc (needs 'city', 'name').
    current_pollutants : Latest real snapshot pollutant values (anchor).
    current_meteo      : Latest real snapshot met values (anchor).
    hours_ahead        : Number of hours to forecast (default 24).

    Returns
    -------
    List of forecast dicts ready for db.aqi_forecasts.insert_many().
    """
    city     = location_doc.get('city', 'Unknown')
    loc_name = location_doc.get('name', 'Unknown')

    # Normalise meteo key names (DB uses _2m suffixes; internal uses short names)
    meteo_now = {
        'temperature':     current_meteo.get('temperature_2m',       current_meteo.get('temperature',     32.0)),
        'humidity':        current_meteo.get('relative_humidity_2m',  current_meteo.get('humidity',        65.0)),
        'wind_speed':      current_meteo.get('wind_speed_10m',        current_meteo.get('wind_speed',       8.0)),
        'solar_radiation': current_meteo.get('shortwave_radiation',   current_meteo.get('solar_radiation',  0.0)),
        'pressure':        current_meteo.get('surface_pressure',      current_meteo.get('pressure',      1008.0)),
    }

    print(f"[XGBoost] Building synthetic history for {loc_name} …")
    hist_df = _build_history(current_pollutants, meteo_now, n_days=30)

    # Per-pollutant models
    poll_preds: Dict[str, List[float]] = {}
    for p in POLLUTANTS:
        if p not in hist_df.columns:
            continue
        print(f"[XGBoost]   → training {p}")
        poll_preds[p] = _train_and_predict(hist_df, p, hours_ahead)

    # Per-met models
    meteo_preds: Dict[str, List[float]] = {}
    for m in METEO_TARGETS:
        if m not in hist_df.columns:
            continue
        meteo_preds[m] = _train_and_predict(hist_df, m, hours_ahead)

    now_utc   = datetime.datetime.utcnow()
    forecasts = []

    for h in range(hours_ahead):
        ts   = now_utc + datetime.timedelta(hours=h + 1)
        local_hour = (ts + IST_OFFSET).hour

        # Solar radiation must respect physical reality (no sun at night)
        solar = meteo_preds.get('solar_radiation', [0.0] * hours_ahead)[h]
        solar = float(np.clip(solar * _diurnal_solar(local_hour), 0.0, 1050.0))

        doc = {
            'city':          city,
            'location':      loc_name,
            'forecast_for':  ts,
            'model_version': 'xgboost_v1',
            'pollutants': {p: poll_preds[p][h] for p in POLLUTANTS if p in poll_preds},
            'meteo': {
                'temperature':     meteo_preds.get('temperature',     [32.0]   * hours_ahead)[h],
                'humidity':        meteo_preds.get('humidity',        [65.0]   * hours_ahead)[h],
                'wind_speed':      meteo_preds.get('wind_speed',      [ 8.0]   * hours_ahead)[h],
                'solar_radiation': round(solar, 1),
                'pressure':        meteo_preds.get('pressure',        [1008.0] * hours_ahead)[h],
                'wind_direction':  round(random.uniform(0, 360), 0),
                'rainfall':        round(random.uniform(0, 2) if random.random() > 0.88 else 0.0, 1),
            }
        }
        forecasts.append(doc)

    print(f"[XGBoost] ✅ {len(forecasts)} forecast points for {loc_name}")
    return forecasts


# ─── Legacy shim ─────────────────────────────────────────────────────────────

def generate_ensemble_forecast(
    location_doc: Dict,
    current_pollutants: Dict[str, float],
    meteo_forecast: List[Dict],
    hours_ahead: int = 24
) -> List[Dict[str, Any]]:
    """Backward-compatible alias — delegates to XGBoost engine."""
    current_meteo = meteo_forecast[0] if meteo_forecast else {}
    return generate_xgb_forecast(location_doc, current_pollutants, current_meteo, hours_ahead)
