'use client';
import React from 'react';
import type { MissionEvent, MissionRecord } from '@bifrost/shared';
import TxLink from '../solana/TxLink';

export interface ChainFooterProps {
  mission: MissionRecord | null;
}

interface Pill {
  slot: string;
  label: string;
  signature: string;
}

export default function ChainFooter({ mission }: ChainFooterProps) {
  if (!mission) return null;
  const pills = collectPills(mission);
  if (pills.length === 0) return null;
  return (
    <div
      role="status"
      aria-label="On-chain transactions"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: '8px 16px',
        background: 'oklch(0.10 0.012 260 / 0.78)',
        borderTop: '1px solid var(--hairline)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            paddingRight: 4,
          }}
        >
          Chain
        </span>
        {pills.map((p) => (
          <TxLink key={`${p.slot}:${p.signature}`} signature={p.signature} cluster="devnet" label={p.label} short />
        ))}
      </div>
    </div>
  );
}

function collectPills(mission: MissionRecord): Pill[] {
  const out: Pill[] = [];
  const seenSlots = new Set<string>();
  let verifyCount = 0;
  for (const event of mission.events) {
    const sig = readSig(event);
    if (!sig) continue;
    switch (event.type) {
      case 'MISSION_CREATED':
        if (!seenSlots.has('create')) {
          out.push({ slot: 'create', label: 'create', signature: sig });
          seenSlots.add('create');
        }
        break;
      case 'SPEND_APPROVED':
        out.push({ slot: `spend:${sig}`, label: 'spend', signature: sig });
        break;
      case 'SETTLEMENT_RELEASED':
        if (!seenSlots.has('settle')) {
          out.push({ slot: 'settle', label: 'settle', signature: sig });
          seenSlots.add('settle');
        }
        break;
      default:
        break;
    }
  }
  // Verifier txs from proof if available
  const txHashes = mission.proof?.txHashes ?? [];
  for (const sig of txHashes) {
    if (!sig || sig.length < 32) continue;
    verifyCount += 1;
    out.push({ slot: `verify:${verifyCount}`, label: `verify ${verifyCount}`, signature: sig });
  }
  return out;
}

function readSig(event: MissionEvent): string | undefined {
  const sig = (event as { txSignature?: string }).txSignature;
  if (!sig) return undefined;
  if (sig.length < 32) return undefined;
  return sig;
}
