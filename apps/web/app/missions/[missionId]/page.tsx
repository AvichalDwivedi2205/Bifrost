'use client';
import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import type {
  AgentMessage,
  AgentProfile,
  HumanCheckpoint,
  MissionAuthEnvelope,
  MissionRecord,
  PolicyCheckResult,
} from '@bifrost/shared';
import {
  buildHumanCheckpointAuthorizationMessage,
  buildSelectionAuthorizationMessage,
  buildSpendApprovalAuthorizationMessage,
  buildPaymentApprovalMemoMessage,
  demoMissionRecord,
} from '@bifrost/shared';
import { useWallet } from '@solana/wallet-adapter-react';
import { Shell } from '@/components/ui/shell';
import { Card, Btn, Pill } from '@/components/ui/primitives';
import { AgentIcon } from '@/components/ui/agent-icons';
import AgentCommsThread from '@/components/AgentCommsThread';
import { VerificationCheckRow } from '@/components/VerificationCheckRow';
import { MissionSpendSheet } from '@/components/MissionSpendSheet';
import { AGENTS } from '@/components/ui/data';
import {
  approveMissionSelection,
  answerHumanCheckpoint,
  fetchMission,
  fetchMissionMessages,
  resolveAgentMessage,
  resolveApiBaseUrl,
  resolveSpendApproval,
  subscribeToMission,
} from '@/lib/api';
import { APPROVAL_FLOW, buildSignedMemoBytes, encodeSignatureBase64 } from '@/lib/solana-tx';

// ─── helpers ────────────────────────────────────────────────────────────────

function derivePolicyChecks(
  approval: { amount: number },
  mission: MissionRecord,
): PolicyCheckResult {
  return {
    underMaxPerCall: approval.amount <= mission.budget.maxPerCall,
    serviceAllowlisted: true,
    humanApprovalRequired: approval.amount >= mission.budget.humanApprovalAbove,
    missionBudgetRemaining: mission.budget.remaining,
  };
}

const ROLE_COLORS: Record<string, string> = {
  coordinator: 'oklch(0.78 0.16 180)',
  planner: 'oklch(0.78 0.15 205)',
  news: 'oklch(0.78 0.14 75)',
  market: 'oklch(0.76 0.16 245)',
  skeptic: 'oklch(0.70 0.18 295)',
  research: 'oklch(0.72 0.13 250)',
  wallet_intelligence: 'oklch(0.70 0.13 210)',
  risk: 'oklch(0.65 0.20 25)',
  compliance: 'oklch(0.72 0.12 145)',
  execution: 'oklch(0.80 0.14 195)',
  verifier: 'oklch(0.72 0.14 155)',
  custom: 'oklch(0.76 0.13 320)',
};

function agentColor(agent: Pick<AgentProfile, 'role'>): string {
  return ROLE_COLORS[agent.role] ?? 'oklch(0.76 0.13 320)';
}

function agentPhases(agent: AgentProfile): string[] {
  return agent.phaseSchema.length
    ? agent.phaseSchema.map((p) => p.label)
    : ['queued', 'working'];
}

function eventTime(index: number): string {
  const minutes = Math.floor(index / 3);
  const seconds = String((index * 13) % 60).padStart(2, '0');
  return `00:${String(minutes).padStart(2, '0')}:${seconds}`;
}

function eventKind(type: string): string {
  return type.toLowerCase();
}

function statusTone(status: string): 'ok' | 'danger' | 'pending' | 'warn' | 'default' {
  if (status === 'settled') return 'ok';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'verifying') return 'warn';
  if (status === 'selection_pending' || status === 'awaiting_spend_approval' || status === 'awaiting_human_input') return 'pending';
  return 'default';
}

const STATIC_EVENTS = [
  { t: '00:00:04', kind: 'mission_created', msg: 'Mission authorized · budget 12 USDC locked', sig: '5Kv9…qP2x' },
  { t: '00:00:12', kind: 'selection_approved', msg: 'Agent lineup approved by authority wallet', sig: '3Nm2…vRj8' },
  { t: '00:00:18', kind: 'task_started', msg: 'task-news · Helios gathering headlines', sig: null },
  { t: '00:00:34', kind: 'spend_requested', msg: 'Helios → newsapi.io · 0.32 USDC', sig: null },
  { t: '00:00:41', kind: 'spend_approved', msg: 'Operator approved · fresh signature', sig: '9Kx4…tL1m' },
];

// ─── CopyButton ──────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      title={value}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        borderRadius: 5,
        border: '1px solid var(--hairline)',
        background: 'var(--surface-2)',
        color: copied ? 'var(--ok)' : 'var(--text-muted)',
        fontSize: 10.5,
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        transition: 'color 0.15s',
        marginLeft: 6,
        whiteSpace: 'nowrap',
        letterSpacing: 0,
      }}
    >
      {copied ? '✓ copied' : '⎘ copy'}
    </button>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      style={{ animation: 'spin-slow 1s linear infinite', flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="24" strokeDashoffset="8" />
    </svg>
  );
}

