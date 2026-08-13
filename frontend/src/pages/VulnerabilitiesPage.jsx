import { useState, useMemo } from 'react';
import { Search, Download, ShieldAlert, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';
import VulnerabilityTable from '../components/VulnerabilityTable';
import VulnerabilityModal from '../components/VulnerabilityModal';

export default function VulnerabilitiesPage() {
  const [selectedVuln, setSelectedVuln] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedSev, setSelectedSev] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [minCvss, setMinCvss] = useState(0);
  const [toastMsg, setToastMsg] = useState(null);

  const filters = useMemo(() => ({
    severity: selectedSev === 'all' ? [] : [selectedSev],
    status: selectedStatus === 'all' ? [] : [selectedStatus],
    minCvss: minCvss,
    asset: search,
    patch: [],
  }), [selectedSev, selectedStatus, minCvss, search]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleExportCsv = () => {
    showToast('Exporting vulnerability remediation report CSV');
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
            Vulnerability <span>Management</span>
          </h1>
          <p className="page-header__subtitle">
            Track, prioritize, assign, and remediate security vulnerabilities across all endpoints.
          </p>
        </div>

        <div className="flex-gap-md">
          <button className="btn btn--ghost" onClick={handleExportCsv} aria-label="Export vulnerability report">
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Active Flaws</span>
            <ShieldAlert size={16} color="var(--critical)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--critical)', marginTop: 8 }}>14</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Unmitigated CVE items</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Critical Severity (CVSS &gt;= 9.0)</span>
            <AlertTriangle size={16} color="var(--high)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--high)', marginTop: 8 }}>4</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Immediate patch required</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>SLA Breaches</span>
            <Clock size={16} color="var(--medium)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--medium)', marginTop: 8 }}>1</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Over 14-day SLA deadline</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Mean Time to Remediate</span>
            <ShieldCheck size={16} color="var(--low)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--low)', marginTop: 8 }}>3.2 Days</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>18% faster than industry avg</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="s-input"
              placeholder="Search CVE ID or Asset name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34, width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Severity:</span>
            {['all', 'critical', 'high', 'medium'].map((sev) => (
              <button
                key={sev}
                className={`panel__action-btn ${selectedSev === sev ? 'active' : ''}`}
                onClick={() => setSelectedSev(sev)}
                style={{ textTransform: 'capitalize' }}
              >
                {sev}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Min CVSS: {minCvss.toFixed(1)}</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={minCvss}
              onChange={(e) => setMinCvss(parseFloat(e.target.value))}
              style={{ accentColor: 'var(--neon-blue)', cursor: 'pointer', width: 90 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
            <select className="s-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="mitigated">Mitigated</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <VulnerabilityTable
          filters={filters}
          onRowClick={(vuln) => setSelectedVuln(vuln)}
        />
      </div>

      {selectedVuln && (
        <VulnerabilityModal
          vuln={selectedVuln}
          onClose={() => setSelectedVuln(null)}
        />
      )}
    </div>
  );
}
