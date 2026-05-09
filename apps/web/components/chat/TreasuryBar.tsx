'use client';
import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { MissionRecord } from '@bifrost/shared';
import { treasuryNumberSpring } from './bubbleVariants';

export interface TreasuryBarProps {
  mission: MissionRecord | null;
}

export default function TreasuryBar({ mission }: TreasuryBarProps) {
  if (!mission) return null;
  const total = mission.budget?.totalBudget ?? 0;
  const spent = mission.budget?.spent ?? 0;
  const remaining = Math.max(0, total - spent);

  return (
    <div
      role="status"
      aria-label="Mission treasury"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: '10px 16px',
        background: 'oklch(0.10 0.012 260 / 0.78)',
        borderBottom: '1px solid var(--hairline)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Treasury
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
            <AnimatedAmount value={remaining} suffix={` / ${formatCurrency(total)} USDC`} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <Bar spent={spent} total={total} />
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
          spent {formatCurrency(spent)}
        </div>
      </div>
    </div>
  );
}

function AnimatedAmount({ value, suffix }: { value: number; suffix?: string }) {
  const motionVal = useMotionValue(value);
  const spring = useSpring(motionVal, treasuryNumberSpring);
  const display = useTransform(spring, (v) => formatCurrency(v));
  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <motion.span>{display}</motion.span>
      {suffix && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>{suffix}</span>}
    </span>
  );
}

function Bar({ spent, total }: { spent: number; total: number }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const next = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
    setPct(next);
  }, [spent, total]);
  return (
    <div
      style={{
        width: '100%',
        height: 6,
        borderRadius: 999,
        background: 'oklch(0.18 0.014 260 / 0.7)',
        overflow: 'hidden',
        border: '1px solid var(--hairline)',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--plasma-2), var(--plasma-4))',
          transition: 'width 0.6s var(--ease)',
        }}
      />
    </div>
  );
}

function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}
