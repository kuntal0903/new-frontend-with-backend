import { X, CheckCircle, Server, Activity, Database, Shield } from 'lucide-react';

export default function SystemStatusModal({ onClose }) {
  const SERVICES = [
    { name: 'Surface Recon Agent (US-East)', status: 'Operational', uptime: '99.98%', latency: '24ms', icon: Server },
    { name: 'Vulnerability Engine', status: 'Operational', uptime: '100%', latency: '12ms', icon: Activity },
    { name: 'Threat Intelligence Collector', status: 'Operational', uptime: '99.95%', latency: '45ms', icon: Shield },
    { name: 'Database Cluster (Primary)', status: 'Operational', uptime: '100%', latency: '4ms', icon: Database },
  ];

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.75)', zIndex: 300 }} />
      <div role="dialog" aria-label="System Health Status" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: '520px', background: 'var(--bg-surface)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-lg)', zIndex: 301, padding: 24, boxShadow: 'var(--glow-blue)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="status-dot status-dot--live" />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>System Health & Telemetry</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={16} color="var(--neon-blue)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Uptime: {s.uptime} • Latency: {s.latency}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--low)', fontSize: 12, fontWeight: 700 }}>
                  <CheckCircle size={14} /> {s.status}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn--primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}
