'use client';
import React, { useState } from 'react';
import type { AgentMessage, AgentMessageType, AgentMessageStatus } from '@bifrost/shared';
import { Card, Pill, Btn } from '@/components/ui/primitives';

interface AgentCommsThreadProps {
  messages: AgentMessage[];
  agents?: Array<{ id: string; name: string; role?: string }>;
  onResolve?: (messageId: string, content: string) => void | Promise<void>;
  isResolving?: boolean;
  emptyHint?: string;
  readOnly?: boolean;
}

const TYPE_ICONS: Record<AgentMessageType, string> = {
  question: '?',
  answer: '→',
  challenge: '!',
  evidence_request: '◆',
  clarification: '…',
  decision: '◎',
  payment_request: '¤',
};

const STATUS_TONES: Record<AgentMessageStatus, string> = {
  open: 'warn',
  answered: 'ok',
  resolved: 'ok',
  blocked: 'danger',
};

function AgentInitial({ agentId }: { agentId: string }) {
  const initial = agentId.charAt(0).toUpperCase();
  return (
    <div style={{
      width: 36,
      height: 36,
      borderRadius: 999,
      background: 'color-mix(in oklch, var(--accent) 18%, transparent)',
      color: 'var(--accent)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 600,
      flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}

function MessageRow({
  message,
  onResolve,
  isResolving,
  readOnly,
}: {
  message: AgentMessage;
  onResolve?: (messageId: string, content: string) => void | Promise<void>;
  isResolving?: boolean;
  readOnly?: boolean;
}) {
  const [resolveText, setResolveText] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);

  const showForm = !readOnly && message.toAgentId === 'human' && message.status === 'open' && onResolve;
  const isCheckpoint = message.artifactRefs.some((ref) => ref.startsWith('checkpoint://'));
  const optionLines = isCheckpoint
    ? message.content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^\d+\.\s+/.test(line))
        .map((line) => line.replace(/^\d+\.\s+/, ''))
    : [];

  const handleResolve = async () => {
    if (!onResolve || !resolveText.trim()) return;
    try {
      await onResolve(message.id, resolveText);
      setResolveText('');
      setShowResolveForm(false);
    } catch (err) {
      console.error('Resolve failed:', err);
    }
  };

  return (
    <div style={{ borderBottom: '1px solid var(--hairline)', padding: '12px 16px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <AgentInitial agentId={message.fromAgentId} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 500,
            marginBottom: 6,
          }}>
            <span className="mono">{message.fromAgentId.slice(0, 8)}</span>
            <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
            <span className="mono">{message.toAgentId.slice(0, 8)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 6,
              background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--accent)',
            }}>
              <span>{TYPE_ICONS[message.type]}</span>
              <span style={{ textTransform: 'capitalize' }}>{message.type.replace(/_/g, ' ')}</span>
            </div>
            <Pill tone={STATUS_TONES[message.status] as any} style={{ marginLeft: 'auto' }}>
              {message.status}
            </Pill>
            {isCheckpoint && message.status === 'open' && (
              <Pill tone="pending" dot={false}>
                blocking
              </Pill>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, wordBreak: 'break-word' }}>
            {message.content}
          </div>
          {optionLines.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {optionLines.map((option) => (
                <span
                  key={option}
                  style={{
                    border: '1px solid var(--hairline)',
                    borderRadius: 7,
                    padding: '4px 7px',
                    color: 'var(--text-muted)',
                    background: 'var(--surface-2)',
                    fontSize: 11,
                  }}
                >
                  {option}
                </span>
              ))}
            </div>
          )}
          {message.artifactRefs.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
              Refs: {message.artifactRefs.join(', ')}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
          <textarea
            value={resolveText}
            onChange={(e) => setResolveText(e.target.value)}
            placeholder="Enter your response..."
            style={{
              width: '100%',
              padding: 8,
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              border: '1px solid var(--hairline)',
              borderRadius: 8,
              background: 'var(--surface-2)',
              color: 'var(--text)',
              minHeight: 60,
              marginBottom: 8,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              variant="primary"
              size="sm"
              disabled={isResolving || !resolveText.trim()}
              onClick={handleResolve}
            >
              {isResolving ? 'Resolving…' : 'Resolve'}
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              disabled={isResolving}
              onClick={() => {
                setShowResolveForm(false);
                setResolveText('');
              }}
            >
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {!showForm && showForm !== undefined && (
        <button
          onClick={() => setShowResolveForm(true)}
          style={{
            marginTop: 8,
            padding: 0,
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Reply
        </button>
      )}
    </div>
  );
}

export default function AgentCommsThread({
  messages,
  agents,
  onResolve,
  isResolving,
  emptyHint = 'No agent messages yet.',
  readOnly,
}: AgentCommsThreadProps) {
  const openCount = messages.filter((m) => m.status === 'open').length;

  return (
    <Card pad={0} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>Agent Comms</div>
        <Pill tone="default">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}, {openCount} open
        </Pill>
      </div>

      {messages.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          color: 'var(--text-dim)',
          fontSize: 12.5,
          textAlign: 'center',
        }}>
          {emptyHint}
        </div>
      ) : (
        <div style={{
          flex: 1,
          maxHeight: 480,
          overflowY: 'auto',
          paddingBottom: 8,
        }}>
          {messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              onResolve={onResolve}
              isResolving={isResolving}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export { AgentCommsThread };
