import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiSun, FiMoon } from 'react-icons/fi';

const TopNav = ({ theme, toggleTheme, locations, selectedLocation, setSelectedLocation }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(selectedLocation || '');
    const searchRef = useRef(null);

    // Sync input when external location prop changes
    useEffect(() => {
        if (selectedLocation) {
            setSearchTerm(selectedLocation);
        }
    }, [selectedLocation]);

    // Handle clicks outside dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
                // Reset search term if not a valid location
                if (!locations.includes(searchTerm) && selectedLocation) {
                    setSearchTerm(selectedLocation);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [searchTerm, selectedLocation, locations]);

    const currentDate = new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    const currentTime = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: "numeric",
        minute: "numeric",
        second: "numeric"
    });

    const filteredLocations = locations.filter(loc => loc.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="top-nav">
            <div>
                <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>Today, {currentDate.split(',')[0]}</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{currentDate.split(',')[1]} {currentTime}</p>
            </div>

            <div className="search-container" ref={searchRef} style={{ position: 'relative' }}>
                <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)', borderRadius: '20px', padding: '8px 16px', gap: '10px', minWidth: '300px' }}>
                    <FiSearch size={20} color="var(--text-secondary)" />
                    <input
                        type="text"
                        placeholder="Search Location..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '15px' }}
                    />
                </div>

                {isDropdownOpen && filteredLocations.length > 0 && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        background: 'var(--bg-card)', backdropFilter: 'blur(10px)',
                        borderRadius: '12px', marginTop: '8px', zIndex: 1000,
                        border: '1px solid var(--text-secondary, rgba(255,255,255,0.1))', overflow: 'hidden',
                        boxShadow: 'var(--shadow-lg)'
                    }}>
                        {filteredLocations.map(loc => (
                            <div
                                key={loc}
                                style={{ padding: '12px 16px', cursor: 'pointer', transition: '0.2s', color: 'var(--text-primary)' }}
                                onMouseEnter={(e) => e.target.style.background = 'var(--accent-light, rgba(255,255,255,0.1))'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                onClick={() => {
                                    setSelectedLocation(loc);
                                    setSearchTerm(loc);
                                    setIsDropdownOpen(false);
                                }}
                            >
                                {loc}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="profile-actions">
                <button className="theme-toggle" onClick={toggleTheme}>
                    {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
                </button>
                <div className="profile-btn"></div>
            </div>
        </div>
    );
};

export default TopNav;
