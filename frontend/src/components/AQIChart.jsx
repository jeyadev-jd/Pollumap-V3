import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { FiMoreVertical } from 'react-icons/fi';

// ── Indian NAQI breakpoints (mirrors backend) ──────────────────────────────
const NAQI_BP = {
    pm25: [[0, 30, 0, 50], [30, 60, 51, 100], [60, 90, 101, 200], [90, 120, 201, 300], [120, 250, 301, 400], [250, 500, 401, 500]],
    pm10: [[0, 50, 0, 50], [50, 100, 51, 100], [100, 250, 101, 200], [250, 350, 201, 300], [350, 430, 301, 400], [430, 600, 401, 500]],
    no2: [[0, 40, 0, 50], [40, 80, 51, 100], [80, 180, 101, 200], [180, 280, 201, 300], [280, 400, 301, 400], [400, 800, 401, 500]],
    so2: [[0, 40, 0, 50], [40, 80, 51, 100], [80, 380, 101, 200], [380, 800, 201, 300], [800, 1600, 301, 400], [1600, 2620, 401, 500]],
    o3: [[0, 50, 0, 50], [50, 100, 51, 100], [100, 168, 101, 200], [168, 208, 201, 300], [208, 748, 301, 400], [748, 1000, 401, 500]],
    co: [[0, 1000, 0, 50], [1000, 2000, 51, 100], [2000, 10000, 101, 200], [10000, 17000, 201, 300], [17000, 34000, 301, 400], [34000, 46000, 401, 500]],
};

function subIndex(pollutant, conc) {
    const bps = NAQI_BP[pollutant];
    if (!bps) return 0;
    for (const [bl, bh, il, ih] of bps) {
        if (conc >= bl && conc <= bh)
            return il + (ih - il) * (conc - bl) / (bh - bl);
    }
    return conc > bps[bps.length - 1][1] ? 500 : 0;
}

const NAQI_BANDS = [
    { max: 50, label: 'Good', color: '#00b050', bg: 'rgba(0,176,80,0.12)' },
    { max: 100, label: 'Satisfactory', color: '#92d050', bg: 'rgba(146,208,80,0.12)' },
    { max: 200, label: 'Moderate', color: '#ffcc00', bg: 'rgba(255,204,0,0.12)' },
    { max: 300, label: 'Poor', color: '#ff7e00', bg: 'rgba(255,126,0,0.12)' },
    { max: 400, label: 'Very Poor', color: '#ff0000', bg: 'rgba(255,0,0,0.12)' },
    { max: 500, label: 'Severe', color: '#9b30d0', bg: 'rgba(155,48,208,0.12)' },
];

function getBand(si) {
    return NAQI_BANDS.find(b => si <= b.max) || NAQI_BANDS[NAQI_BANDS.length - 1];
}

const POLL_UNITS = {
    pm25: 'µg/m³', pm10: 'µg/m³', o3: 'µg/m³',
    no2: 'µg/m³', so2: 'µg/m³', co: 'µg/m³',
};

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const band = getBand(d.si);
    return (
        <div style={{
            background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            minWidth: '140px'
        }}>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{d.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Conc: <b style={{ color: 'var(--text-primary)' }}>{d.conc?.toFixed(1)} {d.unit}</b>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Sub-index: <b style={{ color: band.color }}>{d.si?.toFixed(0)}</b>
            </div>
            <div style={{
                marginTop: '6px', fontSize: '11px', fontWeight: 600,
                padding: '2px 8px', borderRadius: '20px',
                background: band.bg, color: band.color, display: 'inline-block'
            }}>{band.label}</div>
        </div>
    );
};

const AQIChart = ({ pollutants, subIndices, aqi, aqi_category, aqi_color, style }) => {
    const DISPLAY = [
        { key: 'pm25', name: 'PM2.5' },
        { key: 'pm10', name: 'PM10' },
        { key: 'o3', name: 'O3' },
        { key: 'no2', name: 'NO2' },
        { key: 'so2', name: 'SO2' },
        { key: 'co', name: 'CO' },
    ];

    const data = DISPLAY.map(({ key, name }) => {
        const conc = pollutants?.[key] || 0;
        const si = subIndices?.[key] ?? subIndex(key, conc);
        return { name, key, conc, si, unit: POLL_UNITS[key] };
    });

    const dominantBand = getBand(aqi || 0);

    return (
        <div className="card" style={{ height: '320px', display: 'flex', flexDirection: 'column', ...style }}>
            <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 className="card-title">Air Quality Index</h3>
                    <span style={{
                        fontSize: '13px', fontWeight: 700,
                        padding: '2px 10px', borderRadius: '20px',
                        background: dominantBand.bg,
                        color: aqi_color || dominantBand.color,
                        border: `1px solid ${aqi_color || dominantBand.color}40`
                    }}>
                        {aqi ?? 0} — {aqi_category || dominantBand.label}
                    </span>
                </div>
                <div className="card-actions"><FiMoreVertical /></div>
            </div>

            {/* NAQI Legend */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {NAQI_BANDS.map(b => (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                        {b.label}
                    </div>
                ))}
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barSize={18} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
                        <XAxis
                            dataKey="name" axisLine={false} tickLine={false}
                            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                        />
                        <YAxis
                            domain={[0, 500]} axisLine={false} tickLine={false}
                            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                            ticks={[0, 100, 200, 300, 400, 500]}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Bar dataKey="si" radius={[6, 6, 6, 6]}>
                            {data.map((entry, idx) => {
                                const band = getBand(entry.si);
                                return (
                                    <Cell
                                        key={`cell-${idx}`}
                                        fill={band.color}
                                        fillOpacity={0.9}
                                    />
                                );
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4px', fontStyle: 'italic' }}>
                Sub-index per pollutant · Indian NAQI (CPCB)
            </div>
        </div>
    );
};

export default AQIChart;
