import React, { useState } from 'react';
import {
    ComposedChart, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';

// ── Pollutant config ────────────────────────────────────────────────────────
const POLL_CONFIG = [
    { key: 'pm25', label: 'PM2.5', color: '#f97316', unit: 'µg/m³' },
    { key: 'pm10', label: 'PM10', color: '#eab308', unit: 'µg/m³' },
    { key: 'o3', label: 'O₃', color: '#06b6d4', unit: 'µg/m³' },
    { key: 'no2', label: 'NO₂', color: '#8b5cf6', unit: 'µg/m³' },
    { key: 'so2', label: 'SO₂', color: '#10b981', unit: 'µg/m³' },
    { key: 'co', label: 'CO', color: '#ef4444', unit: 'µg/m³' },
];

const METEO_CONFIG = [
    { key: 'temperature', label: 'Temp', color: '#f59e0b', unit: '°C' },
    { key: 'humidity', label: 'Humidity', color: '#3b82f6', unit: '%' },
    { key: 'solar_radiation', label: 'Solar', color: '#fde047', unit: 'W/m²' },
];

const MODES = [
    { id: 'pollutants', label: 'Pollutants' },
    { id: 'meteo', label: 'Weather' },
];

// ── Custom tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, configs }) => {
    if (!active || !payload?.length) return null;
    const isPastObj = payload[0].payload.isPast;
    const isNow = payload[0].payload.isNow;
    const isPast = isPastObj === true;
    const contextType = isNow ? '⏱️ NOW' : (isPast ? '📊 Actual' : '🔮 XGBoost');
    const colorTheme = isNow ? '#facc15' : (isPast ? '#4ade80' : '#60a5fa');
    const borderTheme = isNow ? 'rgba(250,204,21,0.3)' : (isPast ? 'rgba(100,200,100,0.3)' : 'rgba(100,150,255,0.3)');

    return (
        <div style={{
            background: 'rgba(10,15,30,0.97)',
            border: `1px solid ${borderTheme}`,
            borderRadius: '12px',
            padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            minWidth: '160px',
        }}>
            <div style={{
                fontSize: '11px', marginBottom: '5px', fontWeight: 700,
                color: colorTheme,
            }}>
                {contextType} · {label}
            </div>
            {payload.map((entry) => {
                // Strip pred_ prefix so config lookup always works
                const lookupKey = entry.dataKey.replace(/^pred_/, '');
                const cfg = configs.find(c => c.key === lookupKey);
                if (entry.value == null) return null;
                return (
                    <div key={entry.dataKey} style={{
                        display: 'flex', justifyContent: 'space-between',
                        gap: '12px', marginBottom: '3px', fontSize: '12px',
                    }}>
                        <span style={{ color: entry.color, fontWeight: 600 }}>
                            {cfg?.label ?? lookupKey}
                        </span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>
                            {Number(entry.value).toFixed(1)}{' '}
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
                                {cfg?.unit}
                            </span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ── Toggleable legend ───────────────────────────────────────────────────────
const CustomLegend = ({ configs, hidden, onToggle }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', justifyContent: 'center', marginTop: '8px' }}>
        {configs.map(cfg => (
            <button
                key={cfg.key}
                onClick={() => onToggle(cfg.key)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: hidden.has(cfg.key) ? 'transparent' : `${cfg.color}18`,
                    border: `1px solid ${hidden.has(cfg.key) ? 'rgba(255,255,255,0.1)' : cfg.color + '70'}`,
                    borderRadius: '20px', padding: '3px 10px',
                    cursor: 'pointer', transition: 'all 0.2s',
                    opacity: hidden.has(cfg.key) ? 0.35 : 1,
                }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
            </button>
        ))}
    </div>
);

// ── Main component ──────────────────────────────────────────────────────────
/**
 * ForecastCard
 *
 * Props
 *   history  – array of past aqi_snapshots (real DB values, exact measurements)
 *   forecast – array of XGBoost aqi_forecasts (pre-generated & stored in DB)
 *   title    – card heading
 */
const ForecastCard = ({ history = [], forecast = [], title = '24-Hour Forecast', style }) => {
    const [mode, setMode] = useState('pollutants');
    const [hidden, setHidden] = useState(new Set());

    const configs = mode === 'pollutants' ? POLL_CONFIG : METEO_CONFIG;

    const toggleLine = key => {
        setHidden(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    // ── Build unified chart data ───────────────────────────────────────────
    // Past: use exact real values from DB (aqi_snapshots)
    const pastRows = (history || []).map(snap => {
        const row = {
            time: new Date(snap.timestamp + (snap.timestamp.endsWith('Z') ? '' : 'Z')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isPast: true,
        };
        POLL_CONFIG.forEach(({ key }) => {
            row[key] = snap.pollutants_final?.[key] != null ? +Number(snap.pollutants_final[key]).toFixed(1) : null;
            row[`pred_${key}`] = null;
        });
        METEO_CONFIG.forEach(({ key }) => {
            const raw = key === 'temperature' ? snap.meteo?.temperature_2m
                : key === 'humidity' ? snap.meteo?.relative_humidity_2m
                    : key === 'solar_radiation' ? snap.meteo?.shortwave_radiation
                        : null;
            row[key] = raw != null ? +Number(raw).toFixed(1) : null;
            row[`pred_${key}`] = null;
        });
        return row;
    });

    // NOW: boundary marker — bridge the gap
    const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowRow = { time: nowLabel, isNow: true };
    if (pastRows.length > 0) {
        const last = pastRows[pastRows.length - 1];
        // Carry last actual over so lines connect smoothly at the NOW boundary
        POLL_CONFIG.forEach(({ key }) => {
            nowRow[key] = last[key];
            nowRow[`pred_${key}`] = last[key];
        });
        METEO_CONFIG.forEach(({ key }) => {
            nowRow[key] = last[key];
            nowRow[`pred_${key}`] = last[key];
        });
    }

    // Future: use XGBoost values from DB (aqi_forecasts)
    const futureRows = (forecast || []).map(f => {
        const row = { time: new Date(f.forecast_for + (f.forecast_for.endsWith('Z') ? '' : 'Z')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isPast: false };
        POLL_CONFIG.forEach(({ key }) => {
            row[key] = null;
            row[`pred_${key}`] = f.pollutants?.[key] != null ? +Number(f.pollutants[key]).toFixed(1) : null;
        });
        METEO_CONFIG.forEach(({ key }) => {
            row[key] = null;
            row[`pred_${key}`] = f.meteo?.[key] != null ? +Number(f.meteo[key]).toFixed(1) : null;
        });
        return row;
    });

    const chartData = [...pastRows, nowRow, ...futureRows];
    const hasForecast = futureRows.length > 0;
    const hasPast = pastRows.length > 0;

    // Keys for the active mode
    const pastKeys = configs.map(c => c.key);
    const predKeys = configs.map(c => `pred_${c.key}`);

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', ...style }}>

            {/* Header */}
            <div className="card-header" style={{
                marginBottom: '8px', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="card-title" style={{ fontSize: '14px', margin: 0 }}>{title}</h3>
                    {hasForecast && (
                        <span style={{
                            fontSize: '10px', fontWeight: 700,
                            background: 'rgba(99,102,241,0.18)', color: '#818cf8',
                            border: '1px solid rgba(99,102,241,0.4)',
                            borderRadius: '6px', padding: '2px 7px',
                        }}>XGBoost</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {MODES.map(m => (
                        <button
                            key={m.id}
                            onClick={() => { setMode(m.id); setHidden(new Set()); }}
                            style={{
                                background: mode === m.id ? 'var(--accent-blue, #3b82f6)' : 'rgba(255,255,255,0.06)',
                                color: mode === m.id ? '#fff' : 'var(--text-secondary)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px', padding: '3px 11px',
                                fontSize: '11px', cursor: 'pointer',
                                fontWeight: mode === m.id ? 600 : 400,
                                transition: '0.2s',
                            }}>
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Legend labels */}
            <div style={{ display: 'flex', gap: '14px', fontSize: '10px', marginBottom: '4px', paddingLeft: '4px' }}>
                <span style={{ color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ display: 'inline-block', width: '16px', borderBottom: '2px solid #4ade80', marginBottom: '1px' }} />
                    Actual (past)
                </span>
                <span style={{ color: '#60a5fa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ display: 'inline-block', width: '16px', borderBottom: '2px dashed #60a5fa', marginBottom: '1px' }} />
                    XGBoost (forecast)
                </span>
            </div>

            {/* Chart */}
            <div style={{ flex: 1, minHeight: '160px', width: '100%' }}>
                {(!hasPast && !hasForecast) ? (
                    <div style={{
                        height: '100%', display: 'flex', justifyContent: 'center',
                        alignItems: 'center', color: 'var(--text-secondary)',
                    }}>
                        <p style={{ fontSize: '13px', opacity: 0.7, textAlign: 'center' }}>
                            Forecast will appear here once the worker runs.
                        </p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={chartData}
                            margin={{ top: 8, right: 8, left: -28, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                            <XAxis
                                dataKey="time"
                                axisLine={false} tickLine={false}
                                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                axisLine={false} tickLine={false}
                                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                                width={36}
                            />
                            <Tooltip
                                content={<CustomTooltip configs={configs} />}
                                cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
                            />

                            {/* NOW reference line */}
                            <ReferenceLine
                                x={nowLabel}
                                stroke="rgba(255,255,255,0.35)"
                                strokeDasharray="4 2"
                                label={{ value: 'NOW', position: 'top', fill: 'rgba(255,255,255,0.45)', fontSize: 9 }}
                            />

                            {/* Past solid lines (real measurements) */}
                            {configs.map(cfg =>
                                !hidden.has(cfg.key) && (
                                    <Line
                                        key={cfg.key}
                                        type="monotone"
                                        dataKey={cfg.key}
                                        stroke={cfg.color}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                        connectNulls
                                        legendType="none"
                                    />
                                )
                            )}

                            {/* Future dashed lines (XGBoost predictions) */}
                            {hasForecast && configs.map(cfg =>
                                !hidden.has(cfg.key) && (
                                    <Line
                                        key={`pred_${cfg.key}`}
                                        type="monotone"
                                        dataKey={`pred_${cfg.key}`}
                                        stroke={cfg.color}
                                        strokeWidth={2}
                                        strokeDasharray="5 3"
                                        dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                        connectNulls
                                        legendType="none"
                                    />
                                )
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Toggleable legend */}
            <CustomLegend configs={configs} hidden={hidden} onToggle={toggleLine} />
        </div>
    );
};

export default ForecastCard;
