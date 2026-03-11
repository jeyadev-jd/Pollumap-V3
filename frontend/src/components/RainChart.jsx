import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FiMoreVertical } from 'react-icons/fi';

const data = [
    { name: 'Sun', value: 60 },
    { name: 'Mon', value: 40 },
    { name: 'Tue', value: 70 },
    { name: 'Wed', value: 60 },
    { name: 'Thu', value: 80 },
    { name: 'Fri', value: 30 },
    { name: 'Sat', value: 50 },
];

const RainChart = ({ rainfall, style }) => {
    // Update the 'Sun' value dynamically for today based on rainfall
    const chartData = [...data];
    const todayRain = Array.isArray(rainfall) ? rainfall.reduce((sum, r) => sum + r.amount, 0) : (rainfall || 0);
    chartData[0] = { ...data[0], value: Math.min(100, todayRain + 40) }; // Avoid mutating global object

    return (
        <div className="card" style={{ height: '320px', display: 'flex', flexDirection: 'column', ...style }}>
            <div className="card-header">
                <h3 className="card-title">Chance Of Rain</h3>
                <div className="card-actions">
                    <FiMoreVertical />
                </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <div>Cloudy: 0–30%</div>
                <div>Rain: 60–80%</div>
                <div>Heavy rain: 80–100%</div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={15} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={'#00f2fe'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default RainChart;
