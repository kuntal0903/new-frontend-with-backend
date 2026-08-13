import { useState, useMemo, useCallback } from 'react';
import {
  Globe, Search, AlertTriangle, ShieldCheck, Server, Lock, Radio,
  Download, Activity, RefreshCw, ExternalLink, Zap,
} from 'lucide-react';

const MOCK_SCAN_DATASETS = {
  'acme-corp.com': {
    domain: 'acme-corp.com',
    grade: 'A-',
    score: 88,
    ip: '104.21.44.180',
    registrar: 'Cloudflare Inc.',
    created: '2015-04-12',
    expires: '2027-04-12',
    subdomains: [
      { name: 'api.acme-corp.com', ip: '104.21.44.181', ports: [80, 443], status: '200 OK', tech: 'Node.js, Express', risk: 'Safe' },
      { name: 'app.acme-corp.com', ip: '104.21.44.182', ports: [80, 443], status: '200 OK', tech: 'React, Vite, Nginx', risk: 'Safe' },
      { name: 'staging.acme-corp.com', ip: '104.21.44.199', ports: [80, 443, 8080], status: '403 Forbidden', tech: 'Apache 2.4.41', risk: 'High' },
      { name: 'vpn.acme-corp.com', ip: '198.51.100.45', ports: [443, 1194], status: '200 OK', tech: 'OpenVPN 2.5', risk: 'Medium' },
      { name: 'mail.acme-corp.com', ip: '198.51.100.12', ports: [25, 465, 993], status: '200 OK', tech: 'Postfix, Dovecot', risk: 'Safe' },
      { name: 'dev-db.internal.acme-corp.com', ip: '192.168.1.104', ports: [5432], status: 'Connection Timeout', tech: 'PostgreSQL 14', risk: 'Critical' },
      { name: 'cdn.acme-corp.com', ip: '104.21.44.200', ports: [80, 443], status: '200 OK', tech: 'Cloudflare Edge', risk: 'Safe' },
    ],
    dns: [
      { type: 'A', name: '@', value: '104.21.44.180', ttl: 300, status: 'Valid' },
      { type: 'MX', name: '@', value: '10 mail.acme-corp.com', ttl: 3600, status: 'Valid' },
      { type: 'TXT', name: '@', value: 'v=spf1 include:_spf.google.com ~all', ttl: 3600, status: 'Valid' },
      { type: 'TXT', name: '_dmarc', value: 'v=DMARC1; p=reject; rua=mailto:dmarc@acme-corp.com', ttl: 3600, status: 'Optimal' },
      { type: 'NS', name: '@', value: 'ns1.cloudflare.com', ttl: 86400, status: 'Valid' },
      { type: 'NS', name: '@', value: 'ns2.cloudflare.com', ttl: 86400, status: 'Valid' },
    ],
    ssl: {
      issuer: "Cloudflare Inc ECC Domain Control",
      validFrom: "2026-01-10",
      validTo: "2027-01-10",
      daysLeft: 153,
      protocol: "TLS v1.3",
      cipher: "AEAD-AES256-GCM-SHA384",
      hsts: true,
      ocspStapling: true,
    },
    ports: [
      { port: 80, protocol: 'TCP', service: 'HTTP', state: 'Open', risk: 'Safe' },
      { port: 443, protocol: 'TCP', service: 'HTTPS', state: 'Open', risk: 'Safe' },
      { port: 8080, protocol: 'TCP', service: 'HTTP-Proxy', state: 'Open', risk: 'High' },
      { port: 1194, protocol: 'UDP', service: 'OpenVPN', state: 'Open', risk: 'Medium' },
      { port: 5432, protocol: 'TCP', service: 'PostgreSQL', state: 'Exposed', risk: 'Critical' },
    ]
  }
};

