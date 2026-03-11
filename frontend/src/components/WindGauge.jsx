import React from 'react';

const WindGauge = ({ windSpeed = 0, windDir = 0, style }) => {
    const cx = 60, cy = 60, r = 52;

    // Generate tick marks every 30°; longer at cardinals, medium at intercardinals
    const ticks = Array.from({ length: 12 }, (_, i) => {
        const deg = i * 30;
        const isCardinal = deg % 90 === 0;
        const isIntercardinal = deg % 45 === 0 && !isCardinal;
        const rad = (deg - 90) * (Math.PI / 180);
        const outerX = cx + r * Math.cos(rad);
        const outerY = cy + r * Math.sin(rad);
        const innerLen = isCardinal ? 10 : isIntercardinal ? 7 : 4;
        const innerR = r - innerLen;
        const innerX = cx + innerR * Math.cos(rad);
        const innerY = cy + innerR * Math.sin(rad);
        return { outerX, outerY, innerX, innerY, isCardinal, isIntercardinal };
    });

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', ...style }}>
            <h3 className="card-title">Wind speed</h3>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: '5px', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span style={{ fontSize: '42px', fontWeight: 700, lineHeight: 1 }}>{windSpeed.toFixed(1)}</span>
                        <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-secondary)' }}>km/h</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <span style={{ color: 'var(--accent-success)', fontSize: '13px', fontWeight: 600 }}>↗ 2.3%</span>
                        <span className="text-muted" style={{ fontSize: '12px' }}>VS 1 hour ago</span>
                    </div>
                </div>

                {/* Premium SVG Compass */}
                <div style={{ flexShrink: 0, marginTop: '5px', position: 'relative' }}>
                    <svg width="150" height="150" viewBox="0 0 120 120" overflow="visible">
                        <defs>
                            <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0.1" />
                            </linearGradient>
                            <linearGradient id="needle-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#60a5fa" />
                                <stop offset="100%" stopColor="#2563eb" />
                            </linearGradient>
                            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                            <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3" floodColor="#000" />
                            </filter>
                        </defs>

                        {/* Background subtle glow */}
                        <circle cx={cx} cy={cy} r={r - 8} fill="var(--accent-blue)" opacity="0.06" filter="url(#glow)" />

                        {/* Outer sleek ring */}
                        <circle
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke="url(#ring-grad)"
                            strokeWidth="2.5"
                            strokeDasharray="1 6"
                            strokeLinecap="round"
                        />

                        {/* Inner sleek ring */}
                        <circle
                            cx={cx} cy={cy} r={r - 12}
                            fill="none"
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1.5"
                        />

                        {/* Tick marks */}
                        {ticks.map((t, i) => (
                            <line
                                key={i}
                                x1={t.outerX} y1={t.outerY}
                                x2={t.innerX} y2={t.innerY}
                                stroke={t.isCardinal ? "var(--text-primary)" : "var(--text-secondary)"}
                                strokeOpacity={t.isCardinal ? 0.9 : t.isIntercardinal ? 0.5 : 0.2}
                                strokeWidth={t.isCardinal ? 2.5 : 1.5}
                                strokeLinecap="round"
                            />
                        ))}

                        {/* Cardinal labels — beautifully centered */}
                        <text x={cx} y={cy - r + 20} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="800" fill="var(--text-primary)" letterSpacing="1px">N</text>
                        <text x={cx} y={cy + r - 20} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="var(--text-secondary)">S</text>
                        <text x={cx - r + 20} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="var(--text-secondary)">W</text>
                        <text x={cx + r - 20} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="var(--text-secondary)">E</text>

                        {/* Rotating needle group */}
                        <g
                            transform={`rotate(${windDir}, ${cx}, ${cy})`}
                            style={{ transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                            filter="url(#drop-shadow)"
                        >
                            {/* North end dart */}
                            <polygon
                                points={`${cx - 5},${cy} ${cx + 5},${cy} ${cx},${cy - 38}`}
                                fill="url(#needle-grad)"
                            />
                            {/* South counterweight dart */}
                            <polygon
                                points={`${cx - 4},${cy} ${cx + 4},${cy} ${cx},${cy + 18}`}
                                fill="var(--text-secondary)"
                                opacity="0.4"
                            />
                            {/* Needle centerline highlight for 3D effect */}
                            <line x1={cx} y1={cy - 36} x2={cx} y2={cy} stroke="#fff" strokeWidth="1" opacity="0.5" />
                            <line x1={cx} y1={cy} x2={cx} y2={cy + 16} stroke="#000" strokeWidth="1" opacity="0.2" />
                        </g>

                        {/* Center pin glossy */}
                        <circle cx={cx} cy={cy} r={5} fill="var(--bg-card)" stroke="url(#needle-grad)" strokeWidth="2" filter="url(#drop-shadow)" />
                        <circle cx={cx} cy={cy} r={2} fill="#60a5fa" />
                    </svg>

                    {/* Speed readout badge */}
                    <div style={{
                        position: 'absolute',
                        bottom: '-10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px',
                        padding: '4px 12px',
                        boxShadow: 'var(--shadow-md)',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '3px'
                    }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>{(windSpeed / 3.6).toFixed(1)}</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>m/s</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WindGauge;