function HumanCheckpointCard({
  checkpoint,
  onAnswer,
  disabled,
}: {
  checkpoint: HumanCheckpoint;
  onAnswer: (checkpointId: string, responseText: string) => void;
  disabled?: boolean;
}) {
  const [freeform, setFreeform] = useState('');
  const canSendFreeform = checkpoint.freeformAllowed && freeform.trim().length > 0;
  return (
    <div style={{
      border: '1px solid var(--hairline)',
      background: 'var(--surface-2)',
      borderRadius: 8,
      padding: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{checkpoint.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>
            {checkpoint.prompt}
          </div>
        </div>
        <Pill tone={checkpoint.status === 'open' ? 'pending' : 'ok'} dot>
          {checkpoint.status === 'open' ? 'BLOCKING' : checkpoint.status.toUpperCase()}
        </Pill>
      </div>
      {checkpoint.options.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: checkpoint.freeformAllowed ? 10 : 0 }}>
          {checkpoint.options.map((option) => (
            <button
              key={option}
              disabled={disabled || checkpoint.status !== 'open'}
              onClick={() => onAnswer(checkpoint.id, option)}
              style={{
                border: '1px solid var(--hairline)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                borderRadius: 8,
                padding: '7px 10px',
                fontSize: 12,
                cursor: disabled ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {checkpoint.freeformAllowed && checkpoint.status === 'open' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={freeform}
            onChange={(event) => setFreeform(event.target.value)}
            placeholder="Custom answer"
            style={{
              flex: 1,
              minWidth: 0,
              border: '1px solid var(--hairline)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          />
          <Btn
            variant="default"
            size="sm"
            disabled={disabled || !canSendFreeform}
            onClick={() => canSendFreeform && onAnswer(checkpoint.id, freeform.trim())}
          >
            Send
          </Btn>
        </div>
      )}
      {checkpoint.response && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          Response: <span style={{ color: 'var(--text)' }}>{checkpoint.response}</span>
        </div>
      )}
    </div>
  );
}

// ─── Tab types ───────────────────────────────────────────────────────────────

type Tab = 'activity' | 'treasury' | 'agents' | 'verification' | 'chain';
const TABS: { id: Tab; label: string }[] = [
  { id: 'activity', label: 'Activity' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'agents', label: 'Agents' },
  { id: 'verification', label: 'Verification' },
  { id: 'chain', label: 'Chain' },
];

// ─── KV row ─────────────────────────────────────────────────────────────────

function KVRow({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const shortVal = value.length > 20 ? value.slice(0, 8) + '…' + value.slice(-6) : value;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid var(--hairline)',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span
          className={mono ? 'mono' : ''}
          style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all', textAlign: 'right' }}
          title={value}
        >
          {mono && value.length > 20 ? shortVal : value}
        </span>
        {copyable && value !== 'not configured' && value !== 'unknown' && (
          <CopyButton value={value} />
        )}
      </div>
    </div>
  );
}

// ─── Main content ────────────────────────────────────────────────────────────

function MissionCockpitContent() {
  const params = useParams<{ missionId: string }>();
  const missionId = params?.missionId ?? 'mission-demo-1';
  const { connected, publicKey, signMessage } = useWallet();

  const [tick, setTick] = useState(0);
  const [mission, setMission] = useState<MissionRecord>(demoMissionRecord);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isResolvingMessage, setIsResolvingMessage] = useState(false);
  const [isAnsweringCheckpoint, setIsAnsweringCheckpoint] = useState(false);
  const [isApprovingApproval, setIsApprovingApproval] = useState(false);
  const [isRejectingApproval, setIsRejectingApproval] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDismissed, setSheetDismissed] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Tick for agent animation
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, []);

  // Initial mission fetch
  useEffect(() => {
    if (!missionId || !resolveApiBaseUrl()) return;
    let cancelled = false;
    fetchMission(missionId)
      .then((m) => { if (!cancelled) setMission(m); })
      .catch((err) => setActionError(err instanceof Error ? err.message : 'Unable to load mission'));
    return () => { cancelled = true; };
  }, [missionId]);

  // Initial messages fetch
  useEffect(() => {
    if (!missionId || !resolveApiBaseUrl()) return;
    let cancelled = false;
    fetchMissionMessages(missionId)
      .then((msgs) => { if (!cancelled) setMessages(msgs); })
      .catch(() => { /* silently fail */ });
    return () => { cancelled = true; };
  }, [missionId]);

  // WebSocket subscription with reconnect-with-backoff
  useEffect(() => {
    if (!missionId || !resolveApiBaseUrl()) return;
    return subscribeToMission(missionId, {
      onMission: setMission,
      onMessages: setMessages,
    });
  }, [missionId]);

  // Auto-open spend sheet when first approval appears
  const prevApprovalIdRef = useRef<string | null>(null);
  useEffect(() => {
    const approvalId = mission.pendingSpendApprovals[0]?.id ?? null;
    if (approvalId && approvalId !== prevApprovalIdRef.current) {
      prevApprovalIdRef.current = approvalId;
      setSheetDismissed(false);
      setSheetOpen(true);
    }
    if (!approvalId) {
      prevApprovalIdRef.current = null;
      setSheetOpen(false);
      setSheetDismissed(false);
    }
  }, [mission.pendingSpendApprovals]);

  // ── signing helpers ───────────────────────────────────────────────────────

  const encodeBase64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));

  const signApproval = async (message: string, issuedAt: string): Promise<MissionAuthEnvelope | undefined> => {
    if (!resolveApiBaseUrl()) return undefined;
    if (!connected || !publicKey) throw new Error('Connect mission authority wallet.');
    if (publicKey.toBase58() !== mission.input.authorityWallet)
      throw new Error('Connected wallet is not mission authority.');
    if (!signMessage) throw new Error('Wallet does not support message signing.');
    const signatureBytes = await signMessage(new TextEncoder().encode(message));
    return { issuedAt, signature: encodeBase64(signatureBytes) };
  };

  const approveSelection = useCallback(async () => {
    const currentMissionId = missionId ?? mission.id;
    const chosen = mission.selectionProposal?.recommendedAgentIds ?? mission.selectedAgentIds;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const issuedAt = new Date().toISOString();
      const auth = await signApproval(
        buildSelectionAuthorizationMessage(currentMissionId, mission.input.authorityWallet, chosen, issuedAt),
        issuedAt,
      );
      const updated = await approveMissionSelection(currentMissionId, chosen, auth);
      setMission(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Agent selection approval failed');
    } finally {
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, mission]);

  const resolveApproval = useCallback(async (approvalId: string, approve: boolean) => {
    const currentMissionId = missionId ?? mission.id;
    setActionError(null);
    approve ? setIsApprovingApproval(true) : setIsRejectingApproval(true);
    try {
      const issuedAt = new Date().toISOString();
      const auth = await signApproval(
        buildSpendApprovalAuthorizationMessage(
          currentMissionId,
          mission.input.authorityWallet,
          approvalId,
          approve,
          issuedAt,
        ),
        issuedAt,
      );

      let txSignature: string | undefined;
      if (approve) {
        const approval = mission.pendingSpendApprovals[0];
        if (!approval) throw new Error('No pending approval found');
        if (APPROVAL_FLOW === 'memo') {
          if (!signMessage) throw new Error('Wallet does not support message signing.');
          const memoMessage = buildPaymentApprovalMemoMessage({
            missionId: currentMissionId,
            approvalId,
            amount: approval.amount,
            service: approval.service,
            payoutWallet: agents.find((a) => a.id === approval.agentId)?.payoutWallet || '',
            issuedAt,
          });
          const sigBytes = await signMessage(buildSignedMemoBytes(memoMessage));
          txSignature = encodeSignatureBase64(sigBytes);
        } else if (APPROVAL_FLOW === 'transaction') {
          throw new Error('Transaction flow not yet supported');
        }
      }

      const updated = await resolveSpendApproval(currentMissionId, approvalId, approve, auth, txSignature);
      setMission(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Spend approval failed');
    } finally {
      setIsApprovingApproval(false);
      setIsRejectingApproval(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, mission, signMessage]);

  const handleResolveMessage = useCallback(async (messageId: string, content: string) => {
    const currentMissionId = missionId ?? mission.id;
    setIsResolvingMessage(true);
    try {
      await resolveAgentMessage({ missionId: currentMissionId, messageId, content });
      const updated = await fetchMissionMessages(currentMissionId);
      setMessages(updated);
    } catch (error) {
      console.error('Failed to resolve message:', error);
    } finally {
      setIsResolvingMessage(false);
    }
  }, [missionId, mission.id]);

  const handleAnswerCheckpoint = useCallback(async (checkpointId: string, responseText: string) => {
    const currentMissionId = missionId ?? mission.id;
    setActionError(null);
    setIsAnsweringCheckpoint(true);
    try {
      const issuedAt = new Date().toISOString();
      const auth = await signApproval(
        buildHumanCheckpointAuthorizationMessage(
          currentMissionId,
          mission.input.authorityWallet,
          checkpointId,
          responseText,
          issuedAt,
        ),
        issuedAt,
      );
      if (!auth) throw new Error('Checkpoint answer requires wallet signature.');
      const updated = await answerHumanCheckpoint(currentMissionId, checkpointId, responseText, auth);
      setMission(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Checkpoint answer failed');
    } finally {
      setIsAnsweringCheckpoint(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, mission]);

  // ── derived data ──────────────────────────────────────────────────────────

  const agents: AgentProfile[] = mission.agents.length
    ? mission.agents
    : AGENTS.filter((a) =>
        ['news', 'market', 'skeptic', 'execution', 'verifier'].includes(a.role),
      ).map((agent) => ({
        id: agent.id,
        slug: agent.id,
        name: agent.name,
        role: agent.role as AgentProfile['role'],
        icon: '',
        description: agent.desc,
        trustScore: agent.trust,
        wallet: agent.wallet,
        payoutWallet: agent.wallet,
        verifierWallet: agent.wallet,
        active: true,
        totalMissions: agent.missions,
        capabilities: agent.tags,
        verifierCompatible: agent.role === 'verifier',
        supportedServices: [],
        executionMode: 'builtin' as const,
        priceModel: 'Demo fallback',
        phaseSchema: agent.phases.map((phase) => ({
          id: phase, label: phase, description: phase, streams: true,
        })),
        selected: true,
        status: 'idle' as const,
        budgetCap: 1,
        costIncurred: 0,
      }));

  const timeline = mission.events.length
    ? mission.events.map((event, index) => ({
        t: eventTime(index),
        kind: eventKind(event.type),
        msg: event.label,
        sig: 'txSignature' in event ? (event.txSignature ?? null) : null,
      }))
    : STATIC_EVENTS;

  const pendingApproval = mission.pendingSpendApprovals[0];
  const avgTrust = agents.length
    ? agents.reduce((sum, a) => sum + a.trustScore, 0) / agents.length
    : 0;

  const verificationScore = mission.verificationReport
    ? `${Math.round(mission.verificationReport.score * 100)}%`
    : mission.verificationChecks.length
    ? `${mission.verificationChecks.filter((c) => c.status === 'passed').length}/${mission.verificationChecks.length}`
    : '—';

  const selectedAgent = selectedAgentId ? agents.find((a) => a.id === selectedAgentId) ?? null : null;
  const openCheckpoints = (mission.humanCheckpoints ?? []).filter((checkpoint) => checkpoint.status === 'open');
  const latestAgentAction = [...agents]
    .filter((agent) => agent.currentAction)
    .sort((a, b) => (b.phaseHistory?.length ?? 0) - (a.phaseHistory?.length ?? 0))[0];
  const recentAgentWork = [...(mission.agentWork ?? [])]
    .sort((a, b) => new Date(b.completedAt ?? b.startedAt).getTime() - new Date(a.completedAt ?? a.startedAt).getTime())
    .slice(0, 5);
  const launchChecklist = [
    { label: 'Team approved', done: Boolean(mission.selectionProposal?.respondedAt || mission.selectedAgentIds.length) },
    { label: 'Human clarification', done: (mission.humanCheckpoints ?? []).some((checkpoint) => checkpoint.status === 'answered') },
    { label: 'Spend approval', done: mission.receipts.length > 0 },
    { label: 'Preview URL', done: Boolean(mission.deliverables?.previewUrl) },
    { label: 'Live URL', done: Boolean(mission.deliverables?.liveUrl) },
    { label: 'Launch posts', done: (mission.deliverables?.socialPosts?.length ?? 0) >= 3 },
    { label: 'Settlement', done: mission.status === 'settled' },
  ];
  const isLaunchMission = mission.input.template === 'launch-site-v1';

  // ── header primary action ─────────────────────────────────────────────────

  const ctaPulse = pendingApproval && sheetDismissed;

  function HeaderAction() {
    const s = mission.status;
    if (s === 'selection_pending') {
      return (
        <Btn
          variant="primary"
          size="sm"
          icon="check"
          disabled={isSubmitting}
          onClick={approveSelection}
          style={{ animation: undefined }}
        >
          {isSubmitting ? 'Submitting…' : 'Approve agent team'}
        </Btn>
      );
    }
    if (pendingApproval) {
      return (
        <button
          onClick={() => { setSheetDismissed(false); setSheetOpen(true); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 10,
            border: '1px solid color-mix(in oklch, var(--accent) 50%, transparent)',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            animation: ctaPulse ? 'pulse-soft 1.6s ease-in-out infinite' : undefined,
            letterSpacing: '-0.01em',
          }}
        >
          Review payment request →
        </button>
      );
    }
    if (s === 'awaiting_human_input') {
      return (
        <Btn
          variant="primary"
          size="sm"
          icon="spark"
          onClick={() => setActiveTab('activity')}
        >
          Answer checkpoint
        </Btn>
      );
    }
    if (s === 'verifying') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: 13 }}>
          <Spinner />
          Watching for verifier
        </div>
      );
    }
    if (s === 'settled') {
      return (
        <Btn variant="primary" size="sm" icon="check" href={`/proof/${missionId ?? mission.id}`}>
          View proof
        </Btn>
      );
    }
    if (s === 'failed') {
      return (
        <Pill tone="danger" dot={false}>
          Open dispute — unavailable
        </Pill>
      );
    }
    return null;
  }

  // ── tab content ───────────────────────────────────────────────────────────

  function ActivityTab() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Timeline */}
        <Card pad={0}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Mission Timeline</div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{timeline.length} events</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {timeline.map((e, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 180px 1fr 100px',
                  gap: 12,
                  padding: '10px 20px',
                  fontSize: 12.5,
                  alignItems: 'center',
                  borderBottom: i < timeline.length - 1 ? '1px solid var(--hairline)' : 'none',
                }}
              >
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{e.t}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{e.kind}</span>
                <span style={{ color: 'var(--text)' }}>{e.msg}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>{e.sig ?? '—'}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Agent comms */}
        <Card pad={0}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Agent Work Evidence</div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{mission.agentWork?.length ?? 0} receipts</span>
          </div>
          {recentAgentWork.length === 0 ? (
            <div style={{ padding: 20, fontSize: 12, color: 'var(--text-dim)' }}>
              No work receipts yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentAgentWork.map((work, index) => {
                const agent = agents.find((item) => item.id === work.agentId);
                return (
                  <div
                    key={work.id}
                    style={{
                      padding: '12px 20px',
                      borderBottom: index < recentAgentWork.length - 1 ? '1px solid var(--hairline)' : 'none',
                      display: 'grid',
                      gridTemplateColumns: '140px 1fr auto',
                      gap: 14,
                      alignItems: 'start',
                    }}
                  >
                    <div>
                      <Pill tone={work.kind === 'onchain' ? 'accent' : work.kind === 'verification' ? 'ok' : 'default'} dot={work.status === 'running'}>
                        {work.kind.replace(/_/g, ' ')}
                      </Pill>
                      <div style={{ marginTop: 7, fontSize: 11, color: 'var(--text-dim)' }}>
                        {agent?.name ?? work.agentId}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{work.title}</div>
                      <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: 'var(--text-muted)' }}>{work.detail}</div>
                      {work.outputSummary && (
                        <div className="mono" style={{ marginTop: 7, fontSize: 11, color: 'var(--text-dim)' }}>
                          {work.outputSummary}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-dim)' }}>
                      {work.confidence ? `${Math.round(work.confidence * 100)}%` : '—'}
                      <div className="mono" style={{ marginTop: 6 }}>
                        {work.txSignature ? `${work.txSignature.slice(0, 6)}…${work.txSignature.slice(-4)}` : work.toolName ?? 'artifact'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <AgentCommsThread
          messages={messages}
          onResolve={handleResolveMessage}
          isResolving={isResolvingMessage}
          readOnly={false}
        />
      </div>
    );
  }

  function TreasuryTab() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
            Agent Treasury Controls
          </div>

          {/* Overall budget meter */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Total budget</span>
              <span className="mono" style={{ color: 'var(--text-muted)' }}>
                {mission.budget.spent.toFixed(2)} / {mission.budget.totalBudget.toFixed(2)} USDC
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, (mission.budget.spent / Math.max(mission.budget.totalBudget, 0.001)) * 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--plasma-2), var(--plasma-4))',
                  transition: 'width 0.5s var(--ease)',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              <span>Spent: {mission.budget.spent.toFixed(2)}</span>
              <span>Reserved: {mission.budget.reserved.toFixed(2)}</span>
              <span>Remaining: {mission.budget.remaining.toFixed(2)}</span>
            </div>
          </div>

          {/* Per-agent bars */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 12 }}>
              Per-agent spend
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {agents.map((a) => {
                const used = a.costIncurred ?? 0;
                const cap = a.budgetCap || mission.budget.maxPerCall || 1;
                const color = agentColor(a);
                return (
                  <div key={a.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{a.name}</span>
                      <span className="mono" style={{ color: 'var(--text-dim)' }}>
                        {used.toFixed(2)} / {cap.toFixed(2)} USDC
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, (used / cap) * 100)}%`,
                          height: '100%',
                          background: color,
                          transition: 'width 0.5s var(--ease)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Receipts ledger */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 12 }}>
              Receipts ledger
            </div>
            {mission.receipts.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '12px 0' }}>
                No receipts yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                      {['Amount', 'Service', 'Agent', 'Payout wallet', 'Tx'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-dim)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mission.receipts.map((r) => {
                      const agent = agents.find((a) => a.id === r.agentId);
                      return (
                        <tr key={r.receiptId} style={{ borderBottom: '1px solid var(--hairline)' }}>
                          <td className="mono" style={{ padding: '8px 8px', color: 'var(--text)' }}>
                            {r.amount.toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>{r.purpose}</td>
                          <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>{agent?.name ?? r.agentId.slice(0, 8)}</td>
                          <td className="mono" style={{ padding: '8px 8px', color: 'var(--text-dim)', fontSize: 11 }}>
                            {r.serviceWallet.slice(0, 6)}…{r.serviceWallet.slice(-4)}
                          </td>
                          <td className="mono" style={{ padding: '8px 8px', color: 'var(--text-dim)', fontSize: 11 }}>
                            {r.txSignature
                              ? `${r.txSignature.slice(0, 6)}…`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  function AgentsTab() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: selectedAgent ? '1fr 340px' : '1fr', gap: 16 }}>
        {/* Agent mesh grid */}
        <Card pad={0}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Agent Mesh</div>
            <Pill tone="ok">LIVE</Pill>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0 }}>
            {agents.map((a, i) => {
              const phases = agentPhases(a);
              const color = agentColor(a);
              const done = Math.min(phases.length - 1, Math.floor((tick + i) / 3) % phases.length);
              const status = a.status === 'complete' ? 'done' : a.status === 'working' ? 'working' : a.status ?? 'queued';
              const isSelected = a.id === selectedAgentId;
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedAgentId(isSelected ? null : a.id)}
                  style={{
                    padding: '14px 16px',
                    borderTop: i >= 2 ? '1px solid var(--hairline)' : 'none',
                    borderLeft: i % 2 ? '1px solid var(--hairline)' : 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: isSelected ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: color.replace(')', ' / 0.14)'), color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                    }}>
                      <AgentIcon role={a.role} size={18} color={color} />
                      {status === 'working' && (
                        <span style={{
                          position: 'absolute', inset: -3, borderRadius: 12,
                          border: `1.5px solid ${color}`, opacity: 0.5,
                          animation: 'breathe 1.6s ease-in-out infinite',
                        }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize' }}>{a.role}</div>
                    </div>
                    <Pill
                      tone={status === 'done' ? 'ok' : status === 'working' ? 'pending' : 'default'}
                      dot={status !== 'queued'}
                    >
                      {status}
                    </Pill>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    {phases.map((_, pi) => (
                      <div key={pi} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: pi <= done && status !== 'queued' ? color : 'var(--hairline-strong)',
                        opacity: pi <= done ? 1 : 0.5, transition: 'all 0.4s',
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {status === 'queued' ? 'waiting upstream' : phases[done]}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5, color: 'var(--text-dim)' }}>
                    <span>spend · <span className="mono">{(a.costIncurred ?? 0).toFixed(2)} USDC</span></span>
                    <span>trust · <span className="mono">{a.trustScore}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Selected agent side panel */}
        {selectedAgent && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{selectedAgent.name}</div>
              <button
                onClick={() => setSelectedAgentId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
              >
                ×
              </button>
            </div>
            <Pill tone="accent" dot={false} style={{ marginBottom: 12 }}>{selectedAgent.role}</Pill>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
              {selectedAgent.description}
            </div>

            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Capabilities
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {selectedAgent.capabilities.map((cap) => (
                <Pill key={cap} tone="default" dot={false}>{cap}</Pill>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Phases
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {agentPhases(selectedAgent).map((phase, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: selectedAgent.currentPhaseId === phase ? 'var(--accent)' : 'var(--hairline-strong)',
                  }} />
                  <span style={{ color: 'var(--text-muted)' }}>{phase}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-dim)' }}>Trust score</span>
                <span className="mono" style={{ color: 'var(--ok)' }}>{selectedAgent.trustScore}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-dim)' }}>Spend</span>
                <span className="mono" style={{ color: 'var(--text-muted)' }}>{(selectedAgent.costIncurred ?? 0).toFixed(2)} USDC</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-dim)' }}>Total missions</span>
                <span className="mono" style={{ color: 'var(--text-muted)' }}>{selectedAgent.totalMissions}</span>
              </div>
            </div>

            {(() => {
              const trust = mission.trustProfiles?.find((profile) => profile.agentId === selectedAgent.id) ?? selectedAgent.trustProfile;
              if (!trust) return null;
              const signals: Array<[string, number]> = [
                ['Verifier pass', trust.verifierPassRate],
                ['Spend discipline', trust.spendDiscipline],
                ['Proof quality', trust.proofQualityScore],
                ['Latency', trust.latencyScore],
              ];
              return (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Trust signals
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {signals.map(([label, value]) => {
                      return (
                        <div key={label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                            <span className="mono" style={{ color: 'var(--text-dim)' }}>{Math.round(value * 100)}%</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.round(value * 100)}%`, background: 'var(--ok)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </Card>
        )}
      </div>
    );
  }

  function VerificationTab() {
    const checks = mission.verificationChecks;
    const report = mission.verificationReport;
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Verification Checks</div>
          {report ? (
            <Pill tone={report.approved ? 'ok' : 'danger'}>
              {Math.round(report.score * 100)}% confidence
            </Pill>
          ) : (
            <Pill tone="pending">{checks.length} checks</Pill>
          )}
        </div>

        {report?.summary && (
          <div style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-muted)',
            padding: '12px 14px',
            borderRadius: 10,
            background: 'var(--surface-2)',
            border: '1px solid var(--hairline)',
            marginBottom: 16,
          }}>
            {report.summary}
          </div>
        )}

        {checks.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '16px 0' }}>
            No verification checks yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {checks.map((check) => (
              <VerificationCheckRow
                key={check.id}
                label={check.label}
                passed={check.status === 'passed'}
                detail={check.detail}
              />
            ))}
          </div>
        )}
      </Card>
    );
  }

  function ChainTab() {
    const chain = mission.chain;
    const pdas = [
      { label: 'Program ID', value: chain?.programId ?? 'not configured' },
      { label: 'Mission PDA', value: chain?.missionPda ?? 'not configured' },
      { label: 'Verification PDA', value: chain?.verificationPda ?? 'not configured' },
      { label: 'Vault ATA', value: chain?.vaultAta ?? 'not configured' },
    ];
    return (
      <Card>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
          Chain & RPC
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Program addresses
          </div>
          {pdas.map(({ label, value }) => (
            <KVRow key={label} label={label} value={value} mono copyable />
          ))}
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            RPC configuration
          </div>
          <KVRow label="Provider" value={chain?.rpcProvider ?? 'unknown'} />
          <KVRow label="HTTP" value={chain?.rpcHttpUrl ?? 'not configured'} mono />
          <KVRow label="WS" value={chain?.rpcWsUrl ?? 'not configured'} mono />
          <div style={{ paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Chain mode</span>
            <Pill tone={chain?.rpcProvider === 'devnet' ? 'accent' : 'default'} dot={false}>
              {chain?.rpcProvider ?? 'mock'}
            </Pill>
            {chain?.rpcStreamingEnabled && (
              <Pill tone="ok" dot>streaming</Pill>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Shell
      title="Mission"
      subtitle={mission.id}
      padBody={false}
    >
      {/* Sticky mission header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'color-mix(in oklch, var(--bg) 85%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--hairline)',
        padding: '14px 28px',
      }}>
        {/* Title row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <h1 style={{
              margin: 0,
              fontSize: 'var(--text-h1)',
              fontWeight: 600,
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {mission.input.title}
            </h1>
            <Pill
              tone={statusTone(mission.status)}
              dot
            >
              <span style={{
                animation: ['selection_pending', 'awaiting_spend_approval', 'awaiting_human_input', 'active'].includes(mission.status)
                  ? 'pulse-soft 1.6s ease-in-out infinite'
                  : undefined,
              }}>
                {mission.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </Pill>
          </div>

          <div style={{ flexShrink: 0 }}>
            <HeaderAction />
          </div>
        </div>

        {/* KPI strip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'Elapsed', value: mission.elapsedLabel, mono: true },
            { label: 'Remaining', value: `${mission.budget.remaining.toFixed(2)} USDC`, mono: true },
            { label: 'Spent', value: `${mission.budget.spent.toFixed(2)} / ${mission.budget.totalBudget.toFixed(2)}`, mono: true },
            { label: 'Verification', value: verificationScore },
            { label: 'Agents', value: String(agents.length) },
            { label: 'Trust avg', value: avgTrust.toFixed(1), tone: 'var(--ok)' },
          ].map(({ label, value, mono, tone }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                {label}
              </div>
              <div
                className={mono ? 'mono' : ''}
                style={{ fontSize: 14, fontWeight: 500, color: tone ?? 'var(--text)', marginTop: 2, letterSpacing: mono ? 0 : '-0.01em' }}
              >
                {value}
              </div>
            </div>
          ))}

          {/* Spend bar */}
          <div style={{ flex: 1, minWidth: 80, maxWidth: 160 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 4 }}>
              Budget
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, (mission.budget.spent / Math.max(mission.budget.totalBudget, 0.001)) * 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--plasma-2), var(--plasma-4))',
                transition: 'width 0.5s var(--ease)',
              }} />
            </div>
          </div>
        </div>

        {/* Error */}
        {actionError && (
          <div style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
            border: '1px solid color-mix(in oklch, var(--danger) 25%, transparent)',
            color: 'var(--danger)',
            fontSize: 12.5,
          }}>
            {actionError}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 28px',
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--bg)',
        overflowX: 'auto',
      }}>
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                letterSpacing: '-0.01em',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
                marginBottom: -1,
              }}
            >
              {tab.label}
              {/* Badge for pending items */}
              {tab.id === 'activity' && messages.filter((m) => m.status === 'open').length > 0 && (
                <span style={{
                  marginLeft: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: 'var(--warn)',
                  color: 'var(--bg)',
                  fontSize: 9,
                  fontWeight: 700,
                }}>
                  {messages.filter((m) => m.status === 'open').length}
                </span>
              )}
              {tab.id === 'treasury' && mission.pendingSpendApprovals.length > 0 && (
                <span style={{
                  marginLeft: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: 'var(--pending)',
                  color: 'var(--bg)',
                  fontSize: 9,
                  fontWeight: 700,
                }}>
                  {mission.pendingSpendApprovals.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div style={{ padding: '24px 28px 48px' }}>
        {isLaunchMission && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
            marginBottom: 20,
          }}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Human Input Queue</div>
              {openCheckpoints.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  No blocking checkpoints open.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {openCheckpoints.map((checkpoint) => (
                    <HumanCheckpointCard
                      key={checkpoint.id}
                      checkpoint={checkpoint}
                      disabled={isAnsweringCheckpoint}
                      onAnswer={handleAnswerCheckpoint}
                    />
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Deliverables</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                {[
                  ['Preview', mission.deliverables?.previewUrl],
                  ['Live', mission.deliverables?.liveUrl],
                  ['Waitlist', mission.deliverables?.waitlistEndpoint],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ color: 'var(--text-dim)' }}>{label}</span>
                    {value ? (
                      <a href={value} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textAlign: 'right' }}>
                        open
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>pending</span>
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Posts</span>
                  <span style={{ color: 'var(--text-muted)' }}>{mission.deliverables?.socialPosts?.length ?? 0}/3</span>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Launch Checklist</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {launchChecklist.map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ color: item.done ? 'var(--ok)' : 'var(--text-dim)' }}>
                      {item.done ? '✓' : '○'}
                    </span>
                    <span style={{ color: item.done ? 'var(--text)' : 'var(--text-muted)' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Latest Agent Action</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {latestAgentAction ? (
                  <>
                    <div style={{ color: 'var(--text)', fontWeight: 500 }}>{latestAgentAction.name}</div>
                    <div>{latestAgentAction.currentAction}</div>
                  </>
                ) : (
                  'Waiting for mission activity.'
                )}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)', fontSize: 12, color: 'var(--text-dim)' }}>
                Artifacts: {mission.deliverables?.fileManifest?.length ?? 0} files, {mission.deliverables?.screenshots?.length ?? 0} screenshots
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Trust Impact</div>
              {mission.reputationDeltas.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.45 }}>
                  Trust deltas will unlock after verifier proof and settlement.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {mission.reputationDeltas.slice(0, 4).map((delta) => {
                    const agent = agents.find((item) => item.id === delta.agentId);
                    return (
                      <div key={delta.agentId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{agent?.name ?? delta.agentId}</span>
                        <span className="mono" style={{ color: 'var(--ok)' }}>
                          {delta.before} → {delta.after}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)', fontSize: 12, color: 'var(--text-dim)' }}>
                Profiles tracked: {mission.trustProfiles?.length ?? agents.length}
              </div>
            </Card>
          </div>
        )}
        {activeTab === 'activity' && <ActivityTab />}
        {activeTab === 'treasury' && <TreasuryTab />}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'verification' && <VerificationTab />}
        {activeTab === 'chain' && <ChainTab />}
      </div>

      {/* Spend approval sheet */}
      {pendingApproval && (
        <MissionSpendSheet
          open={sheetOpen}
          onClose={() => {
            setSheetOpen(false);
            setSheetDismissed(true);
          }}
          request={{
            approvalId: pendingApproval.id,
            agentId: pendingApproval.agentId,
            agentName: agents.find((a) => a.id === pendingApproval.agentId)?.name,
            agentRole: agents.find((a) => a.id === pendingApproval.agentId)?.role,
            amount: pendingApproval.amount,
            service: pendingApproval.service,
            toolName: pendingApproval.purpose,
            payoutWallet: agents.find((a) => a.id === pendingApproval.agentId)?.payoutWallet,
            justification: pendingApproval.justification,
            policyChecks: derivePolicyChecks(pendingApproval, mission),
            requestedAt: pendingApproval.requestedAt,
          }}
          isApproving={isApprovingApproval}
          isRejecting={isRejectingApproval}
          onApprove={() => resolveApproval(pendingApproval.id, true)}
          onReject={() => resolveApproval(pendingApproval.id, false)}
        />
      )}
    </Shell>
  );
}

export default function MissionCockpitPage() {
  return (
    <Suspense
      fallback={
        <Shell title="Mission" subtitle="Loading…">
          <Card>Loading mission…</Card>
        </Shell>
      }
    >
      <MissionCockpitContent />
    </Suspense>
  );
}
