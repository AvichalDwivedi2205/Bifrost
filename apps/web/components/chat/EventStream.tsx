'use client';
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { MissionRecord } from '@bifrost/shared';
import type { Bubble } from './eventReducer';
import type { IntakeState } from '../../lib/intakeFlow';
import UserBubble from './bubbles/UserBubble';
import BifrostBubble from './bubbles/BifrostBubble';
import TeamReadyBubble from './bubbles/TeamReadyBubble';
import AgentBubble from './bubbles/AgentBubble';
import ClarificationBubble from './bubbles/ClarificationBubble';
import SpendBubble from './bubbles/SpendBubble';
import PreviewBubble from './bubbles/PreviewBubble';
import VerifierBubble from './bubbles/VerifierBubble';
import DisputeBubble from './bubbles/DisputeBubble';
import RebuildBubble from './bubbles/RebuildBubble';
import SettlementBubble from './bubbles/SettlementBubble';

export interface EventStreamProps {
  mission: MissionRecord | null;
  bubbles: Bubble[];
  intake: IntakeState;
  mode: 'intake' | 'live';
  walletPending: boolean;
  onChipClick: (label: string) => void;
  onAnswerCheckpoint: (checkpointId: string, response: string) => Promise<void> | void;
  onOpenTeamReview: () => void;
  onOpenSpend: (approvalId: string) => void;
  onOpenDispute: () => void;
  onOpenPreview: (url: string, label?: string) => void;
  onRebuild: () => Promise<void> | void;
}

export default function EventStream({
  mission,
  bubbles,
  intake,
  mode,
  walletPending,
  onChipClick,
  onAnswerCheckpoint,
  onOpenTeamReview,
  onOpenSpend,
  onOpenDispute,
  onOpenPreview,
  onRebuild,
}: EventStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [pendingNew, setPendingNew] = useState(0);
  const lastBubbleCount = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    if (autoScroll) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setPendingNew(0);
    } else if (bubbles.length > lastBubbleCount.current) {
      setPendingNew((c) => c + (bubbles.length - lastBubbleCount.current));
    }
    lastBubbleCount.current = bubbles.length;
  }, [bubbles.length, autoScroll]);

  // Reset auto-scroll on intake history growth too.
  useEffect(() => {
    if (mode !== 'intake' || !containerRef.current) return;
    if (autoScroll) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [intake.history.length, mode, autoScroll]);

  const onScroll = () => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 120) {
      setAutoScroll(false);
    } else if (distanceFromBottom < 80) {
      setAutoScroll(true);
      setPendingNew(0);
    }
  };

  const snapToBottom = () => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
    setAutoScroll(true);
    setPendingNew(0);
  };

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        overflowY: 'auto',
        scrollBehavior: 'smooth',
        position: 'relative',
      }}
    >
      <AnimatePresence initial={false}>
        {mode === 'intake' &&
          intake.history.map((entry, idx) =>
            entry.from === 'user' ? (
              <UserBubble key={`intake-u-${idx}`} text={entry.text} timestamp={shortTime(entry.createdAt)} />
            ) : (
              <BifrostBubble
                key={`intake-b-${idx}`}
                text={entry.text}
                timestamp={shortTime(entry.createdAt)}
                chips={entry.chips?.map((c) => ({ label: c }))}
                onChipClick={(chip) => onChipClick(chip.label)}
              />
            ),
          )}
        {bubbles.map((b) => renderBubble(b, {
          mission,
          walletPending,
          onAnswerCheckpoint,
          onOpenTeamReview,
          onOpenSpend,
          onOpenDispute,
          onOpenPreview,
          onRebuild,
        }))}
      </AnimatePresence>
      {pendingNew > 0 && (
        <button
          type="button"
          onClick={snapToBottom}
          style={{
            position: 'sticky',
            bottom: 12,
            alignSelf: 'center',
            padding: '6px 14px',
            borderRadius: 999,
            border: '1px solid var(--accent)',
            background: 'oklch(0.78 0.16 75 / 0.18)',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ↓ {pendingNew} new
        </button>
      )}
    </div>
  );
}

function shortTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

interface DispatchCtx {
  mission: MissionRecord | null;
  walletPending: boolean;
  onAnswerCheckpoint: (id: string, response: string) => Promise<void> | void;
  onOpenTeamReview: () => void;
  onOpenSpend: (approvalId: string) => void;
  onOpenDispute: () => void;
  onOpenPreview: (url: string, label?: string) => void;
  onRebuild: () => Promise<void> | void;
}

function renderBubble(b: Bubble, ctx: DispatchCtx): React.ReactNode {
  switch (b.kind) {
    case 'user':
      return <UserBubble key={b.key} text={b.text} timestamp={shortTime(b.sortAt)} />;
    case 'bifrost':
      return (
        <BifrostBubble
          key={b.key}
          text={b.text}
          subtitle={b.subtitle}
          timestamp={shortTime(b.sortAt)}
          tone={b.tone}
        />
      );
    case 'teamReady':
      return (
        <TeamReadyBubble
          key={b.key}
          agents={b.agents}
          approved={b.approved}
          onReview={ctx.onOpenTeamReview}
        />
      );
    case 'agent':
      return (
        <AgentBubble
          key={b.key}
          agentId={b.agentId}
          agentName={b.agentName}
          role={b.role}
          icon={b.icon}
          status={b.status}
          currentPhaseLabel={b.currentPhaseLabel}
          detail={b.detail}
          messages={b.messages}
        />
      );
    case 'clarification':
      return (
        <ClarificationBubble
          key={b.key}
          checkpoint={b.checkpoint}
          onAnswer={ctx.onAnswerCheckpoint}
          pending={ctx.walletPending}
        />
      );
    case 'spend':
      return (
        <SpendBubble
          key={b.key}
          approval={b.approval}
          agentId={b.agentId}
          amount={b.amount}
          service={b.service}
          status={b.status}
          txSignature={b.txSignature}
          onOpen={ctx.onOpenSpend}
        />
      );
    case 'preview':
      return (
        <PreviewBubble
          key={b.key}
          previewUrl={b.previewUrl}
          label={b.label}
          onOpen={ctx.onOpenPreview}
        />
      );
    case 'verifier':
      return (
        <VerifierBubble
          key={b.key}
          pass={b.pass}
          state={b.state}
          checks={b.checks}
          report={b.report}
        />
      );
    case 'dispute':
      return (
        <DisputeBubble
          key={b.key}
          pass={b.pass}
          negativeDeltas={b.negativeDeltas}
          checks={b.checks}
          mission={ctx.mission}
          onRebuild={ctx.onRebuild}
          onView={ctx.onOpenDispute}
          rebuilding={ctx.walletPending}
        />
      );
    case 'rebuild':
      return <RebuildBubble key={b.key} />;
    case 'settlement':
      return (
        <SettlementBubble
          key={b.key}
          amount={b.amount}
          txSignature={b.txSignature}
          positiveDeltas={b.positiveDeltas}
          mission={ctx.mission}
        />
      );
    default:
      return null;
  }
}
