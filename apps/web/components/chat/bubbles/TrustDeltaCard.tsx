'use client';
import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { trustNumberSpring, arrowPulse } from '../bubbleVariants';

export interface TrustDeltaCardProps {
  agentName: string;
  before: number;
  delta: number;
  reason?: string;
}

export default function TrustDeltaCard({ agentName, before, delta, reason }: TrustDeltaCardProps) {
  const after = before + delta;
  const motionVal = useMotionValue(before);
  const spring = useSpring(motionVal, trustNumberSpring);
  const display = useTransform(spring, (v) => v.toFixed(1));
  useEffect(() => {
    motionVal.set(after);
  }, [after, motionVal]);

  const isNegative = delta < 0;
  const isZero = delta === 0;
  const arrow = isNegative ? '▼' : isZero ? '─' : '▲';
  const color = isNegative ? 'var(--danger)' : isZero ? 'var(--text-muted)' : 'var(--ok)';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto auto',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 10,
        border: '1px solid var(--hairline)',
        background: 'oklch(0.13 0.01 260 / 0.55)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text)' }}>{agentName}</span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {before.toFixed(1)}
      </span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        →
      </span>
      <motion.span
        className="mono"
        initial={isNegative ? { color: 'var(--danger)' } : { color }}
        animate={{ color, transition: { duration: 0.6, delay: isNegative ? 0.4 : 0 } }}
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        {display}
      </motion.span>
      <motion.span
        variants={arrowPulse}
        initial="initial"
        animate={isZero ? 'initial' : 'pulse'}
        style={{ fontSize: 12, color }}
      >
        {arrow} {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
      </motion.span>
      {reason && (
        <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{reason}</div>
      )}
    </div>
  );
}
