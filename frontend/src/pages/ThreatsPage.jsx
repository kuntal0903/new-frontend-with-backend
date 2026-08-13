import { useState } from 'react';
import { Radar, ShieldAlert, Globe, Zap, Cpu, Search, Shield } from 'lucide-react';
import ThreatFeed from '../components/ThreatFeed';
import ThreatModal from '../components/ThreatModal';

const APT_GROUPS = [
  {
    name: 'APT29 (Cozy Bear)',
    origin: 'State-Sponsored',
    targets: 'Government, Defense, Technology',
    ttps: 'Spearphishing, Supply Chain Compromise, OAuth Abuse',
    activity: 'Active Wave (Aug 2026)',
    riskLevel: 'Critical',
  },
  {
    name: 'LockBit 3.0',
    origin: 'Ransomware-as-a-Service',
    targets: 'Healthcare, Finance, Manufacturing',
    ttps: 'Exposed RDP, Double Extortion, StealBit Malware',
    activity: 'High Volume',
    riskLevel: 'Critical',
  },
  {
    name: 'Volt Typhoon',
    origin: 'State-Sponsored',
    targets: 'Critical Infrastructure, Telcos',
    ttps: 'Living-off-the-Land (LotL), SOHO Router Proxies',
    activity: 'Stealth Persistence',
    riskLevel: 'High',
  },
];

export default function ThreatsPage() {
  const [selectedThreat, setSelectedThreat] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

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
            Threat <span>Intelligence</span>
          </h1>
          <p className="page-header__subtitle">
            Real-time global adversary profiling, IOC feeds, zero-day alerts, and ransomware threat tracking.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Global Threat Level</span>
            <Radar size={16} color="var(--critical)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--critical)', marginTop: 8 }}>ELEVATED</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Defcon 3 — High RCE Wave</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Active IOCs Tracked</span>
            <Globe size={16} color="var(--neon-blue)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>1,482</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>IPs, Hashes, Domains</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Monitored APT Groups</span>
            <Cpu size={16} color="var(--accent-purple)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-purple)', marginTop: 8 }}>38</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Active adversary dossiers</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Zero-Day Exploits</span>
            <Zap size={16} color="var(--high)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--high)', marginTop: 8 }}>3 Active</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>ScreenConnect & VPN PoCs</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="s-input"
              placeholder="Filter threat feed, IOCs, CVEs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34, width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {['All', 'Ransomware', 'Zero-Day', 'APTs', 'Phishing'].map((cat) => (
              <button
                key={cat}
                className={`panel__action-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-grid-3col">
        <div className="panel" style={{ gridColumn: 'span 2' }}>
          <div className="panel__header">
            <div className="panel__title">
              <Radar size={16} color="var(--neon-blue)" /> Active Global Threat Stream
            </div>
          </div>
          <div className="panel__body">
            <ThreatFeed onItemClick={(threat) => setSelectedThreat(threat)} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel__header">
              <div className="panel__title">
                <ShieldAlert size={16} color="var(--critical)" /> Threat Categories
              </div>
            </div>
            <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, background: 'var(--bg-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--critical)' }}>Ransomware Campaigns</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>LockBit 3.0, BlackCat, Akira targeting exposed services.</div>
              </div>

              <div style={{ padding: 12, background: 'var(--bg-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--high)' }}>Zero-Day Exploitation</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Active PoC exploits for Outlook, ScreenConnect & Ivanti VPNs.</div>
              </div>

              <div style={{ padding: 12, background: 'var(--bg-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent-purple)' }}>State-Sponsored APTs</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>APT29 (Cozy Bear) spearphishing and credential harvesting waves.</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel__header">
              <div className="panel__title">
                <Shield size={16} color="var(--neon-blue)" /> High-Priority APT Dossiers
              </div>
            </div>
            <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {APT_GROUPS.map((apt) => (
                <div
                  key={apt.name}
                  style={{
                    padding: 12,
                    background: 'var(--bg-card)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  onClick={() => showToast(`Opening dossier for ${apt.name}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{apt.name}</span>
                    <span className={`severity-badge severity-badge--${apt.riskLevel.toLowerCase()}`}>{apt.riskLevel}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Origin: {apt.origin} • Activity: {apt.activity}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, fontStyle: 'italic' }}>
                    TTPs: {apt.ttps}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedThreat && (
        <ThreatModal
          threat={selectedThreat}
          onClose={() => setSelectedThreat(null)}
        />
      )}
    </div>
  );
}
