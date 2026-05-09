'use client';
import React from 'react';
import type { MissionRecord } from '@bifrost/shared';
import SlideOver from './SlideOver';
import { VerificationCheckRow } from '../../VerificationCheckRow';
import TrustDeltaCard from '../bubbles/TrustDeltaCard';
import TxLink from '../../solana/TxLink';

export interface DisputeSlideOverProps {
  open: boolean;
  onClose: () => void;
  mission: MissionRecord | null;
  onRebuild: () => Promise<void> | void;
  rebuilding: boolean;
}

export default function DisputeSlideOver({ open, onClose, mission, onRebuild, rebuilding }: DisputeSlideOverProps) {
  if (!mission) return <SlideOver open={open} onClose={onClose} title="Dispute" />;
  const failedChecks = mission.verificationChecks.filter((c) => c.status === 'failed');
  const passedChecks = mission.verificationChecks.filter((c) => c.status === 'passed');
  const negative = mission.reputationDeltas.filter((d) => d.delta < 0);
  const proofHash = mission.verificationReport?.proofHash;
  return (
    <SlideOver open={open} onClose={onClose} title="Dispute · receipt #1" subtitle="Verifier rejected the first build">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="Failed rules">
          {failedChecks.length === 0 ? (
            <Empty>None recorded.</Empty>
          ) : (
            failedChecks.map((c) => (
              <VerificationCheckRow key={c.id} label={c.label} passed={false} detail={c.detail} />
            ))
          )}
        </Section>
        {passedChecks.length > 0 && (
          <Section title={`Passed rules (${passedChecks.length})`}>
            {passedChecks.map((c) => (
              <VerificationCheckRow key={c.id} label={c.label} passed detail={c.detail} />
            ))}
          </Section>
        )}
        <Section title="Reputation slash (proportional, capped)">
          {negative.length === 0 ? (
            <Empty>No reputation deltas yet.</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {negative.map((d) => (
                <TrustDeltaCard
                  key={d.agentId}
                  agentName={lookup(mission, d.agentId)}
                  before={d.before}
                  delta={d.delta}
                  reason={d.rationale}
                />
              ))}
            </div>
          )}
        </Section>
        <Section title="Receipt">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            <div>
              Proof hash:{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                {proofHash ?? 'pending'}
              </span>
            </div>
            {(mission.proof?.txHashes ?? []).slice(0, 4).map((sig, idx) => (
              <TxLink key={`${sig}-${idx}`} signature={sig} cluster="devnet" label={`tx${idx + 1}`} short />
            ))}
          </div>
        </Section>
        <button
          type="button"
          onClick={() => void onRebuild()}
          disabled={rebuilding}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid var(--accent)',
            background: 'oklch(0.78 0.16 75 / 0.22)',
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            cursor: rebuilding ? 'not-allowed' : 'pointer',
            opacity: rebuilding ? 0.6 : 1,
          }}
        >
          {rebuilding ? 'Rebuilding…' : 'Rebuild (free) ↗'}
        </button>
      </div>
    </SlideOver>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{children}</div>;
}

function lookup(mission: MissionRecord, agentId: string): string {
  return (
    mission.agents.find((a) => a.id === agentId)?.name ??
    mission.registry.find((a) => a.id === agentId)?.name ??
    agentId
  );
}