export default function DomainScanPage() {
  const [targetDomain, setTargetDomain] = useState('acme-corp.com');
  const [scanType, setScanType] = useState('full');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(100);
  const [activeTab, setActiveTab] = useState('subdomains');
  const [searchFilter, setSearchFilter] = useState('');
  const [consoleLogs, setConsoleLogs] = useState([
    { time: '16:30:00', text: 'Scan ready. Enter domain to perform real-time surface discovery.', type: 'info' }
  ]);
  const [scanResult, setScanResult] = useState(MOCK_SCAN_DATASETS['acme-corp.com']);

  const handleStartScan = useCallback(() => {
    if (!targetDomain.trim()) return;

    const cleanedDomain = targetDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    setIsScanning(true);
    setProgress(5);
    setConsoleLogs([
      { time: new Date().toLocaleTimeString(), text: `Initializing ${scanType.toUpperCase()} scan for [${cleanedDomain}]...`, type: 'info' }
    ]);

    let currentProgress = 5;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 15) + 10;

      if (currentProgress >= 25 && currentProgress < 50) {
        setConsoleLogs((prev) => [
          ...prev,
          { time: new Date().toLocaleTimeString(), text: `[DNS] Querying A, AAAA, MX, TXT, DMARC records...`, type: 'info' },
          { time: new Date().toLocaleTimeString(), text: `[SUBDOMAINS] Enumerating passive certificates & CT logs...`, type: 'info' }
        ]);
      } else if (currentProgress >= 50 && currentProgress < 75) {
        setConsoleLogs((prev) => [
          ...prev,
          { time: new Date().toLocaleTimeString(), text: `[SSL] Verifying TLS 1.3 Handshake & HSTS policy...`, type: 'success' },
          { time: new Date().toLocaleTimeString(), text: `[PORTS] Scanning top 100 exposed service ports...`, type: 'warning' }
        ]);
      } else if (currentProgress >= 75 && currentProgress < 100) {
        setConsoleLogs((prev) => [
          ...prev,
          { time: new Date().toLocaleTimeString(), text: `[RISK ENGINE] Correlating CVE threat intelligence database...`, type: 'info' }
        ]);
      }

      if (currentProgress >= 100) {
        clearInterval(interval);
        setProgress(100);
        setIsScanning(false);
        setConsoleLogs((prev) => [
          ...prev,
          { time: new Date().toLocaleTimeString(), text: `Scan completed successfully for ${cleanedDomain}.`, type: 'success' }
        ]);
      } else {
        setProgress(currentProgress);
      }
    }, 400);
  }, [targetDomain, scanType]);

  const filteredSubdomains = useMemo(() => {
    if (!scanResult?.subdomains) return [];
    if (!searchFilter.trim()) return scanResult.subdomains;
    const q = searchFilter.toLowerCase();
    return scanResult.subdomains.filter(
      (s) => s.name.toLowerCase().includes(q) || s.ip.includes(q) || s.tech.toLowerCase().includes(q)
    );
  }, [scanResult, searchFilter]);

  return (
    <div className="page-content domain-scan-container">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">
            Domain <span>Scan</span>
          </h1>
          <p className="page-header__subtitle">
            Perform real-time attack surface discovery, subdomain enumeration, and DNS/SSL vulnerability audits.
          </p>
        </div>
      </div>

      <div className="domain-scan-hero">
        <div className="domain-hero__header">
          <div className="domain-hero__title">
            <Globe size={22} color="var(--neon-blue)" />
            Target Domain Surface Reconnaissance
          </div>
        </div>

        <div className="domain-input-group" style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <input
            type="text"
            className="domain-input s-input"
            value={targetDomain}
            onChange={(e) => setTargetDomain(e.target.value)}
            placeholder="e.g. acme-corp.com"
            style={{ flex: 1 }}
          />
          <button className="btn btn--primary" onClick={handleStartScan} disabled={isScanning}>
            <Zap size={16} /> {isScanning ? 'Scanning...' : 'Launch Scan'}
          </button>
        </div>
      </div>

      {scanResult && (
        <div style={{ marginTop: 24 }}>
          <div className="domain-tab-list" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className={`panel__action-btn ${activeTab === 'subdomains' ? 'active' : ''}`} onClick={() => setActiveTab('subdomains')}>
              Subdomains ({scanResult.subdomains.length})
            </button>
            <button className={`panel__action-btn ${activeTab === 'dns' ? 'active' : ''}`} onClick={() => setActiveTab('dns')}>
              DNS ({scanResult.dns.length})
            </button>
          </div>

          {activeTab === 'subdomains' && (
            <div className="panel" style={{ padding: 0 }}>
              <table className="vuln-table">
                <thead>
                  <tr>
                    <th>Subdomain</th>
                    <th>IP Address</th>
                    <th>Tech Stack</th>
                    <th>Exposure Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubdomains.map((sub, idx) => (
                    <tr key={idx}>
                      <td className="mono" style={{ color: 'var(--neon-blue)', fontWeight: 600 }}>{sub.name}</td>
                      <td className="mono">{sub.ip}</td>
                      <td>{sub.tech}</td>
                      <td><span className={`severity-badge severity-badge--${sub.risk.toLowerCase()}`}>{sub.risk}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
