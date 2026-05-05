'use client';
import React from 'react';
import { Icon } from './icons';

// ── Pill ──────────────────────────────────────────────────────────────────────
type PillTone = 'default' | 'ok' | 'warn' | 'danger' | 'accent' | 'pending';

const PILL_TONES: Record<PillTone, { bg: string; fg: string; dot: string }> = {
  default: { bg: 'var(--surface-2)', fg: 'var(--text-muted)', dot: 'var(--text-dim)' },
  ok: { bg: 'color-mix(in oklch, var(--ok) 12%, transparent)', fg: 'var(--ok)', dot: 'var(--ok)' },
  warn: { bg: 'color-mix(in oklch, var(--warn) 14%, transparent)', fg: 'var(--warn)', dot: 'var(--warn)' },
  danger: { bg: 'color-mix(in oklch, var(--danger) 14%, transparent)', fg: 'var(--danger)', dot: 'var(--danger)' },
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)', dot: 'var(--accent)' },
  pending: { bg: 'color-mix(in oklch, var(--pending) 14%, transparent)', fg: 'var(--pending)', dot: 'var(--pending)' },
};

export function Pill({
  children,
  tone = 'default',
  dot = true,
  style,
}: {
  children: React.ReactNode;
  tone?: PillTone | string;
  dot?: boolean;
  style?: React.CSSProperties;
}) {
  const t = PILL_TONES[(tone as PillTone)] || PILL_TONES.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px',
      background: t.bg, color: t.fg, borderRadius: 999, fontSize: 11.5,
      fontWeight: 500, letterSpacing: '-0.01em', whiteSpace: 'nowrap', ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: t.dot, boxShadow: `0 0 8px ${t.dot}`, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'default' | 'primary' | 'ghost' | 'danger' | 'ok';
type BtnSize = 'sm' | 'md' | 'lg';

const BTN_SIZES = {
  sm: { pad: '6px 10px', fs: 12.5, h: 30, gap: 6, iconSize: 13 },
  md: { pad: '8px 14px', fs: 13.5, h: 36, gap: 8, iconSize: 14 },
  lg: { pad: '11px 18px', fs: 14.5, h: 44, gap: 10, iconSize: 16 },
};

const BTN_VARIANTS: Record<BtnVariant, React.CSSProperties> = {
  default: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--hairline-strong)' },
  primary: {
    background: 'linear-gradient(135deg, var(--plasma-2), var(--plasma-1))',
    color: 'white', border: '1px solid transparent',
    boxShadow: '0 1px 0 0 oklch(1 0 0 / 0.2) inset, 0 8px 24px -8px var(--plasma-1)',
  },
  ghost: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' },
  danger: {
    background: 'color-mix(in oklch, var(--danger) 10%, transparent)',
    color: 'var(--danger)', border: '1px solid color-mix(in oklch, var(--danger) 30%, transparent)',
  },
  ok: {
    background: 'color-mix(in oklch, var(--ok) 10%, transparent)',
    color: 'var(--ok)', border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)',
  },
};

export function Btn({
  children,
  variant = 'default',
  size = 'md',
  onClick,
  style,
  icon,
  href,
  disabled,
}: {
  children?: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  onClick?: () => void;
  style?: React.CSSProperties;
  icon?: string;
  href?: string;
  disabled?: boolean;
}) {
  const s = BTN_SIZES[size];
  const v = BTN_VARIANTS[variant];

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: s.gap, padding: s.pad, height: s.h, fontSize: s.fs,
    fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '-0.01em',
    borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
    userSelect: 'none', textDecoration: 'none',
    transition: 'all 0.2s var(--ease)', opacity: disabled ? 0.5 : 1,
    ...v, ...style,
  };

  if (href) {
    return <a href={href} style={baseStyle}>{icon && <Icon name={icon} size={s.iconSize} />}{children}</a>;
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (variant === 'ghost') (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (variant === 'ghost') (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {icon && <Icon name={icon} size={s.iconSize} />}
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({
  children,
  style,
  pad = 20,
  elev = false,
  glow = false,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  pad?: number | string;
  elev?: boolean;
  glow?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 16,
        padding: pad,
        boxShadow: glow ? 'var(--shadow-glow)' : elev ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'all 0.25s var(--ease)',
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Stat ──────────────────────────────────────────────────────────────────────
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em', color: tone || 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ── WalletAddr ────────────────────────────────────────────────────────────────
export function WalletAddr({ short = 'FZz7…8kMn' }: { short?: string }) {
  return (
    <span className="mono" style={{
      fontSize: 11.5, padding: '3px 8px', borderRadius: 6,
      background: 'var(--surface-2)', color: 'var(--text-muted)',
      border: '1px solid var(--hairline)',
    }}>
      {short}
    </span>
  );
}

// ── GridBackdrop ──────────────────────────────────────────────────────────────
export function GridBackdrop({ opacity = 1 }: { opacity?: number }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: `
        linear-gradient(var(--grid-line) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
      `,
      backgroundSize: '44px 44px',
      maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
      WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
      pointerEvents: 'none', opacity,
    }} />
  );
}
