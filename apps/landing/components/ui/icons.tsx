'use client';
import React from 'react';

const paths: Record<string, React.ReactNode> = {
  dash: <path d="M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  live: <path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/><path d="M12 7v5l3 2"/></>,
  grid: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>,
  chart: <path d="M3 3v18h18M7 15l4-4 3 3 6-6"/>,
  bolt: <path d="M13 2 4 14h7l-2 8 9-12h-7z"/>,
  wallet: <><path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2V7z"/><path d="M3 7V5a2 2 0 0 1 2-2h11v4"/><circle cx="17" cy="13.5" r="1.2" fill="currentColor" stroke="none"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>,
  arrow: <path d="M5 12h14M13 5l7 7-7 7"/>,
  check: <path d="M4 12l5 5L20 6"/>,
  x: <path d="M6 6l12 12M18 6L6 18"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
  filter: <path d="M4 5h16M7 12h10M10 19h4"/>,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>,
  stop: <rect x="5" y="5" width="14" height="14" rx="1.5"/>,
  download: <><path d="M12 3v13"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></>,
  chain: <><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07L11 5.93"/><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07L13 18.07"/></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z"/>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></>,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>,
  play: <path d="M6 4l14 8-14 8z"/>,
  flag: <><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>,
};

interface IconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  color?: string;
}

export function Icon({ name, size = 16, strokeWidth = 1.75, style, color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="bf-lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--plasma-1)" />
            <stop offset="50%" stopColor="var(--plasma-2)" />
            <stop offset="100%" stopColor="var(--plasma-4)" />
          </linearGradient>
        </defs>
        <path
          d="M4 26 L10 6 L16 18 L22 6 L28 26"
          stroke="url(#bf-lg)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="16" cy="18" r="2.4" fill="url(#bf-lg)" />
      </svg>
      <span style={{ fontWeight: 600, letterSpacing: '-0.02em', fontSize: 15 }}>
        Bi<span style={{ fontWeight: 400, opacity: 0.85 }}>frost</span>
      </span>
    </div>
  );
}
