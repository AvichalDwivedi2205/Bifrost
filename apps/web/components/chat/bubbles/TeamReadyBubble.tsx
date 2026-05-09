'use client';
import React from 'react';
import { motion } from 'framer-motion';
import BubbleShell from './BubbleShell';
import TxLink from '../../solana/TxLink';
import { staggerParent, staggerChild } from '../bubbleVariants';
import type { TeamReadyAgent } from '../eventReducer';

export interface TeamReadyBubbleProps {
  agents: TeamReadyAgent[];
  approved: boolean;
  onReview: () => void;
}

export default function TeamReadyBubble({ agents, approved, onReview }: TeamReadyBubbleProps) {
  return (
    <BubbleShell
      side="left"
      tone="bifrost"
      title="Team ready"
      subtitle={
        approved
          ? `${agents.length} agents launched`
          : `${agents.length} agents proposed · review and sign to launch`
      }
      avatar={<span aria-hidden>◇</span>}
      muted={approved}
      width="min(640px, 100%)"
    >
      <motion.ul
        variants={staggerParent}
        initial="hidden"
        animate="visible"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {agents.map((agent) => (
          <motion.li
            key={agent.id}
            variants={staggerChild}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto auto',
              alignItems: 'center',
              gap: 10,
              padding: '6px 8px',
              borderRadius: 8,
              background: 'oklch(0.14 0.012 260 / 0.45)',
              border: '1px solid var(--hairline)',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'oklch(0.78 0.16 75 / 0.18)',
                color: 'var(--accent)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {agent.icon ?? agent.name[0]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{agent.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {agent.role}
              </span>
            </div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              trust {agent.trustScore}
            </span>
            <TxLink
              signature={agent.agentRegistryPda}
              cluster="devnet"
              kind="address"
              label="registry"
              short
            />
          </motion.li>
        ))}
      </motion.ul>
      {!approved && (
        <button
          type="button"
          onClick={onReview}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--accent)',
            background: 'oklch(0.78 0.16 75 / 0.18)',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Review team & sign launch ↗
        </button>
      )}
    </BubbleShell>
  );
}
