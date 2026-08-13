import { useState } from 'react';
import { ShieldAlert, X, Check, Trash2, Filter, Search, Clock, ShieldCheck, UserCheck } from 'lucide-react';
import AlertModal from '../components/AlertModal';

const INITIAL_ALERTS = [
  { id: 'alt-1', severity: 'critical', title: 'Critical RCE Vulnerability Confirmed', asset: 'mail.corp.internal', time: '5m ago', status: 'Active', desc: 'CVE-2024-21413 confirmed on mail gateway. Immediate patch required.' },
  { id: 'alt-2', severity: 'critical', title: 'Auth Bypass Attempt Detected', asset: 'remote-access-01', time: '18m ago', status: 'Active', desc: 'CVE-2024-1709 exploitation traffic targeted port 443.' },
  { id: 'alt-3', severity: 'high', title: 'Brute Force / Credential Stuffing', asset: 'vpn-gateway.corp', time: '1h ago', status: 'Investigating', desc: '14,200 failed attempts from 87 unique IPs. GeoBlock active.' },
  { id: 'alt-4', severity: 'high', title: 'Unmanaged Port 3389 Exposed', asset: '10.12.4.87', time: '3h ago', status: 'Active', desc: 'RDP port exposed publicly without network ACL policy.' },
  { id: 'alt-5', severity: 'medium', title: 'SSL Certificate Expiring in 7 Days', asset: 'api.prod.svc', time: '5h ago', status: 'Resolved', desc: 'Auto-renewal ticket submitted for production SSL certificate.' },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [filterSev, setFilterSev] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleResolveAlert = (id) => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, status: 'Resolved' } : a)));
    showToast('Alert marked as resolved');
  };

  const handleClearAlert = (id) => {
    setAlerts(alerts.filter((a) => a.id !== id));
    showToast('Alert dismissed');
  };

  const handleClearAll = () => {
    setAlerts([]);
    showToast('All alerts cleared');
  };

  const filtered = alerts.filter((a) => {
    const matchSev = filterSev === 'All' || a.severity === filterSev.toLowerCase();
    const matchStatus = filterStatus === 'All' || a.status === filterStatus;
    const matchSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.asset.toLowerCase().includes(search.toLowerCase()) ||
      a.desc.toLowerCase().includes(search.toLowerCase());
    return matchSev && matchStatus && matchSearch;
  });

  const activeCount = alerts.filter((a) => a.status === 'Active').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status !== 'Resolved').length;

  return (
    <div className="page-content">
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 500, background: 'var(--bg-elevated)', border: '1px solid var(--low)', color: 'var(--low)', padding: '12px 20px', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontSize: 13, fontWeight: 600 }}>
          ✓ {toastMsg}
        </div>
      )}

      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">
            Security <span>Alerts</span>
          </h1>
          <p className="page-header__subtitle">
            Real-time security event notifications, escalations, and incident response tracking.
          </p>
        </div>

        {alerts.length > 0 && (
          <button className="btn btn--ghost" onClick={handleClearAll} aria-label="Clear all security alerts">
            <Trash2 size={14} /> Clear All Alerts
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Active Incidents</span>
            <ShieldAlert size={16} color="var(--critical)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--critical)', marginTop: 8 }}>{activeCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Requires SOC attention</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Critical Unresolved</span>
            <Clock size={16} color="var(--high)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--high)', marginTop: 8 }}>{criticalCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>High severity alerts</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>SOC Incident Lead</span>
            <UserCheck size={16} color="var(--accent-purple)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-purple)', marginTop: 8 }}>Alex Mercer</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>SecOps Lead On-Call</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Avg Response MTTR</span>
            <ShieldCheck size={16} color="var(--low)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--low)', marginTop: 8 }}>14m 30s</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Under 30-minute SLA target</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="s-input"
              placeholder="Search alert title, asset, payload..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34, width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Severity:</span>
            {['All', 'Critical', 'High', 'Medium'].map((sev) => (
              <button
                key={sev}
                className={`panel__action-btn ${filterSev === sev ? 'active' : ''}`}
                onClick={() => setFilterSev(sev)}
              >
                {sev}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
            <select className="s-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Investigating">Investigating</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No security alerts match the current search or filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((alt) => (
              <div
                key={alt.id}
                onClick={() => setSelectedAlert(alt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  borderBottom: '1px solid var(--border)',
                  background: alt.status === 'Resolved' ? 'rgba(255,255,255,0.01)' : 'var(--bg-surface)',
                  opacity: alt.status === 'Resolved' ? 0.65 : 1,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: alt.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.15)',
                      color: alt.severity === 'critical' ? 'var(--critical)' : 'var(--high)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className={`severity-badge severity-badge--${alt.severity}`}>{alt.severity}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{alt.title}</span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--neon-blue)' }}>{alt.asset}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{alt.desc}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={(e) => e.stopPropagation()}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{alt.time}</span>
                  {alt.status !== 'Resolved' ? (
                    <button className="btn btn--ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleResolveAlert(alt.id)}>
                      <Check size={12} color="var(--low)" /> Mark Resolved
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--low)', fontWeight: 700 }}>✓ Resolved</span>
                  )}
                  <button onClick={() => handleClearAlert(alt.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Dismiss alert">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedAlert && (
        <AlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onResolve={(id) => handleResolveAlert(id)}
        />
      )}
    </div>
  );
}
