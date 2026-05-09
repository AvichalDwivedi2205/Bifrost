'use client';
import React, { useState } from 'react';
import type { AgentMessage, AgentRole } from '@bifrost/shared';
import BubbleShell from './BubbleShell';
import CurveLoader from '../../CurveLoader';

export interface AgentBubbleProps {
  agentId: string;
  agentName: string;
  role: AgentRole;
  icon?: string;
  status: 'idle' | 'running' | 'done' | 'failed';
  currentPhaseLabel?: string;
  detail?: string;
  messages: AgentMessage[];
}

export default function AgentBubble({
  agentName,
  role,
  icon,
  status,
  currentPhaseLabel,
  detail,
  messages,
}: AgentBubbleProps) {
  const [open, setOpen] = useState(false);
  const tone = status === 'failed' ? 'danger' : status === 'done' ? 'success' : 'agent';
  const statusLabel =
    status === 'running' ? 'running…' : status === 'done' ? 'done' : status === 'failed' ? 'failed' : 'idle';

  return (
    <BubbleShell
      side="left"
      tone={tone}
      title={agentName}
      subtitle={`${role} · ${statusLabel}`}
      avatar={<span aria-hidden>{icon ?? agentName[0]}</span>}
      width="min(640px, 100%)"
      muted={status === 'idle'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {currentPhaseLabel && <div style={{ fontSize: 13, color: 'var(--text)' }}>{currentPhaseLabel}</div>}
        {detail && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{detail}</div>}
        {status === 'running' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CurveLoader variant="wave" size={48} stroke="var(--accent)" />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>thinking…</span>
          </div>
        )}
        {messages.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                background: 'transparent',
                border: '1px dashed var(--hairline-strong)',
                borderRadius: 8,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              {open ? 'Hide' : 'Show'} agent comms ({messages.length})
            </button>
            {open && (
              <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {messages.map((m) => (
                  <li
                    key={m.id}
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: 'oklch(0.13 0.012 260 / 0.45)',
                      border: '1px solid var(--hairline)',
                    }}
                  >
                    <span style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.4, marginRight: 6 }}>
                      {m.type}
                    </span>
                    {m.content}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </BubbleShell>
  );
}
