import React from 'react';

const CurrentWeatherCard = ({ data, style }) => {
    if (!data) return <div className="current-weather-card" style={style}>Loading...</div>;

    return (
        <div className="current-weather-card" style={style}>
            <div className="weather-header">
                <div className="location-badge">
                    <span>📍</span> {data.location || 'Unknown'}
                </div>
                <div className="temp-toggle">
                    <span style={{ fontWeight: 600 }}>°C</span> | <span>°F</span>
                </div>
            </div>

            <div className="weather-main">
                <div className="weather-temp">{data.temperature?.toFixed(0)}°C</div>
                <div className="weather-desc">Sunny & Clear</div>
                <div className="weather-high-low">High: {Math.max((data.temperature || 30) + 2).toFixed(0)}° Low: {Math.max((data.temperature || 30) - 4).toFixed(0)}°</div>
            </div>
        </div>
    );
};

export default CurrentWeatherCard;
