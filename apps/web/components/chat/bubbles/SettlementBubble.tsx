'use client';
import React from 'react';
import type { ReputationDelta, MissionRecord } from '@bifrost/shared';
import BubbleShell from './BubbleShell';
import TxLink from '../../solana/TxLink';
import TrustDeltaCard from './TrustDeltaCard';

export interface SettlementBubbleProps {
  amount: number;
  txSignature?: string;
  positiveDeltas: ReputationDelta[];
  mission: MissionRecord | null;
}

export default function SettlementBubble({ amount, txSignature, positiveDeltas, mission }: SettlementBubbleProps) {
  return (
    <BubbleShell
      side="left"
      tone="success"
      title="Settled"
      subtitle="Settlement + reputation update written in one atomic finalize_allocation tx"
      avatar={<span aria-hidden>✓</span>}
      width="min(640px, 100%)"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ok)' }}>
            +{amount.toFixed(2)} USDC
          </span>
          {txSignature && <TxLink signature={txSignature} cluster="devnet" label="settle tx" short />}
        </div>
        {positiveDeltas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {positiveDeltas.slice(0, 4).map((d) => (
              <TrustDeltaCard
                key={d.agentId}
                agentName={lookupAgentName(d.agentId, mission)}
                before={d.before}
                delta={d.delta}
                reason={d.rationale}
              />
            ))}
            {positiveDeltas.length > 4 && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>+{positiveDeltas.length - 4} more</div>
            )}
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
