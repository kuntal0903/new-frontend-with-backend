/**
 * AssetModal.jsx
 */
import { useState } from 'react';
import {
  X,
  Server,
  ShieldAlert,
  Radio,
  Clock,
  RefreshCw,
  Download,
  CheckCircle,
} from 'lucide-react';

export default function AssetModal({ asset, onClose, onScanTrigger }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);

  if (!asset) return null;

  const handleRunScan = () => {
    setIsScanning(true);
    setScanMessage('Initiating port scan & vulnerability check...');
    setTimeout(() => {
      setIsScanning(false);
      setScanMessage('Scan complete! 0 new vulnerabilities found.');
      if (onScanTrigger) onScanTrigger(asset);
    }, 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(asset, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute('href', dataStr);
    anchor.setAttribute('download', `asset-${asset.id}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.8)', zIndex: 400 }} />

      <div
        role="dialog"
        aria-label={`Asset details for ${asset.name}`}
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
                background: 'rgba(59, 130, 246, 0.12)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(59, 130, 246, 0.2)',
              }}
            >
              <Server size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{asset.name}</h2>
                <span className={`severity-badge severity-badge--${asset.risk ? asset.risk.toLowerCase() : 'low'}`}>
                  {asset.risk}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--neon-blue)' }}>
                {asset.ip} • ID: {asset.id}
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

        {scanMessage && (
          <div
            style={{
              padding: '10px 14px',
              marginBottom: 16,
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid var(--low)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--low)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle size={14} /> {scanMessage}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ background: 'var(--bg-raised)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Category</span>
            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{asset.type}</strong>
          </div>

          <div style={{ background: 'var(--bg-raised)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>OS / Platform</span>
            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{asset.os}</strong>
          </div>

          <div style={{ background: 'var(--bg-raised)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Status</span>
            <strong style={{ fontSize: 13, color: asset.status === 'Online' ? 'var(--low)' : 'var(--text-muted)' }}>
              ● {asset.status}
            </strong>
          </div>

          <div style={{ background: 'var(--bg-raised)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Vulnerabilities</span>
            <strong style={{ fontSize: 13, color: asset.vulns > 0 ? 'var(--critical)' : 'var(--low)' }}>
              {asset.vulns} Detected
            </strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
              <Radio size={14} color="var(--neon-blue)" /> Open Port Matrix
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                <span className="mono" style={{ color: 'var(--neon-blue)' }}>Port 443 (TCP)</span>
                <span style={{ color: 'var(--low)' }}>HTTPS / TLS 1.3</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                <span className="mono" style={{ color: 'var(--neon-blue)' }}>Port 80 (TCP)</span>
                <span>HTTP Redirect</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="mono" style={{ color: 'var(--neon-blue)' }}>Port 22 (TCP)</span>
                <span style={{ color: 'var(--high)' }}>OpenSSH 8.9p1</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
              <Clock size={14} color="var(--accent-purple)" /> Scan Telemetry
            </h4>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-secondary)' }}>
              <div>First Discovered: <strong style={{ color: 'var(--text-primary)' }}>2026-02-10</strong></div>
              <div>Last Scanned: <strong style={{ color: 'var(--text-primary)' }}>12 minutes ago</strong></div>
              <div>Scan Agent: <span className="mono" style={{ fontSize: 11 }}>us-east-agent-04</span></div>
              <div>Health Score: <strong style={{ color: asset.vulns > 0 ? 'var(--high)' : 'var(--low)' }}>{100 - (asset.vulns * 12)} / 100</strong></div>
            </div>
          </div>
        </div>

        {asset.vulns > 0 && (
          <div style={{ marginBottom: 20, background: 'rgba(239, 68, 68, 0.05)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--critical)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={14} /> Associated Security Flaws
            </h4>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              This asset has {asset.vulns} active security vulnerabilities including unpatched service dependencies. Immediate remediation recommended.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button className="btn btn--ghost" onClick={handleExportJson}>
            <Download size={14} /> Download Spec (JSON)
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--secondary" onClick={handleRunScan} disabled={isScanning}>
              <RefreshCw size={14} className={isScanning ? 'spin-icon' : ''} />
              {isScanning ? 'Scanning...' : 'Trigger Surface Scan'}
            </button>
            <button className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
