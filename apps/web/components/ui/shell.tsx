'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMenu } from '../wallet-menu';
import { Icon, Logo } from './icons';
import { useTheme } from './theme-provider';

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Missions',
    items: [
      { id: '/missions/new', label: 'New mission', icon: 'plus' },
      { id: '/missions', label: 'Missions', icon: 'history' },
    ],
  },
  {
    label: 'Agents',
    items: [
      { id: '/agents', label: 'Registry', icon: 'grid' },
      { id: '/agents/apply', label: 'Apply', icon: 'user' },
    ],
  },
  {
    label: 'More',
    items: [{ id: '/insights', label: 'Insights', icon: 'chart' }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'var(--bg-elev)',
      borderRight: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      padding: '16px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 18px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text)' }}>
          <Logo />
        </Link>
        <button
          onClick={toggle}
          style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'transparent', border: '1px solid var(--hairline)',
            color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={13} />
        </button>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <div style={{
              fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--text-dim)', fontWeight: 500, padding: '0 10px 8px',
            }}>
              {section.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {section.items.map(item => {
                const active = pathname === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8,
                      fontSize: 13.5, fontWeight: 450, letterSpacing: '-0.01em',
                      color: active ? 'var(--text)' : 'var(--text-muted)',
                      background: active ? 'var(--surface)' : 'transparent',
                      border: active ? '1px solid var(--hairline)' : '1px solid transparent',
                      textDecoration: 'none',
                      transition: 'all 0.15s var(--ease)',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <Icon name={item.icon} size={15} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
export function Topbar({
  title,
  subtitle,
  actions,
  pill,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  pill?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 28px', borderBottom: '1px solid var(--hairline)',
      background: 'color-mix(in oklch, var(--bg) 80%, transparent)',
      backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 5,
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em' }}>{title}</h1>
          {pill}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions}
        <div style={{
          borderLeft: '1px solid var(--hairline)',
          paddingLeft: 8,
          display: 'flex',
          alignItems: 'center',
        }}>
          <WalletMenu />
        </div>
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
export function Shell({
  children,
  title,
  subtitle,
  pill,
  actions,
  padBody = true,
  fillBody = false,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  pill?: React.ReactNode;
  actions?: React.ReactNode;
  padBody?: boolean;
  fillBody?: boolean;
}) {
  return (
    <div style={{ display: 'flex', height: fillBody ? '100vh' : 'auto', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <Topbar title={title} subtitle={subtitle} pill={pill} actions={actions} />
        <div
          style={{
            flex: 1,
            padding: padBody ? '24px 28px 48px' : 0,
            maxWidth: '100%',
            overflowX: 'hidden',
            display: fillBody ? 'flex' : 'block',
            flexDirection: fillBody ? 'column' : undefined,
            minHeight: 0,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
