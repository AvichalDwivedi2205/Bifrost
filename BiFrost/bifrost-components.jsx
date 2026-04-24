
// ── SHARED COMPONENTS ─────────────────────────────────────
// Logo, Sidebar, TopBar, shared UI atoms

const { useState, useEffect, useRef, useCallback } = React;

// ── LOGO MARK SVG ────────────────────────────────────────
function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-mark">
      <rect width="32" height="32" rx="8" fill="oklch(0.10 0.018 250)"/>
      {/* Bridge arc — Bifrost rainbow bridge motif */}
      <path d="M5 22 Q16 6 27 22" stroke="oklch(0.76 0.175 195)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <path d="M8 22 Q16 10 24 22" stroke="oklch(0.72 0.175 290)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M11 22 Q16 14 21 22" stroke="oklch(0.80 0.155 55)" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.7"/>
      {/* Ground line */}
      <line x1="4" y1="23.5" x2="28" y2="23.5" stroke="oklch(0.22 0.030 250)" strokeWidth="1"/>
      {/* Node dots */}
      <circle cx="5" cy="22" r="2" fill="oklch(0.76 0.175 195)"/>
      <circle cx="27" cy="22" r="2" fill="oklch(0.76 0.175 195)"/>
      <circle cx="16" cy="8.5" r="2.5" fill="oklch(0.80 0.155 55)" opacity="0.9"/>
    </svg>
  );
}

// ── NAV ICONS ────────────────────────────────────────────
const NavIcons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  mission: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  live: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.8"/>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
    </svg>
  ),
  history: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  registry: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="2" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="2" y="7" width="9" height="2" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="2" y="11" width="6" height="2" rx="1" fill="currentColor" opacity="0.7"/>
      <circle cx="13" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  analytics: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 12L5 8l3 2 3-5 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

// ── SIDEBAR ──────────────────────────────────────────────
function Sidebar({ currentPage, onNavigate }) {
  const sections = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      ]
    },
    {
      label: 'Missions',
      items: [
        { id: 'create',   label: 'New Mission',    icon: 'plus' },
        { id: 'live',     label: 'Live Execution', icon: 'live' },
        { id: 'history',  label: 'History',        icon: 'history' },
      ]
    },
    {
      label: 'Agents',
      items: [
        { id: 'registry', label: 'Registry', icon: 'registry' },
        { id: 'profile',  label: 'Profile',  icon: 'profile' },
      ]
    },
    {
      label: 'System',
      items: [
        { id: 'analytics', label: 'Analytics', icon: 'analytics' },
      ]
    },
  ];

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="logo-area">
        <LogoMark size={32} />
        <div>
          <div className="logo-text">Bi<span>Frost</span></div>
          <div className="logo-sub">Mission OS · Solana</div>
        </div>
      </div>

      {/* Nav */}
      <div className="nav-scroll">
        {sections.map(sec => (
          <div key={sec.label}>
            <div className="nav-section-label">{sec.label}</div>
            {sec.items.map(item => (
              <div
                key={item.id}
                className={`nav-item${currentPage === item.id ? ' active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <span className="nav-icon">{NavIcons[item.icon]}</span>
                {item.label}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Wallet card */}
      <div className="wallet-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="wallet-status-dot"></div>
            <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>WALLET</span>
          </div>
          <div className="wallet-net">Devnet</div>
        </div>
        <div className="wallet-addr">7xKp...3mFQ</div>
      </div>
    </div>
  );
}

// ── TOP BAR ──────────────────────────────────────────────
function TopBar({ title, badge, badgeType = 'devnet', children }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      {badge && (
        <div className={`topbar-badge badge-${badgeType}`}>
          {badgeType === 'live' && '● '}{badge}
        </div>
      )}
      {children}
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:16}}>
        <div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>
          {time.toLocaleTimeString('en-US', {hour12: false})} UTC
        </div>
        <div className="topbar-badge badge-devnet">SOL DEVNET</div>
      </div>
    </div>
  );
}

// ── KPI CARD ─────────────────────────────────────────────
function KpiCard({ label, value, delta, deltaDir = 'up', accent = 'var(--cyan)' }) {
  return (
    <div className="kpi-card" style={{'--accent-color': accent}}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && <div className={`kpi-delta ${deltaDir}`}>{deltaDir === 'up' ? '↑' : '↓'} {delta}</div>}
    </div>
  );
}

// ── STATUS PILL ───────────────────────────────────────────
function Pill({ status }) {
  const map = {
    settled:   { cls: 'pill-green',  label: 'Settled',   dot: 'var(--green)'  },
    running:   { cls: 'pill-cyan',   label: 'Running',   dot: 'var(--cyan)'   },
    verifying: { cls: 'pill-purple', label: 'Verifying', dot: 'var(--purple)' },
    pending:   { cls: 'pill-amber',  label: 'Pending',   dot: 'var(--amber)'  },
    failed:    { cls: 'pill-red',    label: 'Failed',    dot: 'var(--red)'    },
    active:    { cls: 'pill-green',  label: 'Active',    dot: 'var(--green)'  },
    paused:    { cls: 'pill-muted',  label: 'Paused',    dot: 'var(--text3)'  },
    selection_pending: { cls: 'pill-amber', label: 'Awaiting Approval', dot: 'var(--amber)' },
  };
  const m = map[status] || map['pending'];
  return (
    <span className={`pill ${m.cls}`}>
      <span className="pill-dot" style={{background: m.dot}}></span>
      {m.label}
    </span>
  );
}

// ── AGENT AVATAR ─────────────────────────────────────────
function AgentAvatar({ emoji, bg = 'var(--bg3)', border = 'var(--border)', ring, size = 36, fontSize = 16 }) {
  return (
    <div className={`agent-avatar${ring ? ' spinning' : ''}`}
      style={{
        width: size, height: size, background: bg,
        borderColor: border, fontSize,
        '--ring-color': ring,
        borderRadius: Math.round(size * 0.28)
      }}>
      {emoji}
    </div>
  );
}

// ── TX HASH ───────────────────────────────────────────────
function TxHash({ hash }) {
  const short = hash ? `${hash.slice(0,4)}…${hash.slice(-4)}` : '—';
  return <span className="tx-hash" title={hash}>{short}</span>;
}

// ── PROGRESS BAR ──────────────────────────────────────────
function ProgressBar({ pct, color = 'var(--cyan)', height = 4 }) {
  return (
    <div className="progress-bar" style={{height}}>
      <div className="progress-fill" style={{'--fill-color': color, width: `${Math.min(100,pct)}%`}}></div>
    </div>
  );
}

// ── SECTION HEADER ────────────────────────────────────────
function SectionHeader({ title, action, actionLabel }) {
  return (
    <div className="section-header">
      <div className="section-title">{title}</div>
      {action && (
        <button className="btn btn-ghost btn-sm" onClick={action}>{actionLabel}</button>
      )}
    </div>
  );
}

// Export everything to window
Object.assign(window, {
  LogoMark, Sidebar, TopBar, KpiCard, Pill, AgentAvatar, TxHash, ProgressBar, SectionHeader, NavIcons,
});
