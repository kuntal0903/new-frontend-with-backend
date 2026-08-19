import { useState, useMemo } from 'react';
import KpiCard from '../components/KpiCard';
import RiskChart from '../components/RiskChart';
import VulnerabilityTable from '../components/VulnerabilityTable';
import ThreatFeed from '../components/ThreatFeed';
import ExportCard from '../components/ExportCard';
import VulnerabilityModal from '../components/VulnerabilityModal';
import ThreatModal from '../components/ThreatModal';

import { Shield, ShieldAlert, Database, Activity, Filter, Download } from 'lucide-react';

const KPI_CARDS = [
  {
    id: 'total-assets', title: 'Total Assets', value: '1,284',
    change: '+8.4% this week', trend: 'up', icon: Database, color: 'blue',
    progress: 72, meta: { left: '928 online', right: '356 offline' }
  },
  {
    id: 'critical-risks', title: 'Critical / High Risks', value: '147',
    change: '+14 this week', trend: 'up', icon: ShieldAlert, color: 'red',
    progress: 58, meta: { left: '42 Critical', right: '105 High' }
  },
  {
    id: 'health-score', title: 'Health Score', value: '71%',
    change: '3pts drop', trend: 'down', icon: Shield, color: 'green',
    progress: 71, meta: { left: 'Target: 90%', right: '↓ Degrading' }
  },
  {
    id: 'active-vulns', title: 'Total Vulnerabilities', value: '2,831',
    change: '+121 detected', trend: 'up', icon: Activity, color: 'purple',
    progress: 65, meta: { left: '1,842 unpatched', right: '7d avg fix' }
  },
];

export default function Dashboard({ onExport, onVulnClick }) {
  const [selectedVuln, setSelectedVuln] = useState(null);
  const [selectedThreat, setSelectedThreat] = useState(null);

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">
            Attack Surface <span>Overview</span>
          </h1>
          <p className="page-header__subtitle">
            Real-time security telemetry, asset exposure, and active threat intelligence feed.
          </p>
          <div className="page-header__live-badge">
            <span className="page-header__live-dot" />
            LIVE &nbsp;Monitoring 1,284 assets &middot; Last scan: 6 minutes ago
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        {KPI_CARDS.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </div>

      <div className="dashboard-grid-2col" style={{ marginTop: 24 }}>
        <div className="panel">
          <div className="panel__header">
            <div className="panel__title">Risk Trend Matrix</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>7-Day Exposure History</span>
          </div>
          <div className="panel__body">
            <RiskChart />
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <div className="panel__title">Live Threat Intelligence</div>
            <span className="status-dot status-dot--live" />
          </div>
          <div className="panel__body">
            <ThreatFeed onItemClick={(threat) => setSelectedThreat(threat)} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <ExportCard onExport={onExport} />
      </div>

      <div className="panel" style={{ marginTop: 24, padding: 0 }}>
        <div className="panel__header" style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <div className="panel__title">Critical Vulnerabilities Requiring Triage</div>
        </div>
        <VulnerabilityTable
          onRowClick={(vuln) => {
            setSelectedVuln(vuln);
            if (onVulnClick) onVulnClick(vuln);
          }}
        />
      </div>

      {selectedVuln && (
        <VulnerabilityModal vuln={selectedVuln} onClose={() => setSelectedVuln(null)} />
      )}

      {selectedThreat && (
        <ThreatModal threat={selectedThreat} onClose={() => setSelectedThreat(null)} />
      )}
    </div>
  );
}
