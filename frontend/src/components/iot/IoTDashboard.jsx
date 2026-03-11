import React, { useState, useEffect, useRef } from 'react';
import { FiPlus, FiX, FiMoreVertical, FiEdit2, FiTrash2, FiRefreshCw, FiMapPin } from 'react-icons/fi';
import aqiSensorImg from '../../../img/AQI Sensor.png';

const MOCK_LOCATIONS = ['Living Room', 'Main Office', 'Street Corner', 'Rooftop', 'Warehouse', 'Server Room'];

const IoTDashboard = () => {
    const [sensors, setSensors] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [connectionCode, setConnectionCode] = useState('');
    const [selectedSensor, setSelectedSensor] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId !== null) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    // Auto-focus the rename input
    useEffect(() => {
        if (renamingId !== null && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);

    const makeReadings = () => ({
        pm25: (Math.random() * 50).toFixed(1),
        pm10: (Math.random() * 80).toFixed(1),
        no2: (Math.random() * 30).toFixed(1),
        so2: (Math.random() * 15).toFixed(1),
        o3: (Math.random() * 40).toFixed(1),
        co: (Math.random() * 2).toFixed(2),
        voc: (Math.random() * 500).toFixed(0),
        nh3: (Math.random() * 10).toFixed(1),
    });

    const handleAddSensor = (e) => {
        e.preventDefault();
        if (!connectionCode.trim()) return;

        const newSensor = {
            id: Date.now(),
            code: connectionCode,
            status: Math.random() > 0.3 ? 'Online' : 'Offline',
            name: `AQI Sensor - ${connectionCode.substring(0, 4)}`,
            location: MOCK_LOCATIONS[Math.floor(Math.random() * MOCK_LOCATIONS.length)],
            readings: makeReadings(),
        };

        setSensors(prev => [...prev, newSensor]);
        setConnectionCode('');
        setIsModalOpen(false);
    };

    const handleCardClick = (sensor) => {
        if (openMenuId !== null || renamingId !== null) return;
        setSelectedSensor(sensor);
    };

    const toggleMenu = (e, sensorId) => {
        e.stopPropagation();
        setOpenMenuId(prev => (prev === sensorId ? null : sensorId));
    };

    const commitRename = (sensorId) => {
        const trimmed = renameValue.trim();
        if (trimmed) {
            setSensors(prev => prev.map(s => s.id === sensorId ? { ...s, name: trimmed } : s));
        }
        setRenamingId(null);
        setRenameValue('');
    };

    const handleMenuAction = (e, action, sensor) => {
        e.stopPropagation();
        setOpenMenuId(null);
        if (action === 'rename') {
            setRenamingId(sensor.id);
            setRenameValue(sensor.name);
        } else if (action === 'delete') {
            setSensors(prev => prev.filter(s => s.id !== sensor.id));
        } else if (action === 'refresh') {
            setSensors(prev => prev.map(s => s.id === sensor.id ? { ...s, readings: makeReadings() } : s));
        }
    };

    return (
        <div className="iot-dashboard-container">
            <div className="iot-header">
                <h2>IoT Devices</h2>
                <p>Manage your connected sensors and devices.</p>
            </div>

            <div className="sensors-grid">
                {/* Add Sensor Card */}
                <div
                    className="add-sensor-card"
                    onClick={() => setIsModalOpen(true)}
                    title="Add new sensor"
                >
                    <FiPlus className="add-icon" />
                    <span>Add Sensor</span>
                </div>

                {/* Connected Sensors */}
                {sensors.map(sensor => (
                    <div
                        className="sensor-card"
                        key={sensor.id}
                        onClick={() => handleCardClick(sensor)}
                    >
                        {/* Image section */}
                        <div className="sensor-image-container">
                            <img src={aqiSensorImg} alt="AQI Sensor" className="sensor-image" />

                            {/* 3-dot settings button */}
                            <button
                                className="sensor-settings-btn"
                                onClick={(e) => toggleMenu(e, sensor.id)}
                                title="Advanced Settings"
                            >
                                <FiMoreVertical />
                            </button>

                            {/* Dropdown menu */}
                            {openMenuId === sensor.id && (
                                <div className="sensor-dropdown-menu" onClick={e => e.stopPropagation()}>
                                    <button className="dropdown-item" onClick={(e) => handleMenuAction(e, 'rename', sensor)}>
                                        <FiEdit2 size={14} /> Rename
                                    </button>
                                    <button className="dropdown-item" onClick={(e) => handleMenuAction(e, 'refresh', sensor)}>
                                        <FiRefreshCw size={14} /> Refresh Readings
                                    </button>
                                    <button className="dropdown-item danger" onClick={(e) => handleMenuAction(e, 'delete', sensor)}>
                                        <FiTrash2 size={14} /> Remove Sensor
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Info section */}
                        <div className="sensor-info">
                            <div className="sensor-info-header">
                                {renamingId === sensor.id ? (
                                    <input
                                        ref={renameInputRef}
                                        className="sensor-rename-input"
                                        value={renameValue}
                                        onChange={e => setRenameValue(e.target.value)}
                                        onBlur={() => commitRename(sensor.id)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') commitRename(sensor.id);
                                            if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                                        }}
                                        onClick={e => e.stopPropagation()}
                                    />
                                ) : (
                                    <h3 className="sensor-name">{sensor.name}</h3>
                                )}
                                <p className="sensor-location">
                                    <FiMapPin size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                    {sensor.location}
                                </p>
                            </div>
                            <div className="sensor-status-wrapper">
                                <span className={`status-dot ${sensor.status.toLowerCase()}`}></span>
                                <span className="status-text">{sensor.status}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Connection Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Connect New Sensor</h3>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                                <FiX />
                            </button>
                        </div>
                        <form onSubmit={handleAddSensor} className="modal-form">
                            <div className="form-group">
                                <label htmlFor="connectionCode">Enter Connection Code</label>
                                <input
                                    type="text"
                                    id="connectionCode"
                                    value={connectionCode}
                                    onChange={(e) => setConnectionCode(e.target.value)}
                                    placeholder="e.g. SN-84920-XQ"
                                    autoFocus
                                    required
                                />
                            </div>
                            <button type="submit" className="submit-btn">Connect Device</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Detailed View Modal */}
            {selectedSensor && (
                <div className="modal-overlay" onClick={() => setSelectedSensor(null)}>
                    <div className="modal-content sensor-detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header detail-header">
                            <div>
                                <h3>{selectedSensor.name}</h3>
                                <p className="sensor-location" style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
                                    <FiMapPin size={12} style={{ marginRight: 5 }} />
                                    {selectedSensor.location}
                                </p>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedSensor(null)}>
                                <FiX />
                            </button>
                        </div>

                        <div className="detail-status">
                            <div className="sensor-status-wrapper">
                                <span className={`status-dot ${selectedSensor.status.toLowerCase()}`}></span>
                                <span className="status-text">{selectedSensor.status}</span>
                            </div>
                        </div>

                        <div className="parameters-grid">
                            <ParamCard label="PM2.5" val={selectedSensor.readings.pm25} unit="µg/m³" />
                            <ParamCard label="PM10" val={selectedSensor.readings.pm10} unit="µg/m³" />
                            <ParamCard label="NO2" val={selectedSensor.readings.no2} unit="ppb" />
                            <ParamCard label="SO2" val={selectedSensor.readings.so2} unit="ppb" />
                            <ParamCard label="O3" val={selectedSensor.readings.o3} unit="ppb" />
                            <ParamCard label="CO" val={selectedSensor.readings.co} unit="ppm" />
                            <ParamCard label="VOC" val={selectedSensor.readings.voc} unit="ppb" />
                            <ParamCard label="NH3" val={selectedSensor.readings.nh3} unit="ppb" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ParamCard = ({ label, val, unit }) => (
    <div className="param-card">
        <span className="param-label">{label}</span>
        <div className="param-value-container">
            <span className="param-val">{val}</span>
            <span className="param-unit">{unit}</span>
        </div>
    </div>
);

export default IoTDashboard;
