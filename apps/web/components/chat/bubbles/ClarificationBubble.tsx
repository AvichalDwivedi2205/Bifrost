'use client';
import React, { useState } from 'react';
import type { HumanCheckpoint } from '@bifrost/shared';
import BubbleShell from './BubbleShell';

export interface ClarificationBubbleProps {
  checkpoint: HumanCheckpoint;
  onAnswer: (checkpointId: string, response: string) => Promise<void> | void;
  pending?: boolean;
}

export default function ClarificationBubble({ checkpoint, onAnswer, pending }: ClarificationBubbleProps) {
  const [freeform, setFreeform] = useState('');
  const isAnswered = checkpoint.status !== 'open';
  const tone = isAnswered ? 'system' : 'bifrost';

  return (
    <BubbleShell
      side="left"
      tone={tone}
      title={checkpoint.title || 'Human checkpoint'}
      subtitle={isAnswered ? 'Answered & signed' : 'Awaiting signed answer'}
      avatar={<span aria-hidden>?</span>}
      muted={isAnswered}
      width="min(640px, 100%)"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{checkpoint.prompt}</div>
        {isAnswered && checkpoint.response && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              background: 'oklch(0.16 0.05 145 / 0.18)',
              border: '1px solid oklch(0.74 0.13 145 / 0.4)',
              fontSize: 13,
              color: 'var(--text)',
            }}
          >
            <span style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 6 }}>
              answer
            </span>
            {checkpoint.response}
          </div>
        )}
        {!isAnswered && (
          <>
            {checkpoint.options && checkpoint.options.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {checkpoint.options.map((opt, idx) => (
                  <button
                    key={`${opt}-${idx}`}
                    type="button"
                    disabled={pending}
                    onClick={() => onAnswer(checkpoint.id, opt)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--accent)',
                      background: 'oklch(0.78 0.16 75 / 0.14)',
                      color: 'var(--text)',
                      fontSize: 13,
                      cursor: pending ? 'not-allowed' : 'pointer',
                      opacity: pending ? 0.6 : 1,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {checkpoint.freeformAllowed && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={freeform}
                  onChange={(e) => setFreeform(e.target.value)}
                  placeholder="Or write a custom answer…"
                  rows={2}
                  disabled={pending}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--hairline-strong)',
                    background: 'oklch(0.13 0.012 260 / 0.6)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    resize: 'none',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  disabled={pending || freeform.trim().length === 0}
                  onClick={() => {
                    void onAnswer(checkpoint.id, freeform.trim());
                    setFreeform('');
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--accent)',
                    background: 'oklch(0.78 0.16 75 / 0.18)',
                    color: 'var(--accent)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: pending ? 'not-allowed' : 'pointer',
                    opacity: pending || freeform.trim().length === 0 ? 0.5 : 1,
                  }}
                >
                  Sign answer ↗
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </BubbleShell>
  );
}
