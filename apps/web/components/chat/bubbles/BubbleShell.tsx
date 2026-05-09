'use client';
import React, { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { bubbleEnter, bubbleEnterReduced } from '../bubbleVariants';

export type BubbleTone =
  | 'bifrost'
  | 'agent'
  | 'system'
  | 'user'
  | 'danger'
  | 'success';

export type BubbleSide = 'left' | 'right';

export interface BubbleShellProps {
  side?: BubbleSide;
  tone?: BubbleTone;
  avatar?: ReactNode;
  title?: string;
  subtitle?: string;
  timestamp?: string;
  children: ReactNode;
  muted?: boolean;
  width?: number | string;
}

const TONE_BG: Record<BubbleTone, string> = {
  bifrost: 'oklch(0.16 0.018 80 / 0.85)',
  agent: 'oklch(0.16 0.014 260 / 0.78)',
  system: 'oklch(0.14 0.008 260 / 0.62)',
  user: 'oklch(0.78 0.16 75 / 0.16)',
  danger: 'oklch(0.16 0.06 30 / 0.55)',
  success: 'oklch(0.16 0.05 145 / 0.45)',
};

const TONE_BORDER: Record<BubbleTone, string> = {
  bifrost: 'oklch(0.78 0.16 75 / 0.32)',
  agent: 'var(--hairline)',
  system: 'var(--hairline)',
  user: 'oklch(0.78 0.16 75 / 0.45)',
  danger: 'oklch(0.65 0.18 30 / 0.55)',
  success: 'oklch(0.74 0.13 145 / 0.45)',
};

const TONE_ACCENT: Record<BubbleTone, string> = {
  bifrost: 'var(--accent)',
  agent: 'var(--text)',
  system: 'var(--text-muted)',
  user: 'var(--accent)',
  danger: 'var(--danger)',
  success: 'var(--ok)',
};

export function BubbleShell({
  side = 'left',
  tone = 'agent',
  avatar,
  title,
  subtitle,
  timestamp,
  children,
  muted = false,
  width = '100%',
}: BubbleShellProps) {
  const reduce = useReducedMotion();
  const variants = reduce ? bubbleEnterReduced : bubbleEnter;
  const isRight = side === 'right';
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      style={{
        display: 'flex',
        flexDirection: isRight ? 'row-reverse' : 'row',
        gap: 12,
        width: '100%',
        alignItems: 'flex-start',
      }}
    >
      {avatar && (
        <div
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: TONE_BG[tone],
            border: `1px solid ${TONE_BORDER[tone]}`,
            color: TONE_ACCENT[tone],
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {avatar}
        </div>
      )}
      <div
        style={{
          flex: 1,
          maxWidth: width,
          minWidth: 0,
          background: TONE_BG[tone],
          border: `1px solid ${TONE_BORDER[tone]}`,
          borderRadius: 14,
          padding: '12px 16px',
          opacity: muted ? 0.6 : 1,
          transition: 'opacity 0.3s var(--ease)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        {(title || timestamp) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: title ? 6 : 0,
            }}
          >
            {title && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  color: TONE_ACCENT[tone],
                  textTransform: 'uppercase',
                }}
              >
                {title}
              </div>
            )}
            {timestamp && (
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {timestamp}
              </div>
            )}
          </div>
        )}
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            {subtitle}
          </div>
        )}
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55 }}>{children}</div>
      </div>
    </motion.div>
  );
}

export default BubbleShell;
