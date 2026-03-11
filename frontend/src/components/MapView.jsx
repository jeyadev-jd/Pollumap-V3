import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    MapContainer, TileLayer, Marker, Popup,
    useMap, ZoomControl, useMapEvents, Polyline
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
    Car, Bus, Footprints, Bike, Zap, Leaf, Scale,
    Map as MapIcon, MapPin, Clock, Wind, AlertCircle,
    ChevronDown, ChevronUp, BarChart2, Info, CircleDot, Activity, Motorbike, Flame
} from 'lucide-react';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API = 'http://localhost:8000/api';

const MODES = [
    { id: 'car', label: 'Car', icon: <Car size={18} />, color: '#3b82f6', speed: 35, ir: 0.012 },
    { id: 'bus', label: 'Bus', icon: <Bus size={18} />, color: '#8b5cf6', speed: 20, ir: 0.015 },
    { id: 'bike', label: 'Bike', icon: <Motorbike size={18} />, color: '#ec4899', speed: 40, ir: 0.025 },
    { id: 'walking', label: 'Walk', icon: <Footprints size={18} />, color: '#f59e0b', speed: 5, ir: 0.020 },
    { id: 'cycling', label: 'Cycle', icon: <Bike size={18} />, color: '#10b981', speed: 15, ir: 0.035 },
];

const ROUTE_TABS = [
    { id: 'cleanest', label: 'Cleanest', color: '#10b981', icon: <Leaf size={14} /> },
    { id: 'balanced', label: 'Balanced', color: '#f59e0b', icon: <Scale size={14} /> },
];

const formatDuration = (min) => {
    const num = Number(min);
    if (isNaN(num)) return `${min} min`;
    if (num < 60) return `${Math.round(num)} min`;
    const hrs = Math.floor(num / 60);
    const mins = Math.round(num % 60);
    return mins > 0 ? `${hrs}hr ${mins}min` : `${hrs}hr`;
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const MapUpdater = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, map.getZoom(), { duration: 1.2 });
    }, [center, map]);
    return null;
};

