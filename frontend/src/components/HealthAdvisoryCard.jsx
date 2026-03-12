import React, { useState, useEffect } from 'react';
import { Activity, HeartPulse, ShieldAlert, CheckCircle, Sparkles, Loader2 } from 'lucide-react';

const HealthAdvisoryCard = ({ aqi, pollutants, style, city, location }) => {

    const [insight, setInsight] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!city || !location) return;

        const fetchInsight = async () => {
            setLoading(true);
            try {
                // Fetch the AI insight automatically on component mount or location change
                const res = await fetch(`http://localhost:8000/api/insights/generate?city=${city}&location=${location}`, {
                    method: 'POST'
                });
                if (res.ok) {
                    const data = await res.json();
                    setInsight(data.insight);
                }
            } catch (error) {
                console.error("Failed to fetch AI insights:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchInsight();
    }, [city, location, aqi]);

    // Simple logic based on AQI and PM2.5/NO2
    const riskLevel = aqi > 150 ? "High Risk" : aqi > 100 ? "Active Monitor" : "Good";
    const color = aqi > 150 ? "#ef4444" : aqi > 100 ? "#f59e0b" : "#10b981";

    // WHO Guidelines
    // PM2.5: 15 µg/m³ 24h mean
    // PM10: 45 µg/m³ 24h mean
    // NO2: 25 µg/m³ 24h mean 

    const ratios = {
        pm25: (pollutants?.pm25 / 15)?.toFixed(1) || 0,
        no2: (pollutants?.no2 / 25)?.toFixed(1) || 0
    };

    return (
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', ...style, background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(59, 130, 246, 0.05) 100%)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
            <div className="card-header" style={{ marginBottom: '15px', borderBottom: '1px solid var(--bg-body)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundImage: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>
                    <Sparkles size={18} color="#8b5cf6" /> AI Health Assistant
                </h3>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', paddingRight: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '12px', borderRadius: '50%', background: `${color}15`, color: color }}>
                        {aqi > 150 ? <HeartPulse size={24} /> : aqi > 100 ? <Activity size={24} /> : <CheckCircle size={24} />}
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Current Risk Level</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: color }}>{riskLevel}</div>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-body)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>Compliance Analysis</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>PM2.5 Excess:</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: ratios.pm25 > 1 ? '#ef4444' : '#10b981', background: ratios.pm25 > 1 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                                {ratios.pm25}x Base Limit
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>NO2 Exposure:</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: ratios.no2 > 1 ? '#f59e0b' : '#10b981', background: ratios.no2 > 1 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                                {ratios.no2}x Limit
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', padding: '15px', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '15px', background: '#3b82f6', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <Sparkles size={10} /> SYNTHESIZED INSIGHT
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0', color: 'var(--text-secondary)' }}>
                            <Loader2 className="spin" size={24} style={{ marginBottom: '10px', color: '#8b5cf6' }} />
                            <span style={{ fontSize: '12px' }}>Analyzing vast environmental datapoints...</span>
                        </div>
                    ) : insight ? (
                        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '15px', textAlign: 'justify' }}>
                                {insight.summary}
                            </p>

                            {insight.recommendations && insight.recommendations.length > 0 && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Recommended Actions</div>
                                    <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                        {insight.recommendations.map((rec, i) => (
                                            <li key={i} style={{ marginBottom: '4px' }}>{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                    Confidence: {(insight.confidence * 100).toFixed(0)}%
                                </div>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%' }}>
                                    {insight.key_drivers?.map((driver, idx) => (
                                        <span key={idx} style={{ fontSize: '9px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                            {driver}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
                            No recent data available to synthesize insights.
                        </div>
                    )}
                </div>
            </div>
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default HealthAdvisoryCard;
