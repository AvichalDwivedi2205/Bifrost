'use client';
import React from 'react';
import BubbleShell from './BubbleShell';

export interface PreviewBubbleProps {
  previewUrl: string;
  label: string;
  onOpen: (url: string, label?: string) => void;
}

export default function PreviewBubble({ previewUrl, label, onOpen }: PreviewBubbleProps) {
  return (
    <BubbleShell
      side="left"
      tone="success"
      title="Preview ready"
      subtitle={previewUrl}
      avatar={<span aria-hidden>◧</span>}
      width="min(640px, 100%)"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text)' }}>{label}</div>
        <button
          type="button"
          onClick={() => onOpen(previewUrl, label)}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid var(--ok)',
            background: 'oklch(0.16 0.05 145 / 0.25)',
            color: 'var(--ok)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          Open preview ↗
        </button>
      </div>
    </BubbleShell>
  );
}
