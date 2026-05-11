'use client';
import React from 'react';
import BubbleShell from './BubbleShell';

export interface BifrostChip {
  label: string;
  value?: string;
}

export interface BifrostBubbleProps {
  text: string;
  title?: string;
  subtitle?: string;
  timestamp?: string;
  chips?: BifrostChip[];
  onChipClick?: (chip: BifrostChip) => void;
  tone?: 'bifrost' | 'system' | 'success' | 'danger';
  typing?: boolean;
}

export function BifrostBubble({
  text,
  title = 'Bifrost',
  subtitle,
  timestamp,
  chips,
  onChipClick,
  tone = 'bifrost',
  typing = false,
}: BifrostBubbleProps) {
  return (
    <BubbleShell
      side="left"
      tone={tone}
      timestamp={timestamp}
      title={title}
      subtitle={subtitle}
      avatar={<span aria-hidden>◇</span>}
      width="min(640px, 100%)"
    >
      {typing ? (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 2px' }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--accent)',
              opacity: 0.7,
              animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
          <style>{`
            @keyframes typingDot {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
              30% { transform: translateY(-6px); opacity: 1; }
            }
          `}</style>
        </div>
      ) : (
        <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
      )}
      {chips && chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {chips.map((chip, idx) => (
            <button
              key={`${chip.label}-${idx}`}
              type="button"
              onClick={onChipClick ? () => onChipClick(chip) : undefined}
              disabled={!onChipClick}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid var(--hairline-strong)',
                background: 'oklch(0.78 0.16 75 / 0.10)',
                color: 'var(--text)',
                fontSize: 12,
                cursor: onChipClick ? 'pointer' : 'default',
                transition: 'all 0.15s var(--ease)',
              }}
              onMouseEnter={(e) => {
                if (!onChipClick) return;
                (e.currentTarget as HTMLElement).style.background = 'oklch(0.78 0.16 75 / 0.22)';
              }}
              onMouseLeave={(e) => {
                if (!onChipClick) return;
                (e.currentTarget as HTMLElement).style.background = 'oklch(0.78 0.16 75 / 0.10)';
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </BubbleShell>
  );
}

export default BifrostBubble;
