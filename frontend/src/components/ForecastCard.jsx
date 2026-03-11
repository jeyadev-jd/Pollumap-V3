import React, { useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

// ── Pollutant config ────────────────────────────────────────────────────────
const POLL_CONFIG = [
    { key: 'pm25', label: 'PM2.5', color: '#f97316', unit: 'µg/m³' },
    { key: 'pm10', label: 'PM10', color: '#eab308', unit: 'µg/m³' },
    { key: 'o3', label: 'O3', color: '#06b6d4', unit: 'µg/m³' },
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
    return (
        <div style={{
            background: 'rgba(10,15,30,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            minWidth: '150px',
        }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                {label}
            </div>
            {payload.map((entry) => {
                const cfg = configs.find(c => c.key === entry.dataKey);
                return (
                    <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '3px', fontSize: '12px' }}>
                        <span style={{ color: entry.color, fontWeight: 600 }}>{cfg?.label ?? entry.dataKey}</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>
                            {typeof entry.value === 'number' ? entry.value.toFixed(1) : '--'} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{cfg?.unit}</span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ── Custom legend ───────────────────────────────────────────────────────────
const CustomLegend = ({ configs, hidden, onToggle }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
        {configs.map(cfg => (
            <button
                key={cfg.key}
                onClick={() => onToggle(cfg.key)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: hidden.has(cfg.key) ? 'transparent' : `${cfg.color}18`,
                    border: `1px solid ${hidden.has(cfg.key) ? 'rgba(255,255,255,0.1)' : cfg.color + '60'}`,
                    borderRadius: '20px', padding: '3px 9px',
                    cursor: 'pointer', transition: 'all 0.2s',
                    opacity: hidden.has(cfg.key) ? 0.4 : 1,
                }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
            </button>
        ))}
    </div>
);

// ── Main component ──────────────────────────────────────────────────────────
const ForecastCard = ({ forecast, title = '24-Hour Forecast', style }) => {
    const [mode, setMode] = useState('pollutants');
    const [hidden, setHidden] = useState(new Set());

    const configs = mode === 'pollutants' ? POLL_CONFIG : METEO_CONFIG;

    const toggleLine = (key) => {
        setHidden(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    if (!forecast || forecast.length === 0) {
        return (
            <div className="card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', ...style }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading Projection Data...</p>
            </div>
        );
    }

    // Build chart data — one object per time point with all pollutant values
    const chartData = forecast.map(point => {
        const row = { time: point.day };
        POLL_CONFIG.forEach(({ key }) => {
            row[key] = point.pollutants?.[key] != null ? +Number(point.pollutants[key]).toFixed(1) : null;
        });
        // Forecast meteo uses flat keys: temperature, humidity, solar_radiation
        row['temperature'] = point.meteo?.temperature != null ? +Number(point.meteo.temperature).toFixed(1) : null;
        row['humidity'] = point.meteo?.humidity != null ? +Number(point.meteo.humidity).toFixed(1) : null;
        row['solar_radiation'] = point.meteo?.solar_radiation != null ? +Number(point.meteo.solar_radiation).toFixed(0) : null;
        return row;
    });

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', ...style }}>
            {/* Header */}
            <div className="card-header" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title" style={{ fontSize: '15px' }}>{title}</h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {MODES.map(m => (
                        <button
                            key={m.id}
                            onClick={() => { setMode(m.id); setHidden(new Set()); }}
                            style={{
                                background: mode === m.id ? 'var(--accent-blue, #3b82f6)' : 'rgba(255,255,255,0.06)',
                                color: mode === m.id ? '#fff' : 'var(--text-secondary)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px', padding: '4px 11px',
                                fontSize: '11px', cursor: 'pointer',
                                fontWeight: mode === m.id ? 600 : 400,
                                transition: '0.2s',
                            }}>
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            <div style={{ flex: 1, minHeight: '160px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                        <defs>
                            {configs.map(cfg => (
                                <linearGradient key={cfg.key} id={`grad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={cfg.color} stopOpacity={0.15} />
                                    <stop offset="100%" stopColor={cfg.color} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>
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
                        {configs.map(cfg => (
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
                                />
                            )
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Toggleable legend */}
            <CustomLegend configs={configs} hidden={hidden} onToggle={toggleLine} />
        </div>
    );
};

export default ForecastCard;
