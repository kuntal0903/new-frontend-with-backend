/**
 * AlertModal.jsx
 */
import { useState } from 'react';
import {
  X,
  ShieldAlert,
  Terminal,
  CheckCircle,
  UserCheck,
  Ban,
  Download,
} from 'lucide-react';

export default function AlertModal({ alert, onClose, onResolve }) {
  const [assignedUser, setAssignedUser] = useState('SecOps L2 (Unassigned)');
  const [toastMsg, setToastMsg] = useState(null);

  if (!alert) return null;

  const handleBlockIp = () => {
    setToastMsg(`IP firewall rule created to isolate asset ${alert.asset}`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleExportIncident = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(alert, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute('href', dataStr);
    anchor.setAttribute('download', `incident-${alert.id}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.8)', zIndex: 400 }} />

      <div
        role="dialog"
        aria-label={`Security alert details for ${alert.title}`}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '92%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-hover)',
          borderRadius: 'var(--radius-lg)',
          zIndex: 401,
          padding: 24,
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), var(--glow-blue)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                color: alert.severity === 'critical' ? 'var(--critical)' : 'var(--high)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: alert.severity === 'critical' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(249, 115, 22, 0.3)',
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{alert.title}</h2>
                <span className={`severity-badge severity-badge--${alert.severity}`}>{alert.severity}</span>
              </div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--neon-blue)' }}>
                Target: {alert.asset} • ID: {alert.id} • {alert.time}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {toastMsg && (
          <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--low)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--low)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={14} /> {toastMsg}
          </div>
        )}

        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>Incident Overview</h4>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {alert.desc}
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={14} color="var(--neon-blue)" /> Raw Event Syslog Payload
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>FORMAT: JSON / SYSLOG</span>
          </div>

          <pre style={{
            background: '#040911',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 12,
            fontSize: 11,
            color: '#38bdf8',
            fontFamily: 'monospace',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.4,
          }}>
{`{
  "event_id": "${alert.id}",
  "severity": "${alert.severity.toUpperCase()}",
  "timestamp": "${new Date().toISOString()}",
  "target_asset": "${alert.asset}",
  "sensor_rule": "RULE_ASM_CRITICAL_SURFACE_ANOMALY",
  "payload": {
    "action": "EXPLOIT_ATTEMPT_DETECTED",
    "src_ip": "185.220.101.5",
    "dst_port": 443,
    "user_agent": "Mozilla/5.0 (ASM-Scanner-Probe)",
    "recommendation": "Apply patch & block remote ingress on port 443"
  }
}`}
          </pre>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, background: 'var(--bg-raised)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <UserCheck size={16} color="var(--accent-purple)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Assign Incident Lead:</span>
          <select
            className="s-select"
            value={assignedUser}
            onChange={(e) => setAssignedUser(e.target.value)}
            style={{ fontSize: 12, flex: 1 }}
          >
            <option value="SecOps L2 (Unassigned)">SecOps L2 (Unassigned)</option>
            <option value="Alex Mercer (SecOps Lead)">Alex Mercer (SecOps Lead)</option>
            <option value="Sarah Jenkins (Incident Response)">Sarah Jenkins (Incident Response)</option>
            <option value="DevOps On-Call">DevOps On-Call</option>
          </select>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn--ghost" onClick={handleExportIncident}>
            <Download size={14} /> Export Log
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--secondary" style={{ color: 'var(--critical)' }} onClick={handleBlockIp}>
              <Ban size={14} /> Block IP / Isolate
            </button>
            <button
              className="btn btn--primary"
              onClick={() => {
                if (onResolve) onResolve(alert.id);
                onClose();
              }}
            >
              <CheckCircle size={14} /> Mark Resolved
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
