import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

const PollutantRadar = ({ pollutants, aqi, style }) => {
    // Determine the color glow based on AQI
    let glowColor = '#3b82f6'; // Default Good
    if (aqi > 50) glowColor = '#eab308'; // Moderate
    if (aqi > 100) glowColor = '#f97316'; // Unhealthy for Sensitive Groups
    if (aqi > 150) glowColor = '#ef4444'; // Unhealthy
    if (aqi > 200) glowColor = '#a855f7'; // Very Unhealthy
    if (aqi > 300) glowColor = '#7f1d1d'; // Hazardous

    // Normalize values somewhat for the radar chart to look balanced (0-100 scale ideally)
    const data = [
        { subject: 'PM2.5', A: pollutants?.pm25 || 0, fullMark: 150 },
        { subject: 'PM10', A: pollutants?.pm10 || 0, fullMark: 200 },
        { subject: 'O3', A: pollutants?.o3 || 0, fullMark: 100 },
        { subject: 'NO2', A: pollutants?.no2 || 0, fullMark: 100 },
        { subject: 'SO2', A: pollutants?.so2 || 0, fullMark: 100 },
        { subject: 'CO', A: pollutants?.co || 0, fullMark: 10 },
        { subject: 'VOC', A: pollutants?.voc || 0, fullMark: 200 },
    ];

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '10px 15px', borderRadius: '8px', border: `1px solid ${glowColor}`, color: '#fff', fontSize: '12px' }}>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>{payload[0].payload.subject}</p>
                    <p style={{ margin: 0, color: glowColor }}>Level: {payload[0].value.toFixed(1)}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', ...style }}>
            <div className="card-header" style={{ marginBottom: '5px' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    Pollutant Balance
                    <span style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: `${glowColor}20`,
                        color: glowColor,
                        border: `1px solid ${glowColor}40`
                    }}>AQI: {aqi || 0}</span>
                </h3>
            </div>

            <div style={{ flex: 1, position: 'relative', minHeight: '250px', width: '100%' }}>
                {/* Subtle background glow effect behind the radar */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${glowColor}40 0%, transparent 70%)`,
                    pointerEvents: 'none',
                    filter: 'blur(20px)'
                }} />

                <div style={{ position: 'absolute', inset: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
                            <PolarGrid stroke="rgba(255,255,255,0.1)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Radar
                                name="Pollutants"
                                dataKey="A"
                                stroke={glowColor}
                                strokeWidth={2}
                                fill={glowColor}
                                fillOpacity={0.4}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default PollutantRadar;
