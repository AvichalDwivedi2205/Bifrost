'use client';
import React from 'react';

interface AgentIconProps {
  size?: number;
  color?: string;
}

export function IconNews({ size = 28, color = 'currentColor' }: AgentIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="7" width="20" height="20" rx="2" />
      <path d="M24 11h4v14a2 2 0 0 1-2 2H8" />
      <path d="M8 12h12M8 16h12M8 20h8" />
      <circle cx="22" cy="4" r="1.5" fill={color} stroke="none">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function IconMarket({ size = 28, color = 'currentColor' }: AgentIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 26 L10 16 L15 21 L22 10 L29 16" />
      <circle cx="10" cy="16" r="2" fill={color} stroke="none" />
      <circle cx="22" cy="10" r="2" fill={color} stroke="none" />
      <path d="M3 26h26" opacity="0.4" />
      <path d="M24 6h5v5" opacity="0.6" />
    </svg>
  );
}

export function IconSkeptic({ size = 28, color = 'currentColor' }: AgentIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3 L27 9 L27 18 C27 23 22 27 16 29 C10 27 5 23 5 18 L5 9 Z" />
      <path d="M13 14 Q 16 11, 19 14 Q 16 17, 19 20 Q 16 23, 13 20" />
      <circle cx="16" cy="17" r="0.8" fill={color} stroke="none" />
    </svg>
  );
}

export function IconExecution({ size = 28, color = 'currentColor' }: AgentIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3 L28 16 L16 29 L4 16 Z" />
      <path d="M11 16 L15 20 L21 12" />
      <circle cx="16" cy="16" r="10" opacity="0.25" strokeDasharray="2 3" />
    </svg>
  );
}

export function IconVerifier({ size = 28, color = 'currentColor' }: AgentIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3 L27 9 L27 23 L16 29 L5 23 L5 9 Z" />
      <path d="M10 16 L14 20 L22 12" />
      <path d="M5 9 L16 15 L27 9" opacity="0.4" />
      <path d="M16 15 L16 29" opacity="0.4" />
    </svg>
  );
}

export function IconMission({ size = 28, color = 'currentColor' }: AgentIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="16" r="4" fill={color} opacity="0.3" stroke="none" />
      <circle cx="16" cy="16" r="4" />
      <circle cx="16" cy="16" r="9" opacity="0.5" strokeDasharray="1 3" />
      <circle cx="16" cy="16" r="13" opacity="0.3" strokeDasharray="1 4" />
      <path d="M16 3 L16 7 M16 25 L16 29 M3 16 L7 16 M25 16 L29 16" opacity="0.5" />
    </svg>
  );
}

export function IconResearch({ size = 28, color = 'currentColor' }: AgentIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14" cy="14" r="8" />
      <path d="M20 20 L28 28" />
      <path d="M10 14 L18 14 M14 10 L14 18" opacity="0.5" />
    </svg>
  );
}

export function IconRisk({ size = 28, color = 'currentColor' }: AgentIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3 L29 26 L3 26 Z" />
      <path d="M16 13 L16 20" />
      <circle cx="16" cy="23" r="0.8" fill={color} stroke="none" />
    </svg>
  );
}

export function IconCoordinator({ size = 28, color = 'currentColor' }: AgentIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="16" r="3" />
      <circle cx="6" cy="6" r="2.5" /><circle cx="26" cy="6" r="2.5" />
      <circle cx="6" cy="26" r="2.5" /><circle cx="26" cy="26" r="2.5" />
      <path d="M8 8 L13 13 M24 8 L19 13 M8 24 L13 19 M24 24 L19 19" />
    </svg>
  );
}

const ICONS: Record<string, React.ComponentType<AgentIconProps>> = {
  news: IconNews,
  market: IconMarket,
  skeptic: IconSkeptic,
  execution: IconExecution,
  verifier: IconVerifier,
  research: IconResearch,
  wallet_intelligence: IconResearch,
  risk: IconRisk,
  compliance: IconVerifier,
  coordinator: IconCoordinator,
  planner: IconCoordinator,
  custom: IconMission,
  hub: IconMission,
  mission: IconMission,
};

export function AgentIcon({ role, size = 24, color = 'currentColor' }: { role: string; size?: number; color?: string }) {
  const C = ICONS[role] || IconMission;
  return <C size={size} color={color} />;
}
