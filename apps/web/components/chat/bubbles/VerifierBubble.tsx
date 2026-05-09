'use client';
import React from 'react';
import type { MissionVerificationReport, VerificationCheck } from '@bifrost/shared';
import BubbleShell from './BubbleShell';
import CurveLoader from '../../CurveLoader';
import VerifierCheckList from './VerifierCheckList';

export interface VerifierBubbleProps {
  pass: number;
  state: 'running' | 'approved' | 'rejected';
  checks: VerificationCheck[];
  report?: MissionVerificationReport;
}

export default function VerifierBubble({ pass, state, checks, report }: VerifierBubbleProps) {
  const tone = state === 'approved' ? 'success' : state === 'rejected' ? 'danger' : 'agent';
  const subtitle =
    state === 'running'
      ? 'Real LLM judge running on preview HTML…'
      : state === 'approved'
        ? `Approved · score ${(report?.score ?? 0).toFixed(2)}`
        : `Rejected · ${(checks ?? []).filter((c) => c.status === 'failed').length} failing rule(s)`;
  return (
    <BubbleShell
      side="left"
      tone={tone}
      title={`Verifier · pass ${pass}`}
      subtitle={subtitle}
      avatar={<span aria-hidden>✓</span>}
      width="min(640px, 100%)"
    >
      {state === 'running' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CurveLoader variant="wave" size={64} stroke="var(--accent)" />
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Fetching preview, validating rules…</span>
        </div>
      ) : (
        <VerifierCheckList checks={checks} />
      )}
    </BubbleShell>
  );
}
