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
  { id: 'total-assets', title: 'Total Managed Assets', value: '1,428', change: '+12% this week', trend: 'up', icon: Database, color: 'blue' },
  { id: 'critical-risks', title: 'Critical Risk Endpoints', value: '14', change: '-3 resolved today', trend: 'down', icon: ShieldAlert, color: 'red' },
  { id: 'health-score', title: 'Security Health Score', value: '88 / 100', change: '+4 pts increase', trend: 'up', icon: Shield, color: 'green' },
  { id: 'active-vulns', title: 'Active Vulnerabilities', value: '342', change: '14 critical open', trend: 'up', icon: Activity, color: 'purple' },
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
