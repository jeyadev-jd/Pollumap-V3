import React, { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const SourceApportionmentCard = ({ sourcesData, style }) => {
    const [activePoll, setActivePoll] = useState('pm25');

    // Available pollutants in sourcesData
    const availablePolls = sourcesData ? Object.keys(sourcesData).filter(p => Object.keys(sourcesData[p]).length > 0) : ['pm25'];

    // Extract sources for the selected pollutant
    const activeSources = sourcesData?.[activePoll] || {};

    const hasData = Object.keys(activeSources).length > 0;

    const data = useMemo(() => {
        if (!hasData) {
            return [
                { name: 'Traffic', value: 45 },
                { name: 'Industrial', value: 25 },
                { name: 'Construction', value: 15 },
                { name: 'Other', value: 15 }
            ];
        }

        let formatted = [];
        for (const [key, val] of Object.entries(activeSources)) {
            if (val > 0) {
                // Prettify names
                const name = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                formatted.push({ name: name === 'Landfill Quarry Brownfield' ? 'Landfill/Quarry' : name, value: Number(val.toFixed(1)) });
            }
        }
        return formatted.sort((a, b) => b.value - a.value); // largest chunks first
    }, [activeSources, hasData]);

    const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#64748b'];

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            return (
                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '10px', borderRadius: '8px', border: `1px solid ${data.payload.fill}`, color: '#fff' }}>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>{data.name}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <span style={{ color: data.payload.fill, fontWeight: 'bold' }}>{data.value}</span> µg/m³
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', ...style }}>
            <div className="card-header" style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title" style={{ fontSize: '15px' }}>Indicative Emission Sources</h3>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {availablePolls.map(p => (
                        <button
                            key={p}
                            onClick={() => setActivePoll(p)}
                            style={{
                                background: activePoll === p ? 'var(--accent-color, #3b82f6)' : 'rgba(255,255,255,0.05)',
                                color: activePoll === p ? '#fff' : 'var(--text-secondary)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                padding: '3px 8px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                outline: 'none',
                                transition: '0.2s'
                            }}
                        >
                            {p.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative', minHeight: '250px', width: '100%' }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="45%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}
                                        style={{ filter: `drop-shadow(0px 0px 8px ${COLORS[index % COLORS.length]}60)` }} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                verticalAlign="bottom"
                                height={70}
                                content={(props) => {
                                    const { payload } = props;
                                    return (
                                        <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
                                            {payload.map((entry, index) => (
                                                <li key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color, marginRight: '4px', boxShadow: `0 0 5px ${entry.color}` }}></div>
                                                    {entry.value} ({data[index].value})
                                                </li>
                                            ))}
                                        </ul>
                                    );
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default SourceApportionmentCard;
