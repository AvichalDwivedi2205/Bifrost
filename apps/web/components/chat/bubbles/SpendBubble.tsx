'use client';
import React from 'react';
import type { SpendApprovalRequest } from '@bifrost/shared';
import BubbleShell from './BubbleShell';
import TxLink from '../../solana/TxLink';

export interface SpendBubbleProps {
  approval?: SpendApprovalRequest;
  agentId?: string;
  amount?: number;
  service?: string;
  status: 'pending' | 'approved' | 'rejected';
  txSignature?: string;
  onOpen: (approvalId: string) => void;
}

export default function SpendBubble({ approval, agentId, amount, service, status, txSignature, onOpen }: SpendBubbleProps) {
  const tone = status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'bifrost';
  const subtitle =
    status === 'approved'
      ? 'Approved & signed on-chain'
      : status === 'rejected'
        ? 'Rejected'
        : 'Awaiting human approval';
  const id = approval?.id ?? '';
  const a = approval?.amount ?? amount ?? 0;
  const svc = approval?.service ?? service;
  const ag = approval?.agentId ?? agentId;
  return (
    <BubbleShell
      side="left"
      tone={tone}
      title={`Spend approval`}
      subtitle={subtitle}
      avatar={<span aria-hidden>$</span>}
      muted={status !== 'pending'}
      width="min(640px, 100%)"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
            ${a.toFixed(2)} USDC
          </span>
          {svc && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {svc}</span>}
          {ag && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>by {ag}</span>}
        </div>
        {txSignature && (
          <div style={{ fontSize: 11 }}>
            <TxLink signature={txSignature} cluster="devnet" label="spend tx" short />
          </div>
        )}
        {status === 'pending' && id && (
          <button
            type="button"
            onClick={() => onOpen(id)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--accent)',
              background: 'oklch(0.78 0.16 75 / 0.18)',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Approve spend ↗
          </button>
        )}
      </div>
    </BubbleShell>
  );
}
