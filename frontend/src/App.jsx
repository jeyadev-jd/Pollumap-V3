import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import IoTDashboard from './components/iot/IoTDashboard';
import CurrentWeatherCard from './components/CurrentWeatherCard';
import ForecastCard from './components/ForecastCard';
import WindGauge from './components/WindGauge';
import MapView from './components/MapView';
import AQIChart from './components/AQIChart';
import RainChart from './components/RainChart';
import PollutantRadar from './components/PollutantRadar';
import SourceApportionmentCard from './components/SourceApportionmentCard';
import FireInsightsCard from './components/FireInsightsCard';
import HealthAdvisoryCard from './components/HealthAdvisoryCard';
import { useCities, useLocations, useCurrentSnapshot, useForecast, useHistory } from './hooks/usePollumapAPI';
import { Sun, Thermometer, Car, Droplets } from 'lucide-react';

function App() {
  const [theme, setTheme] = useState('dark'); // Default to dark premium
  const [activeTab, setActiveTab] = useState('dashboard');

  // API Hooks
  const { cities } = useCities();
  const [selectedCity, setSelectedCity] = useState('Chennai');

  const { locations, isLoading: locLoading } = useLocations(selectedCity);
  const [selectedLocation, setSelectedLocation] = useState('');

  // Auto-select first location when locations load
  useEffect(() => {
    if (locations && locations.length > 0 && !selectedLocation) {
      setSelectedLocation(locations[0].name);
    }
  }, [locations, selectedLocation]);

  const { snapshot, isLoading: snapLoading } = useCurrentSnapshot(selectedCity, selectedLocation);
  const { forecast } = useForecast(selectedCity, selectedLocation, 24);
  const { history } = useHistory(selectedCity, selectedLocation, 6);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Ensure theme is set on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Derived Data Helpers
  const meteo = snapshot?.meteo || {};
  const pollutants = snapshot?.pollutants_final || {};
  const subIndices = snapshot?.sub_indices || {};

  // ── Heat Index (feels like) ──────────────────────────────────────────────
  // Prefer apparent_temperature from API; fallback to Steadman/Rothfusz formula
  const T_raw = meteo.temperature_2m ?? 30;
  const RH_raw = meteo.relative_humidity_2m ?? 60;

  const apparentTemp = (() => {
    if (meteo.apparent_temperature != null) return meteo.apparent_temperature;
    const T = T_raw, RH = RH_raw;
    // Rothfusz regression (NWS) — always gives a value distinct from T
    const HI = -8.78469475556
      + 1.61139411 * T
      + 2.33854883889 * RH
      - 0.14611605 * T * RH
      - 0.012308094 * T * T
      - 0.016424828 * RH * RH
      + 0.002211732 * T * T * RH
      + 0.00072546 * T * RH * RH
      - 0.000003582 * T * T * RH * RH;
    // If HI < T (cool/dry), use simple Steadman offset instead
    return HI > T ? HI : T + (RH - 40) * 0.05;
  })();

  // ── Solar Radiation (realistic estimate) ─────────────────────────────────
  // Use API value when available and non-zero; otherwise compute from time+weather
  const solarRadiation = (() => {
    const apiVal = meteo.shortwave_radiation;
    if (apiVal != null && apiVal > 0) return Math.round(apiVal);
    // Compute from time of day (IST = UTC+5:30)
    const nowIST = new Date(Date.now() + 5.5 * 3600 * 1000);
    const h = nowIST.getUTCHours() + nowIST.getUTCMinutes() / 60; // hour in IST
    // Sin bell curve: sunrise ~6h, solar noon ~12.5h, sunset ~18.5h
    const dayFrac = (h - 6) / 12.5;
    if (dayFrac <= 0 || dayFrac >= 1) return 0; // nighttime
    const elevFactor = Math.sin(dayFrac * Math.PI);         // 0→1→0
    const cloudFactor = 1 - Math.max(0, (RH_raw - 40)) / 150; // humidity ≈ cloud cover
    const tempBonus = Math.max(0, (T_raw - 20) / 20);       // hotter = clearer sky proxy
    const S_max = 950 + tempBonus * 80;                      // ~950–1030 W/m² at noon
    return Math.round(S_max * elevFactor * Math.max(0.3, cloudFactor));
  })();

  // forecastData kept for legacy; ForecastCard now receives raw forecast directly

  // Only block the HOME tab when loading — map and iot always render
  const isHomeLoading = (locLoading || snapLoading) && !snapshot;

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">
        <TopNav
          theme={theme}
          toggleTheme={toggleTheme}
          locations={locations?.map(l => l.name) || []}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
        />

        {isHomeLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div className="loader" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #3b82f6', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ marginLeft: '15px' }}>Syncing with Data Engine...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 30px 10px', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'dashboard' && (
              <div className="dashboard-grid">

                {/* Row 1: Weather, Radar, Source */}
                <div className="weather-section">
                  <CurrentWeatherCard
                    data={{
                      temperature: meteo.temperature_2m,
                      aqi: snapshot?.aqi,
                      location: selectedLocation,
                      description: snapshot?.aqi_category || "Moderate"
                    }}
                    style={{ height: '100%', minHeight: '340px' }}
                  />
                </div>
                <div className="radar-section">
                  <PollutantRadar pollutants={pollutants} aqi={snapshot?.aqi} style={{ height: '100%', minHeight: '340px' }} />
                </div>
                <div className="sources-section">
                  <SourceApportionmentCard sourcesData={snapshot?.sources} style={{ height: '100%', minHeight: '340px' }} />
                </div>

                {/* Row 2: Stats */}
                <div className="stats-section">
                  <div className="stats-grid" style={{ height: '100%', minHeight: '150px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                    <StatCard icon={<Sun size={20} />} label="Solar Radiation" value={`${solarRadiation} W/m²`} desc="Peak Sunlight" />
                    <StatCard icon={<Thermometer size={20} />} label="Feels like" value={`${apparentTemp.toFixed(0)}°`} desc="Heat Index" />
                    <StatCard icon={<Car size={20} />} label="Traffic Index" value={`${(meteo.traffic_index || 40).toFixed(0)}`} desc="Live Congestion Severity" />
                    <StatCard icon={<Droplets size={20} />} label="Humidity" value={`${(meteo.relative_humidity_2m || 65).toFixed(0)}%`} desc="Relative Humidity" />
                  </div>
                </div>

                {/* Row 3: Fire, Wind */}
                <div className="fire-tracker-section">
                  <FireInsightsCard selectedCity={selectedCity} sourcesData={snapshot?.sources} style={{ height: '100%', minHeight: '300px' }} />
                </div>
                <div className="wind-section">
                  <WindGauge windSpeed={meteo.wind_speed_10m} windDir={meteo.wind_direction_10m} style={{ height: '100%', minHeight: '300px' }} />
                </div>

                {/* Row 4: Health Analytics */}
                <div className="health-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '10px', marginBottom: '15px' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '2px' }}>Public Health Analytics</h2>
                    </div>
                  </div>
                  <HealthAdvisoryCard
                    city={selectedCity}
                    location={selectedLocation}
                    aqi={snapshot?.aqi}
                    pollutants={pollutants}
                    style={{ height: '100%', minHeight: '300px' }}
                  />
                </div>

                {/* Row 5: Charts */}
                <div className="bottom-chart-section">
                  <AQIChart
                    pollutants={pollutants}
                    subIndices={subIndices}
                    aqi={snapshot?.aqi}
                    aqi_category={snapshot?.aqi_category}
                    aqi_color={snapshot?.aqi_color}
                    style={{ height: '100%', minHeight: '320px' }}
                  />
                </div>
                <div className="bottom-chart-section">
                  <ForecastCard
                    history={history || []}
                    forecast={forecast || []}
                    title="24-Hour Forecast"
                    style={{ height: '100%', minHeight: '320px' }}
                  />
                </div>
                <div className="bottom-chart-section">
                  <RainChart rainfall={null} currentRain={meteo.rainfall} style={{ height: '100%', minHeight: '320px' }} />
                </div>

              </div>
            )}

            {activeTab === 'map' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div>
                    <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Exposure-Aware Routing</h2>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Find the cleanest paths across the city to minimize pollutant inhalation.</div>
                  </div>
                </div>
                <div style={{ flex: 1, position: 'relative', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', minHeight: '600px' }}>
                  <MapView center={[snapshot?.lat || 13.08, snapshot?.lon || 80.27]} cityLocations={locations} selectedLocation={selectedLocation} onLocationSelect={setSelectedLocation} isFullScreen={true} />
                </div>
              </div>
            )}

            {activeTab === 'iot' && <IoTDashboard />}
          </div>
        )}
      </div>
      <style>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div >
  );
}

const StatCard = ({ icon, label, value, desc }) => (
  <div className="info-stat-card">
    <div className="stat-icon" style={{ color: 'var(--text-secondary)' }}>{icon}</div>
    <div className="stat-info">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: '18px' }}>{value}</div>
      <div className="desc">{desc}</div>
    </div>
  </div>
);

export default App;
