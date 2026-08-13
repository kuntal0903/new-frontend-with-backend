import { useState, useEffect } from 'react';
import { Search, Bell, Clock, User, Shield } from 'lucide-react';

export default function Topbar({ activePage, onMobileToggle, onNavigate, onNotifToggle, notifOpen }) {
  const [time, setTime] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="topbar__mobile-toggle" onClick={onMobileToggle} aria-label="Toggle menu">
          <span />
          <span />
          <span />
        </button>

        <div className="topbar__search">
          <Search size={14} className="topbar__search-icon" />
          <input type="text" placeholder="Search assets, CVEs, IPs, domain scans..." aria-label="Search" />
          <div className="topbar__search-shortcut">⌘K</div>
        </div>
      </div>

      <div className="topbar__right">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          <Clock size={13} /> {time || '10:00:00'} UTC
        </div>

        <button
          className={`btn btn--ghost ${notifOpen ? 'active' : ''}`}
          onClick={onNotifToggle}
          style={{ position: 'relative', padding: 8 }}
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--critical)' }} />
        </button>

        <div style={{ position: 'relative' }}>
          <div
            className="topbar__profile"
            onClick={() => setProfileOpen((prev) => !prev)}
            role="button"
            tabIndex={0}
          >
            <div className="topbar__avatar">AD</div>
            <div className="topbar__user-info">
              <span className="topbar__user-name">Alex Dawson</span>
              <span className="topbar__user-role">SecOps Lead</span>
            </div>
          </div>

          {profileOpen && (
            <div className="topbar__dropdown">
              <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Alex Dawson</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>alex.dawson@corp.internal</div>
              </div>
              <button
                onClick={() => { setProfileOpen(false); if (onNavigate) onNavigate('settings'); }}
                style={{ width: '100%', padding: '10px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <User size={14} /> Profile & Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
