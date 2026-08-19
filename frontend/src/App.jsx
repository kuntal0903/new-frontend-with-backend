import { useState, useCallback, useEffect } from 'react';
import { getSavedTheme }  from './hooks/useTheme';
import './App.css';

import Sidebar         from './components/Sidebar';
import Topbar          from './components/Topbar';
import Dashboard          from './pages/Dashboard';
import SettingsPage       from './pages/SettingsPage';
import DomainScanPage     from './pages/DomainScanPage';
import AssetsPage         from './pages/AssetsPage';
import VulnerabilitiesPage from './pages/VulnerabilitiesPage';
import ThreatsPage        from './pages/ThreatsPage';
import AlertsPage         from './pages/AlertsPage';
import PlaceholderPage    from './pages/PlaceholderPage';
import NotificationsPanel from './components/NotificationsPanel';

import './styles/layout.css';
import './styles/components.css';
import './styles/dashboard.css';
import './styles/settings.css';
import './styles/notifications.css';
import './styles/domainScan.css';

function PageRouter({ activePage, onExport, onVulnClick }) {
  if (activePage === 'dashboard') {
    return <Dashboard onExport={onExport} onVulnClick={onVulnClick} />;
  }
  if (activePage === 'assets') {
    return <AssetsPage />;
  }
  if (activePage === 'vulnerabilities') {
    return <VulnerabilitiesPage />;
  }
  if (activePage === 'threats') {
    return <ThreatsPage />;
  }
  if (activePage === 'alerts') {
    return <AlertsPage />;
  }
  if (activePage === 'settings') {
    return <SettingsPage />;
  }
  if (activePage === 'domain-scan') {
    return <DomainScanPage />;
  }
  return <PlaceholderPage pageId={activePage} />;
}

export default function App() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', getSavedTheme());
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen,       setMobileOpen]       = useState(false);
  const [notifOpen,        setNotifOpen]        = useState(false);
  const [activePage, setActivePage] = useState('dashboard');

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleMobileToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const handleNotifToggle = useCallback(() => {
    setNotifOpen((prev) => !prev);
  }, []);

  const handleNotifClose = useCallback(() => {
    setNotifOpen(false);
  }, []);

  const handleNavigate = useCallback((pageId) => {
    setActivePage(pageId);
    setMobileOpen(false);
  }, []);

  const handleExport = useCallback(async (format) => {
    console.log(`[ASM] Export requested — format: ${format}`);
    await new Promise((res) => setTimeout(res, 1800));
    console.log(`[ASM] Export complete`);
  }, []);

  const handleVulnClick = useCallback((vuln) => {
    console.log('[ASM] Vulnerability selected:', vuln);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleToggleSidebar}
        activePage={activePage}
        onNavigate={handleNavigate}
      />

      <div
        className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div className={`main-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Topbar
          activePage={activePage}
          onMobileToggle={handleMobileToggle}
          onNavigate={handleNavigate}
          onNotifToggle={handleNotifToggle}
          notifOpen={notifOpen}
        />

        <PageRouter
          activePage={activePage}
          onExport={handleExport}
          onVulnClick={handleVulnClick}
        />
      </div>

      <NotificationsPanel
        isOpen={notifOpen}
        onClose={handleNotifClose}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
