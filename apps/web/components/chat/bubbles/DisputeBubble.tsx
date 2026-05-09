'use client';
import React from 'react';
import type { ReputationDelta, VerificationCheck, MissionRecord } from '@bifrost/shared';
import BubbleShell from './BubbleShell';
import TrustDeltaCard from './TrustDeltaCard';

export interface DisputeBubbleProps {
  pass: number;
  negativeDeltas: ReputationDelta[];
  checks: VerificationCheck[];
  mission: MissionRecord | null;
  onRebuild: () => Promise<void> | void;
  onView: () => void;
  rebuilding: boolean;
}

export default function DisputeBubble({ pass, negativeDeltas, checks, mission, onRebuild, onView, rebuilding }: DisputeBubbleProps) {
  const failed = (checks ?? []).filter((c) => c.status === 'failed');
  const firstFailure = failed[0];
  const cap = mission?.budget?.totalBudget ?? 0;
  return (
    <BubbleShell
      side="left"
      tone="danger"
      title={`Dispute · pass ${pass}`}
      subtitle="Policy: free rebuild authorized · reputation slashed proportionally"
      avatar={<span aria-hidden>!</span>}
      width="min(640px, 100%)"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {firstFailure && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              background: 'oklch(0.16 0.06 30 / 0.45)',
              border: '1px solid oklch(0.65 0.18 30 / 0.6)',
              fontSize: 12,
              color: 'var(--text)',
            }}
          >
            <span style={{ color: 'var(--danger)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 6 }}>
              failed rule
            </span>
            {firstFailure.label}
            {firstFailure.detail && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{firstFailure.detail}</div>
            )}
          </div>
        )}
        {negativeDeltas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {negativeDeltas.slice(0, 4).map((d) => (
              <TrustDeltaCard
                key={d.agentId}
                agentName={lookupAgentName(d.agentId, mission)}
                before={d.before}
                delta={d.delta}
                reason={d.rationale}
              />
            ))}
            {negativeDeltas.length > 4 && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>+{negativeDeltas.length - 4} more</div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void onRebuild()}
            disabled={rebuilding}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--accent)',
              background: 'oklch(0.78 0.16 75 / 0.18)',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: rebuilding ? 'not-allowed' : 'pointer',
              opacity: rebuilding ? 0.6 : 1,
            }}
          >
            {rebuilding ? 'Rebuilding…' : 'Rebuild (free) ↗'}
          </button>
          <button
            type="button"
            onClick={onView}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--hairline-strong)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            View dispute
          </button>
        </div>
        {cap > 0 && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            Reputation deltas capped at ±0.4 inside disputed missions to prevent gaming.
          </div>
        )}
      </div>
    </BubbleShell>
  );
}

function lookupAgentName(agentId: string, mission: MissionRecord | null): string {
  if (!mission) return agentId;
  return (
    mission.agents.find((a) => a.id === agentId)?.name ??
    mission.registry.find((a) => a.id === agentId)?.name ??
    agentId
  );
}
