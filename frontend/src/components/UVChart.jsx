import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FiMoreVertical } from 'react-icons/fi';

const data = [
    { name: 'Sun', value: 8 },
    { name: 'Mon', value: 4 },
    { name: 'Tue', value: 6 },
    { name: 'Wed', value: 9 },
    { name: 'Thu', value: 10 },
    { name: 'Fri', value: 6 },
    { name: 'Sat', value: 2 },
];

const UVChart = ({ uvIndex }) => {
    const chartData = [...data];
    const todayUV = Array.isArray(uvIndex) ? Math.max(...uvIndex.map(u => u.uv)) : (uvIndex || 8);
    chartData[0] = { ...data[0], value: todayUV }; // Update today

    return (
        <div className="card" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
                <h3 className="card-title">Ultraviolet Index</h3>
                <div className="card-actions">
                    <FiMoreVertical />
                </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div> Low
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></div> Moderate
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div> High
                </div>
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
                            {chartData.map((entry, index) => {
                                const color = entry.value <= 4 ? '#10b981' : entry.value <= 7 ? '#f59e0b' : '#ef4444';
                                // Gradients aren't fully supported via simple fill without SVG defs in recharts, 
                                // so we use solid colors representing the zones.
                                return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default UVChart;
