import { Construction } from 'lucide-react';

const PAGE_META = {
  assets: {
    title: 'Asset Inventory',
    subtitle: 'Browse, search, and manage all discovered assets across your infrastructure.',
    color: 'var(--accent-blue)',
  },
  vulnerabilities: {
    title: 'Vulnerabilities',
    subtitle: 'Full vulnerability management lifecycle — triage, assign, and track remediation.',
    color: 'var(--critical)',
  },
  threats: {
    title: 'Threat Intelligence',
    subtitle: 'Real-time threat feeds, IOC matching, and adversary profiling.',
    color: 'var(--accent-purple)',
  },
  'domain-scan': {
    title: 'Domain Scan',
    subtitle: 'Automated subdomain discovery, DNS analysis, SSL audit, and attack surface enumeration.',
    color: 'var(--neon-blue)',
  },
  alerts: {
    title: 'Alerts',
    subtitle: 'Security event notifications, escalations, and response workflows.',
    color: 'var(--high)',
  },
  settings: {
    title: 'Settings',
    subtitle: 'API integrations, user management, scan schedules, and notification rules.',
    color: 'var(--accent-cyan)',
  },
};

export default function PlaceholderPage({ pageId }) {
  const meta = PAGE_META[pageId] || PAGE_META.settings;

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', gap: 24 }}>
      <div style={{
        width: 80, height: 80,
        background: `${meta.color}18`,
        border: `1px solid ${meta.color}40`,
        borderRadius: 'var(--radius-xl)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 30px ${meta.color}30`,
      }}>
        <Construction size={36} color={meta.color} />
      </div>

      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
          {meta.title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {meta.subtitle}
        </p>
      </div>
    </div>
  );
}
