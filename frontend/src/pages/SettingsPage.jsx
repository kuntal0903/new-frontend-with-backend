import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import {
  User, Shield, Key, Plug, Calendar, Bell, Palette,
  Users, AlertTriangle, Check, Copy, RefreshCw, Plus,
  Trash2, Eye, EyeOff, Mail, MessageSquare, Link2, Globe,
  ChevronRight, LogOut, Download, Cpu, X, CheckCircle,
} from 'lucide-react';

import '../styles/settings.css';

const NAV_SECTIONS = [
  { group: 'ACCOUNT',  items: [
    { id: 'profile',      label: 'Profile',       icon: User },
    { id: 'security',     label: 'Security',      icon: Shield },
    { id: 'api-keys',     label: 'API Keys',      icon: Key },
  ]},
  { group: 'PLATFORM', items: [
    { id: 'integrations', label: 'Integrations',  icon: Plug },
    { id: 'scan',         label: 'Scan Schedule', icon: Calendar },
    { id: 'notifications',label: 'Notifications', icon: Bell },
  ]},
  { group: 'SYSTEM',   items: [
    { id: 'appearance',   label: 'Appearance',    icon: Palette },
    { id: 'team',         label: 'Team',          icon: Users },
    { id: 'danger',       label: 'Danger Zone',   icon: AlertTriangle },
  ]},
];

const INITIAL_KEYS = [
  { id: 'k1', name: 'Production API Key',    value: 'asm_sk_prod_a8f2c9d1e4b7x9z',  created: '2024-06-01', lastUsed: '2m ago',  scopes: ['read', 'write', 'export'] },
  { id: 'k2', name: 'CI/CD Integration Key', value: 'asm_sk_ci_3e6f1a8b5c9d2w4', created: '2024-05-12', lastUsed: '1h ago',  scopes: ['read'] },
];

const INITIAL_INTEGRATIONS = [
  { id: 'splunk',      name: 'Splunk SIEM',      emoji: '🔍', desc: 'Stream events and findings to Splunk Enterprise or Cloud.',        status: 'connected', url: 'https://splunk.corp.internal:8088' },
  { id: 'jira',        name: 'Jira',             emoji: '🎯', desc: 'Auto-create tickets for new critical vulnerabilities.',            status: 'connected', url: 'https://jira.corp.internal' },
  { id: 'slack',       name: 'Slack',            emoji: '💬', desc: 'Post real-time alerts and digest summaries to channels.',          status: 'connected', url: 'https://hooks.slack.com/services/T00/B00/X00' },
];

const INITIAL_TEAM = [
  { id: 'u1', initials: 'AD', name: 'Alex Dawson',   email: 'alex.dawson@corp.internal',    role: 'admin',    status: 'active', joined: '2024-01-15', color: '#8b5cf6' },
  { id: 'u2', initials: 'PK', name: 'Priya Kumar',   email: 'priya.kumar@corp.internal',   role: 'analyst',  status: 'active', joined: '2024-02-10', color: '#3b82f6' },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const [toastMessage, setToastMessage]   = useState(null);

  const [keys, setKeys]                 = useState(INITIAL_KEYS);
  const [integrations, setIntegrations] = useState(INITIAL_INTEGRATIONS);
  const [team, setTeam]                 = useState(INITIAL_TEAM);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">
            Platform <span>Settings</span>
          </h1>
          <div className="page-header__subtitle">
            Manage account, security, integrations, and system preferences
          </div>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {NAV_SECTIONS.map(group => (
            <div key={group.group}>
              <div className="settings-nav__group-label">{group.group}</div>
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`settings-nav__item ${activeSection === item.id ? 'active' : ''}`}
                    onClick={() => scrollTo(item.id)}
                  >
                    <Icon size={15} />
                    {item.label}
                    <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="settings-content">
          <div className="settings-section" id="settings-profile">
            <h3>Profile & User Preferences</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              Manage your display name, role, and timezone preferences.
            </p>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="save-toast" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={15} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