const AreaAutocomplete = ({ city, placeholder, value, onChange, onSelect, icon, color }) => {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const debounce = useRef(null);

    useEffect(() => { setQuery(value || ''); }, [value]);

    const search = useCallback((q) => {
        if (!q || q.length < 2) { setSuggestions([]); setOpen(false); return; }
        clearTimeout(debounce.current);
        debounce.current = setTimeout(async () => {
            try {
                const res = await fetch(`${API}/areas/search?city=${city}&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                setSuggestions(data || []);
                setOpen(true);
            } catch { setSuggestions([]); }
        }, 250);
    }, [city]);

    useEffect(() => { search(query); }, [query, search]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#f8fafc', borderRadius: 10,
                padding: '9px 12px', border: `1px solid ${open ? color : '#e2e8f0'}`,
                transition: 'border 0.2s'
            }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); onChange && onChange(e.target.value); }}
                    placeholder={placeholder}
                    style={{
                        background: 'transparent', border: 'none', color: '#1e293b',
                        outline: 'none', width: '100%', fontSize: 13, fontFamily: 'inherit'
                    }}
                />
                {query && (
                    <span
                        onClick={() => { setQuery(''); setSuggestions([]); setOpen(false); onChange && onChange(''); }}
                        style={{ cursor: 'pointer', color: '#64748b', fontSize: 16, lineHeight: 1 }}
                    >×</span>
                )}
            </div>
            {open && suggestions.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
                    background: '#ffffff', borderRadius: 10, marginTop: 4,
                    border: '1px solid #e2e8f0', maxHeight: 200, overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                }}>
                    {suggestions.map(s => (
                        <div
                            key={s.name}
                            onClick={() => {
                                setQuery(s.name); setOpen(false);
                                onSelect && onSelect(s);
                            }}
                            style={{
                                padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: '#334155',
                                borderBottom: '1px solid #f1f5f9',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span>{s.name}</span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>{s.lat?.toFixed(3)}, {s.lon?.toFixed(3)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ExposureBadge = ({ value, color }) => (
    <span style={{
        background: `${color}22`, color, fontWeight: 700, fontSize: 13,
        padding: '2px 8px', borderRadius: 6, border: `1px solid ${color}44`
    }}>{value} µg</span>
);

const RouteCard = ({ route, color, icon, label, isActive, onClick, modeIcon }) => {
    if (!route) return null;
    return (
        <div
            onClick={onClick}
            style={{
                padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                background: isActive ? `${color}18` : '#ffffff',
                border: `1px solid ${isActive ? color : '#e2e8f0'}`,
                transition: 'all 0.2s'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: isActive ? color : '#475569' }}>{label}</span>
                </div>
                <ExposureBadge value={route.exposure_ug} color={color} />
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {formatDuration(route.duration_min)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {route.distance_km} km</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Wind size={12} /> {route.mean_concentration} µg/m³</span>
            </div>
        </div>
    );
};

const ModeComparisonRow = ({ modeKey, data, isActive }) => {
    const mode = MODES.find(m => m.id === modeKey);
    if (!mode || !data) return null;
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            borderRadius: 8, background: isActive ? `${mode.color}15` : '#f8fafc',
            border: `1px solid ${isActive ? mode.color + '44' : '#e2e8f0'}`,
        }}>
            <span style={{ fontSize: 16, minWidth: 22, display: 'flex', justifyContent: 'center' }}>{mode.icon}</span>
            <span style={{ flex: 1, fontSize: 12, color: isActive ? mode.color : '#475569', fontWeight: isActive ? 700 : 400 }}>
                {mode.label}
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{formatDuration(data.duration_min)}</span>
            <span style={{
                fontSize: 11, fontWeight: 700, color: mode.color,
                background: `${mode.color}18`, padding: '2px 6px', borderRadius: 5
            }}>{data.exposure_ug} µg</span>
        </div>
    );
};

// ─── Main MapView ──────────────────────────────────────────────────────────────

const MapView = ({ center, isFullScreen = false, cityLocations = [], selectedLocation, onLocationSelect }) => {
    const [mode, setMode] = useState('car');
    const [activeTab, setActiveTab] = useState('fastest');
    const [startArea, setStartArea] = useState(null); // {name, lat, lon}
    const [endArea, setEndArea] = useState(null);
    const [rawRoutes, setRawRoutes] = useState(null);   // raw backend response
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showComparison, setShowComparison] = useState(false);
    const [fires, setFires] = useState([]);

    const city = 'Chennai';

    // Fetch fires
    useEffect(() => {
        fetch(`${API}/fires?city=${city}`)
            .then(res => res.json())
            .then(data => setFires(data || []))
            .catch(err => console.error("Failed to load NASA FIRMS fires", err));
    }, [city]);

    // ── Route helpers ─────────────────────────────────────────────────────────

    const getAdjustedRoute = (route, targetMode) => {
        if (!route) return null;
        const m = MODES.find(x => x.id === targetMode);
        if (!m || !route.distance_km) return route;

        const dur = (route.distance_km / m.speed) * 60;
        const exp = route.mean_concentration * m.ir * dur;

        return {
            ...route,
            mode: targetMode,
            mode_label: m.label,
            mode_icon: m.icon,
            duration_min: dur.toFixed(1),
            exposure_ug: exp.toFixed(2),
            inhalation_rate: m.ir,
        };
    };

    // For each mode change, recompute which route is "cleanest" (lowest total exposure E=C×IR×t)
    // and which is "balanced" (higher exposure). This ensures cleanest always has lowest E.
    const getDisplayRoutes = (raw, currentMode) => {
        if (!raw) return null;
        const candidates = ['fastest', 'cleanest', 'balanced']
            .map(key => raw[key] ? getAdjustedRoute(raw[key], currentMode) : null)
            .filter(Boolean);

        if (candidates.length < 2) return raw;

        // Sort by total exposure ascending; index 0 = cleanest, index 1 = balanced
        candidates.sort((a, b) => Number(a.exposure_ug) - Number(b.exposure_ug));

        return {
            ...raw,
            cleanest: candidates[0],
            balanced: candidates[1],
        };
    };

    // routes = display-ready routes, recalculated whenever mode or rawRoutes changes
    const routes = getDisplayRoutes(rawRoutes, mode);
    const activeRoute = routes?.[activeTab];

    const fetchRoutes = useCallback(async (s, e) => {
        if (!s || !e) return;
        setLoading(true); setError(null); setRawRoutes(null);
        try {
            const url = `${API}/route-by-area?city=${city}&start_area=${encodeURIComponent(s.name)}&end_area=${encodeURIComponent(e.name)}&mode=car`;
            const res = await fetch(url);
            if (!res.ok) {
                const err = await res.json();
                setError(err.detail || 'Routing failed');
            } else {
                const data = await res.json();
                setRawRoutes(data);
                setActiveTab('cleanest');
            }
        } catch (err) {
            setError('Network error: ' + err.message);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (startArea && endArea) fetchRoutes(startArea, endArea);
    }, [startArea, endArea, fetchRoutes]);

    const convertCoords = (coords) => coords.map(([lon, lat]) => [lat, lon]);

    const getAqiColor = (aqi) => {
        if (!aqi) return '#64748b';
        if (aqi <= 50) return '#10b981';
        if (aqi <= 100) return '#eab308';
        if (aqi <= 150) return '#f97316';
        if (aqi <= 200) return '#ef4444';
        return '#a855f7';
    };

    // Force Leaflet to recalculate size when panel becomes visible
    const MapResizer = () => {
        const map = useMap();
        useEffect(() => {
            setTimeout(() => map.invalidateSize(), 100);
        }, [map]);
        return null;
    };

    return (
        <div className={isFullScreen ? '' : 'card'} style={{ padding: 0, overflow: 'hidden', height: '100%', minHeight: isFullScreen ? '100%' : 220, borderRadius: 'var(--border-radius-lg)', position: 'relative', background: 'transparent' }}>
            <MapContainer
                center={center || [13.0827, 80.2707]}
                zoom={isFullScreen ? 13 : 11}
                style={{ height: '100%', width: '100%', borderRadius: 'inherit', zIndex: 1 }}
                zoomControl={false}
                scrollWheelZoom={isFullScreen}
                dragging={isFullScreen}
                doubleClickZoom={isFullScreen}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap &copy; CARTO'
                />
                {isFullScreen && <ZoomControl position="bottomright" />}
                <MapUpdater center={center} />
                <MapResizer />

                {(cityLocations || []).filter(l => l.aqi).map(loc => (
                    <Marker key={loc.name} position={[loc.lat, loc.lon]}
                        eventHandlers={{ click: () => onLocationSelect && onLocationSelect(loc.name) }}>
                        <Popup>
                            <div style={{ textAlign: 'center', padding: 4 }}>
                                <strong style={{ color: '#1e293b' }}>{loc.name}</strong><br />
                                <span style={{ color: getAqiColor(loc.aqi), fontWeight: 800 }}>AQI {loc.aqi?.toFixed(0) || 'N/A'}</span>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Start marker */}
                {startArea && (
                    <Marker position={[startArea.lat, startArea.lon]}>
                        <Popup><strong><CircleDot size={12} color="#10b981" /> Start</strong><br />{startArea.name}</Popup>
                    </Marker>
                )}
                {/* End marker */}
                {endArea && (
                    <Marker position={[endArea.lat, endArea.lon]}>
                        <Popup><strong><MapPin size={12} color="#ef4444" /> End</strong><br />{endArea.name}</Popup>
                    </Marker>
                )}

                {/* Draw inactive route line (thinner, dashed) */}
                {routes && routes.cleanest && activeTab !== 'cleanest' && (
                    <Polyline positions={convertCoords(routes.cleanest.geometry.coordinates)}
                        pathOptions={{ color: '#10b981', weight: 3, opacity: 0.35, dashArray: '6 4' }} />
                )}
                {routes && routes.balanced && activeTab !== 'balanced' && (
                    <Polyline positions={convertCoords(routes.balanced.geometry.coordinates)}
                        pathOptions={{ color: '#f59e0b', weight: 3, opacity: 0.35, dashArray: '6 4' }} />
                )}

                {/* Active route on top */}
                {activeRoute && (
                    <Polyline
                        positions={convertCoords(activeRoute.geometry.coordinates)}
                        pathOptions={{ color: ROUTE_TABS.find(t => t.id === activeTab)?.color || '#3b82f6', weight: 6, opacity: 0.9 }}
                    />
                )}

                {/* NASA FIRMS Fire markers */}
                {fires.map((fire, idx) => (
                    <Marker key={`fire-${idx}`} position={[fire.lat, fire.lon]} icon={
                        L.divIcon({
                            html: '<div style="font-size: 16px; filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.8));">🔥</div>',
                            className: 'custom-fire-marker',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    }>
                        <Popup>
                            <div style={{ textAlign: 'center', padding: '4px' }}>
                                <strong style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                    <Flame size={14} /> NASA Active Fire
                                </strong>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                                    FRP (Intensity): {fire.frp} MW
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* ── Routing Panel ──────────────────────────────────────────────────── */}
            {isFullScreen && (
                <div style={{
                    position: 'absolute', top: 16, left: 16, zIndex: 1000,
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--border-radius-lg)', padding: 16, width: 330, color: '#1e293b',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    maxHeight: 'calc(100% - 32px)', overflowY: 'auto',
                    scrollbarWidth: 'none'
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'linear-gradient(135deg,#3b82f6,#10b981)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15
                        }}><MapIcon size={20} color="white" /></div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.02em' }}>Exposure-Aware Routing</div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>E = Concentration × Breathing Rate × Time</div>
                        </div>
                    </div>

                    {/* Area inputs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                        <AreaAutocomplete
                            city={city}
                            placeholder="Start area (e.g. Adyar)…"
                            value={startArea?.name || ''}
                            icon={<CircleDot size={14} color="#10b981" />}
                            color="#10b981"
                            onChange={() => { setStartArea(null); setRoutes(null); }}
                            onSelect={s => setStartArea(s)}
                        />
                        <AreaAutocomplete
                            city={city}
                            placeholder="Destination (e.g. T. Nagar)…"
                            value={endArea?.name || ''}
                            icon={<MapPin size={14} color="#ef4444" />}
                            color="#ef4444"
                            onChange={() => { setEndArea(null); setRoutes(null); }}
                            onSelect={s => setEndArea(s)}
                        />
                    </div>

                    {/* Transport mode selector */}
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 7, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Transport Mode
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                            {MODES.map(m => (
                                <button key={m.id} onClick={() => setMode(m.id)} style={{
                                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                                    border: `1.5px solid ${mode === m.id ? m.color : '#e2e8f0'}`,
                                    background: mode === m.id ? `${m.color}15` : '#f8fafc',
                                    color: mode === m.id ? m.color : '#64748b',
                                    fontFamily: 'inherit', transition: 'all 0.2s',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3
                                }}>
                                    <span style={{ display: 'flex', alignItems: 'center' }}>{m.icon}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600 }}>{m.label}</span>
                                </button>
                            ))}
                        </div>
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 6, textAlign: 'center' }}>
                            Breathing rate: {mode === 'car' ? '0.012' : mode === 'bus' ? '0.015' : mode === 'bike' ? '0.025' : mode === 'walking' ? '0.020' : '0.035'} m³/min
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />

                    {/* Loading state */}
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{
                                width: 36, height: 36, border: '3px solid #e2e8f0',
                                borderTop: '3px solid #3b82f6', borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite', margin: '0 auto 10px'
                            }} />
                            <div style={{ fontSize: 12, color: '#64748b' }}>Computing K-shortest paths…</div>
                            <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>First run loads KML graph (~30s). Subsequent calls use cache.</div>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    )}

                    {/* Error */}
                    {error && !loading && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 12, fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}


                    {/* Route results */}
                    {!loading && routes && (
                        <>
                            {/* Insight banner */}
                            {(() => {
                                const cleanConc = routes.cleanest?.mean_concentration;
                                const fastConc = routes.fastest?.mean_concentration;
                                const savingPct = (cleanConc && fastConc && fastConc > 0)
                                    ? Math.round(((fastConc - cleanConc) / fastConc) * 100)
                                    : 0;
                                return (
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                                        {routes._cached && (
                                            <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <Zap size={10} /> Cached ({routes._cache_age_s}s ago)
                                            </span>
                                        )}
                                        {routes.candidates_count && (
                                            <span style={{ fontSize: 10, color: '#64748b', background: '#f8fafc', padding: '3px 8px', borderRadius: 20, border: '1px solid #e2e8f0' }}>
                                                {routes.candidates_count} routes analysed
                                            </span>
                                        )}
                                        {savingPct > 2 && (
                                            <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <Leaf size={10} /> {savingPct}% lower concentration via Cleanest
                                            </span>
                                        )}
                                        {savingPct <= 2 && (
                                            <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <Info size={10} /> Routes pass through similar pollution levels
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Route tab selector */}
                            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                                {ROUTE_TABS.map(tab => (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                        flex: 1, padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
                                        border: `1.5px solid ${activeTab === tab.id ? tab.color : '#e2e8f0'}`,
                                        background: activeTab === tab.id ? `${tab.color}20` : 'transparent',
                                        color: activeTab === tab.id ? tab.color : '#64748b',
                                        fontSize: 11, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s'
                                    }}>
                                        {tab.icon} {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Active route details */}
                            {activeRoute && (
                                <div style={{
                                    background: `${ROUTE_TABS.find(t => t.id === activeTab)?.color}15`,
                                    border: `1px solid ${ROUTE_TABS.find(t => t.id === activeTab)?.color}33`,
                                    borderRadius: 12, padding: 14, marginBottom: 12
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ display: 'flex', alignItems: 'center' }}>{activeRoute.mode_icon}</span>
                                                <span>{activeRoute.mode_label}</span>
                                                <span style={{ color: '#94a3b8' }}>—</span>
                                                <span style={{ display: 'flex', alignItems: 'center' }}>{ROUTE_TABS.find(t => t.id === activeTab)?.icon}</span>
                                                <span>{ROUTE_TABS.find(t => t.id === activeTab)?.label}</span>
                                            </div>
                                            <div style={{ fontSize: 11, color: '#64748b' }}>
                                                {routes.start_area} → {routes.end_area}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Key metrics grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                                        {[
                                            { label: 'Duration', value: formatDuration(activeRoute.duration_min), icon: <Clock size={12} /> },
                                            { label: 'Distance', value: `${activeRoute.distance_km} km`, icon: <MapPin size={12} /> },
                                            { label: 'Avg Conc.', value: `${activeRoute.mean_concentration} µg/m³`, icon: <Wind size={12} /> },
                                            { label: 'Breathing Rate', value: `${activeRoute.inhalation_rate} m³/min`, icon: <Activity size={12} /> },
                                        ].map(m => (
                                            <div key={m.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                                                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>{m.icon} {m.label}</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{m.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Total Exposure — Hero metric */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(16,185,129,0.15))',
                                        border: '1px solid #e2e8f0', borderRadius: 10,
                                        padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>TOTAL EXPOSURE (E = C × IR × t)</div>
                                            <div style={{
                                                fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em',
                                                color: activeRoute.exposure_ug > 50 ? '#f97316' : activeRoute.exposure_ug > 20 ? '#eab308' : '#10b981'
                                            }}>
                                                {activeRoute.exposure_ug}
                                                <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginLeft: 4 }}>µg inhaled</span>
                                            </div>
                                            <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                                                = {activeRoute.mean_concentration} µg/m³ × {activeRoute.inhalation_rate} m³/min × {activeRoute.duration_min} min
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 32 }}>{activeRoute.exposure_ug > 50 ? <AlertCircle color="#f97316" size={28} /> : activeRoute.exposure_ug > 20 ? <Info color="#eab308" size={28} /> : <CircleDot color="#10b981" size={28} />}</div>
                                    </div>
                                </div>
                            )}

                            {/* Compact comparison of other routes */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                {ROUTE_TABS.filter(t => t.id !== activeTab).map(tab => (
                                    <RouteCard
                                        key={tab.id}
                                        route={routes[tab.id]}
                                        color={tab.color}
                                        icon={tab.icon}
                                        label={tab.label}
                                        isActive={false}
                                        onClick={() => setActiveTab(tab.id)}
                                    />
                                ))}
                            </div>

                            {/* Mode comparison section */}
                            <button
                                onClick={() => setShowComparison(v => !v)}
                                style={{
                                    width: '100%', padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                                    border: '1px solid #e2e8f0', background: '#f8fafc',
                                    color: '#94a3b8', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChart2 size={14} /> Mode Exposure Comparison</span>
                                <span>{showComparison ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                            </button>

                            {showComparison && routes.mode_comparison && (
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>
                                        Same routes — different exposure per transport mode (breathing rate matters!)
                                    </div>
                                    {['car', 'bus', 'bike', 'walking', 'cycling'].map(m => (
                                        <ModeComparisonRow key={m} modeKey={m} data={routes.mode_comparison[m]} isActive={m === mode} />
                                    ))}
                                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4, padding: '6px 8px', background: 'rgba(245,158,11,0.08)', borderRadius: 8 }}>
                                        <Info size={10} style={{ marginRight: 2 }} /> Cyclists breathe harder (0.035 m³/min) — even clean routes can mean higher exposure!
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default MapView;
