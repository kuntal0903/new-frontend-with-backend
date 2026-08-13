import { useState } from 'react';
import { Bell, X, CheckCheck, ShieldAlert, AlertTriangle, Info } from 'lucide-react';

const INITIAL_NOTIFS = [
  { id: 1, type: 'critical', title: 'Critical Vulnerability Detected', desc: 'CVE-2024-21413 (Outlook RCE) identified on mail.corp.internal', time: '10m ago', read: false },
  { id: 2, type: 'warning',  title: 'Unusual Ingress Traffic', desc: 'Port 3389 RDP connection spike from external IP 185.220.101.5', time: '1h ago',  read: false },
  { id: 3, type: 'info',     title: 'Daily Surface Scan Completed', desc: 'Discovered 14 new subdomains and updated 8 SSL certificate records', time: '3h ago',  read: true },
];

export default function NotificationsPanel({ isOpen, onClose, onNavigate }) {
  const [notifs, setNotifs] = useState(INITIAL_NOTIFS);

  if (!isOpen) return null;

  const markAllRead = () => {
    setNotifs(notifs.map(n => ({ ...n, read: true })));
  };

  const markRead = (id) => {
    setNotifs(notifs.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleViewAll = () => {
    onClose();
    if (onNavigate) onNavigate('alerts');
  };

  return (
    <>
      <div className="notif-overlay" onClick={onClose} aria-hidden="true" />
      <div className="notif-panel" role="dialog" aria-label="Notifications panel">
        <div className="notif-panel__header">
          <div className="notif-panel__title">
            <Bell size={16} color="var(--neon-blue)" /> Security Notifications
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn--ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={markAllRead}>
              <CheckCheck size={13} /> Read all
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="notif-panel__list">
          {notifs.map(n => (
            <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`} onClick={() => markRead(n.id)}>
              <div className="notif-item__icon" style={{
                color: n.type === 'critical' ? 'var(--critical)' : n.type === 'warning' ? 'var(--high)' : 'var(--neon-blue)'
              }}>
                {n.type === 'critical' ? <ShieldAlert size={16} /> : n.type === 'warning' ? <AlertTriangle size={16} /> : <Info size={16} />}
              </div>
              <div className="notif-item__content">
                <div className="notif-item__title">{n.title}</div>
                <div className="notif-item__desc">{n.desc}</div>
                <div className="notif-item__time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="notif-panel__footer">
          <button className="btn btn--ghost" style={{ width: '100%', fontSize: 12 }} onClick={handleViewAll}>
            View All Security Alerts →
          </button>
        </div>
      </div>
    </>
  );
}
