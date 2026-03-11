import React, { useEffect, useState } from 'react';
import { Flame, AlertTriangle, Wind, Zap } from 'lucide-react';

const API = 'http://localhost:8000/api';

const FireInsightsCard = ({ selectedCity, sourcesData, style }) => {
    const [fires, setFires] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedCity) return;
        setLoading(true);
        fetch(`${API}/fires?city=${selectedCity}`)
            .then(res => res.json())
            .then(data => {
                setFires(data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load fires", err);
                setLoading(false);
            });
    }, [selectedCity]);

    // Calculate direct fire impact on pollutants in current location
    const firePM25 = sourcesData?.pm25?.fire || 0;
    const fireCO = sourcesData?.co?.fire || 0;
    const firePM10 = sourcesData?.pm10?.fire || 0;
    const fireNO2 = sourcesData?.no2?.fire || 0;
    const fireSO2 = sourcesData?.so2?.fire || 0;

    const isActive = fires.length > 0;

    return (
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', ...style, border: isActive ? '1px solid rgba(239,68,68,0.3)' : undefined }}>
            <div className="card-header" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isActive ? '#ef4444' : 'inherit' }}>
                    <Flame size={18} /> NASA FIRMS Intelligence
                </h3>
            </div>

            {loading ? (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Scanning satellite data...</span>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-body)', padding: '12px', borderRadius: '12px' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Regional Thermal Anomalies</div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: isActive ? '#ef4444' : '#10b981' }}>
                                {fires.length} {fires.length > 0 ? 'Detected' : 'Clear'}
                            </div>
                        </div>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isActive ? <AlertTriangle color="#ef4444" size={20} /> : <Zap color="#10b981" size={20} />}
                        </div>
                    </div>

                    <div style={{ padding: '12px', background: isActive ? 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.02) 100%)' : 'var(--bg-body)', borderRadius: '12px', border: isActive ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                            <Wind size={14} /> Direct Combustion Impact on Location
                        </div>
                        {isActive ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>PM2.5</span>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: firePM25 > 5 ? '#ef4444' : '#f59e0b' }}>{firePM25} µg/m³</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>PM10</span>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: firePM10 > 10 ? '#ef4444' : '#f59e0b' }}>{firePM10} µg/m³</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Carbon Monoxide</span>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b' }}>{fireCO} µg/m³</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Nitrogen Dioxide</span>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b' }}>{fireNO2} µg/m³</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Sulfur Dioxide</span>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b' }}>{fireSO2} µg/m³</span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                No cross-wind pollutant transmission detected from fires at this moment.
                            </div>
                        )}
                        {isActive && (
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '12px', fontStyle: 'italic', borderTop: '1px solid rgba(239,68,68,0.1)', paddingTop: '8px' }}>
                                * Airborne impact dynamically scaled via vector alignment.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FireInsightsCard;
