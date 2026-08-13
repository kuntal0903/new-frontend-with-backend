import { X, Radar, Shield, ExternalLink, CheckCircle } from 'lucide-react';

export default function ThreatModal({ threat, onClose }) {
  if (!threat) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.75)', zIndex: 300 }} />
      <div role="dialog" aria-label="Threat Detail" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: '520px', background: 'var(--bg-surface)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-lg)', zIndex: 301, padding: 24, boxShadow: 'var(--glow-blue)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radar size={18} color="var(--neon-blue)" />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Threat Intelligence Detail</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        <div style={{ background: 'var(--bg-raised)', padding: 14, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>{threat.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{threat.desc}</div>
        </div>

        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-muted)', marginBottom: 20 }}>
          <div>Detected: <strong style={{ color: 'var(--text-primary)' }}>{threat.time}</strong></div>
          <div>Adversary Tag: <span className="mono" style={{ color: 'var(--neon-blue)' }}>GLOBAL_THREAT_FEED_V4</span></div>
          <div>Recommended Action: Apply firewall ACL rule & verify patch level.</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn--ghost" onClick={onClose}>Dismiss</button>
          <button className="btn btn--primary" onClick={onClose}>
            <Shield size={14} /> Create Incident Rule
          </button>
        </div>
      </div>
    </>
  );
}
