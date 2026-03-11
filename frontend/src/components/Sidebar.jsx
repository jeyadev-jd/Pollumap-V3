import React, { useState } from 'react';
import { Home, Flame, Activity, Map as MapIcon, Cpu, Settings, LogOut, Wind } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ activeTab, setActiveTab }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <motion.div
            className="sidebar"
            initial={{ width: 90 }}
            animate={{ width: isHovered ? 200 : 90 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: 'var(--bg-sidebar)',
                borderRadius: 'var(--border-radius-lg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '30px 0',
                boxShadow: 'var(--shadow-md)',
                height: '100%',
                flexShrink: 0,
                position: 'relative',
                zIndex: 100,
                overflow: 'hidden'
            }}
        >
            <div className="sidebar-logo" style={{ marginBottom: '40px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', width: '100%', paddingLeft: '29px', justifyContent: 'flex-start' }}>
                <Wind size={32} style={{ flexShrink: 0 }} />
                <AnimatePresence>
                    {isHovered && (
                        <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            style={{ marginLeft: '12px', fontSize: '20px', fontWeight: 800, whiteSpace: 'nowrap' }}
                        >
                            PolluMap
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
            <div className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                <NavItem icon={<Home size={20} />} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} isExpanded={isHovered} />
                <NavItem icon={<MapIcon size={20} />} label="Routing Map" isActive={activeTab === 'map'} onClick={() => setActiveTab('map')} isExpanded={isHovered} />
                <NavItem icon={<Cpu size={20} />} label="IoT Sensors" isActive={activeTab === 'iot'} onClick={() => setActiveTab('iot')} isExpanded={isHovered} />
            </div>
            <div style={{ marginTop: 'auto', width: '100%' }}>
                <NavItem icon={<LogOut size={20} />} label="Logout" isActive={activeTab === 'logout'} onClick={() => setActiveTab('logout')} isExpanded={isHovered} />
            </div>
        </motion.div>
    );
};

const NavItem = ({ icon, label, isActive, onClick, isExpanded }) => {
    return (
        <div
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={onClick}
            title={!isExpanded ? label : ''}
            style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                width: isExpanded ? 'calc(100% - 40px)' : '50px',
                height: '50px',
                borderRadius: isExpanded ? '12px' : '50%',
                margin: '0 20px',
                color: isActive ? 'var(--text-inverse)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-blue)' : 'transparent',
                transition: 'all 0.2s ease',
                paddingLeft: isExpanded ? '15px' : '0',
                justifyContent: isExpanded ? 'flex-start' : 'center',
                overflow: 'hidden'
            }}
        >
            <div style={{ fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', flexShrink: 0 }}>
                {icon}
            </div>
            <AnimatePresence>
                {isExpanded && (
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        style={{ marginLeft: '15px', fontSize: '15px', fontWeight: 500, whiteSpace: 'nowrap' }}
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Sidebar;
