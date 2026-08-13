import { useState } from 'react';
import {
  LayoutDashboard,
  Database,
  ShieldAlert,
  Radar,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
  Bell,
} from 'lucide-react';
import SystemStatusModal from './SystemStatusModal';

const NAV_ITEMS = [
  { id: 'dashboard',       label: 'Dashboard',            icon: LayoutDashboard, section: 'MAIN' },
  { id: 'assets',          label: 'Asset Inventory',      icon: Database },
  { id: 'vulnerabilities', label: 'Vulnerabilities',      icon: ShieldAlert, badge: 14, section: 'SECURITY' },
  { id: 'threats',         label: 'Threat Intelligence',  icon: Radar },
  { id: 'domain-scan',     label: 'Domain Scan',          icon: Activity },
  { id: 'alerts',          label: 'Alerts',               icon: Bell, badge: 3 },
  { id: 'settings',        label: 'Settings',             icon: Settings, section: 'SYSTEM' },
];

export default function Sidebar({ collapsed, onToggle, activePage, onNavigate }) {
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  return (
    <>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <button
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        <div
          className="sidebar__logo"
          onClick={() => onNavigate('dashboard')}
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
        >
          <div className="sidebar__logo-icon">
            <Shield size={18} color="white" strokeWidth={2.5} />
          </div>
          <div className="sidebar__logo-text">
            <h2>ASM SHIELD</h2>
            <span>Attack Surface Mgmt</span>
          </div>
        </div>

        <nav className="sidebar__nav" role="navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <div key={item.id}>
                {item.section && <div className="sidebar__section-label">{item.section}</div>}

                <div
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="nav-item__icon">
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                  </div>
                  <span className="nav-item__label">{item.label}</span>
                  {item.badge && <span className="nav-item__badge">{item.badge}</span>}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <div
            className="sidebar__status"
            onClick={() => setStatusModalOpen(true)}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
          >
            <div className="sidebar__status-dot" />
            <span className="sidebar__status-text">All Systems Operational</span>
          </div>
        </div>
      </aside>

      {statusModalOpen && <SystemStatusModal onClose={() => setStatusModalOpen(false)} />}
    </>
  );
}
