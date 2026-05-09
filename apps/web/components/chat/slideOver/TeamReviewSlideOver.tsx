'use client';
import React from 'react';
import type { MissionRecord } from '@bifrost/shared';
import SlideOver from './SlideOver';
import TxLink from '../../solana/TxLink';

export interface TeamReviewSlideOverProps {
  open: boolean;
  onClose: () => void;
  mission: MissionRecord | null;
  onSign: () => Promise<void> | void;
  signing: boolean;
  error: string | null;
}

export default function TeamReviewSlideOver({ open, onClose, mission, onSign, signing, error }: TeamReviewSlideOverProps) {
  if (!mission) {
    return (
      <SlideOver open={open} onClose={onClose} title="Loading mission" />
    );
  }
  const ids = mission.selectionProposal?.recommendedAgentIds ?? mission.selectedAgentIds ?? [];
  const pool = mission.agents.length > 0 ? mission.agents : mission.registry;
  const selectedAgents = ids
    .map((id) => pool.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);
  const totalBudget = mission.budget?.totalBudget ?? 0;
  return (
    <SlideOver open={open} onClose={onClose} title="Review your launch team" subtitle={mission.input.title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selectedAgents.map((agent) => (
            <li
              key={agent.id}
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px solid var(--hairline)',
                background: 'oklch(0.13 0.012 260 / 0.55)',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 12,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'oklch(0.78 0.16 75 / 0.18)',
                  color: 'var(--accent)',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                {agent.icon ?? agent.name[0]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{agent.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    trust {agent.trustScore}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {agent.role}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {agent.capabilities.slice(0, 4).join(' · ')}
                </div>
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  <TxLink
                    signature={(agent as { agentRegistryPda?: string }).agentRegistryPda}
                    cluster="devnet"
                    kind="address"
                    label="registry"
                    short
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: '1px solid var(--hairline)',
            background: 'oklch(0.14 0.01 260 / 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Treasury preview
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)' }}>
            Locking <span className="mono">${totalBudget.toFixed(2)} USDC</span> in the mission vault PDA. Agents are
            paid only on signed verifier passes; unspent funds refund to your wallet on settlement.
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
        <button
          type="button"
          onClick={() => void onSign()}
          disabled={signing}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid var(--accent)',
            background: 'oklch(0.78 0.16 75 / 0.22)',
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            cursor: signing ? 'not-allowed' : 'pointer',
            opacity: signing ? 0.6 : 1,
          }}
        >
          {signing ? 'Awaiting signature…' : 'Sign & launch with Phantom'}
        </button>
      </div>
    </SlideOver>
  );
}
