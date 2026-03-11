import React from 'react';
import { Activity, HeartPulse, ShieldAlert, CheckCircle } from 'lucide-react';

const HealthAdvisoryCard = ({ aqi, pollutants, style }) => {

    // Simple logic based on AQI and PM2.5/NO2
    const riskLevel = aqi > 150 ? "High Risk" : aqi > 100 ? "Active Monitor" : "Good";
    const color = aqi > 150 ? "#ef4444" : aqi > 100 ? "#f59e0b" : "#10b981";

    // WHO Guidelines
    // PM2.5: 15 µg/m³ 24h mean
    // PM10: 45 µg/m³ 24h mean
    // NO2: 25 µg/m³ 24h mean 

    const ratios = {
        pm25: (pollutants?.pm25 / 15)?.toFixed(1) || 0,
        pm10: (pollutants?.pm10 / 45)?.toFixed(1) || 0,
        no2: (pollutants?.no2 / 25)?.toFixed(1) || 0
    };

    return (
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', ...style }}>
            <div className="card-header" style={{ marginBottom: '15px', borderBottom: '1px solid var(--bg-body)', paddingBottom: '10px' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={18} /> Public Health Advisory
                </h3>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '12px', borderRadius: '50%', background: `${color}15`, color: color }}>
                        {aqi > 150 ? <HeartPulse size={24} /> : aqi > 100 ? <Activity size={24} /> : <CheckCircle size={24} />}
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Current Risk Level</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: color }}>{riskLevel}</div>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-body)', padding: '15px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>WHO Target Comparisons</div>
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

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {aqi > 150 ?
                        "Mask up (N95) outdoors. Highly recommended to keep windows closed and run purifiers if available. Extremely risky for sensitive groups."
                        : aqi > 100 ?
                            "Avoid strenuous outdoor activities. Asthmatics and children should limit prolonged exertion in unventilated exterior zones."
                            :
                            "Air quality is satisfactory. It's a great time for outdoor exercise and opening windows for natural ventilation."
                    }
                </div>
            </div>
        </div>
    );
};

export default HealthAdvisoryCard;
