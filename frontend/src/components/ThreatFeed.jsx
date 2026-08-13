import { Globe, Zap, Bug, Eye, Lock } from 'lucide-react';

const MOCK_THREATS = [
  { id: 1, icon: Globe, iconColor: 'var(--critical)', iconBg: 'rgba(239, 68, 68, 0.12)', title: 'Ransomware Campaign Detected', desc: 'LockBit 3.0 affiliate observed targeting financial sector with exposed RDP endpoints.', time: '4m ago' },
  { id: 2, icon: Zap, iconColor: 'var(--high)', iconBg: 'rgba(249, 115, 22, 0.12)', title: 'Zero-Day PoC Released', desc: 'Exploit code published for ScreenConnect Auth Bypass (CVE-2024-1709).', time: '18m ago' },
  { id: 3, icon: Bug, iconColor: 'var(--accent-purple)', iconBg: 'rgba(139, 92, 246, 0.12)', title: 'APT29 Activity Spike', desc: 'Cozy Bear spearphishing campaign observed utilizing malicious OAuth applications.', time: '1h ago' },
  { id: 4, icon: Eye, iconColor: 'var(--accent-cyan)', iconBg: 'rgba(6, 182, 212, 0.12)', title: 'Credential Leak Monitoring', desc: '42 corporate email credentials exposed in breach database update.', time: '3h ago' },
  { id: 5, icon: Lock, iconColor: 'var(--low)', iconBg: 'rgba(34, 197, 94, 0.12)', title: 'SSL Cert Revocation Alert', desc: 'Expired SSL certificate detected on staging API endpoint.', time: '5h ago' },
];

export default function ThreatFeed({ onItemClick }) {
  return (
    <div className="threat-feed">
      {MOCK_THREATS.map((t) => {
        const Icon = t.icon;
        return (
          <div
            key={t.id}
            className="threat-item"
            onClick={() => onItemClick && onItemClick(t)}
            style={{ cursor: 'pointer' }}
          >
            <div className="threat-item__icon" style={{ background: t.iconBg, color: t.iconColor }}>
              <Icon size={16} />
            </div>
            <div className="threat-item__content">
              <div className="threat-item__header">
                <span className="threat-item__title">{t.title}</span>
                <span className="threat-item__time">{t.time}</span>
              </div>
              <p className="threat-item__desc">{t.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
