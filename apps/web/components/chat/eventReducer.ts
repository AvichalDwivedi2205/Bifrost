import type {
  AgentMessage,
  AgentRole,
  HumanCheckpoint,
  MissionEvent,
  MissionRecord,
  ReputationDelta,
  SpendApprovalRequest,
  VerificationCheck,
  MissionVerificationReport,
} from '@bifrost/shared';

// Discriminated union of bubble payloads keyed by `kind`.
export type Bubble =
  | { kind: 'bifrost'; key: string; sortAt: string; tone?: 'bifrost' | 'system' | 'success' | 'danger'; title?: string; text: string; subtitle?: string }
  | { kind: 'user'; key: string; sortAt: string; text: string }
  | {
      kind: 'teamReady';
      key: string;
      sortAt: string;
      proposalId?: string;
      agents: TeamReadyAgent[];
      approved: boolean;
    }
  | {
      kind: 'agent';
      key: string;
      sortAt: string;
      agentId: string;
      agentName: string;
      role: AgentRole;
      icon?: string;
      status: 'idle' | 'running' | 'done' | 'failed';
      currentPhaseLabel?: string;
      detail?: string;
      outputRef?: string;
      messages: AgentMessage[];
    }
  | {
      kind: 'clarification';
      key: string;
      sortAt: string;
      checkpoint: HumanCheckpoint;
    }
  | {
      kind: 'spend';
      key: string;
      sortAt: string;
      approval?: SpendApprovalRequest;
      agentId?: string;
      amount?: number;
      service?: string;
      status: 'pending' | 'approved' | 'rejected';
      txSignature?: string;
    }
  | {
      kind: 'preview';
      key: string;
      sortAt: string;
      previewUrl: string;
      label: string;
    }
  | {
      kind: 'verifier';
      key: string;
      sortAt: string;
      pass: number;
      state: 'running' | 'approved' | 'rejected';
      checks: VerificationCheck[];
      report?: MissionVerificationReport;
    }
  | {
      kind: 'dispute';
      key: string;
      sortAt: string;
      pass: number;
      negativeDeltas: ReputationDelta[];
      checks: VerificationCheck[];
    }
  | { kind: 'rebuild'; key: string; sortAt: string }
  | {
      kind: 'settlement';
      key: string;
      sortAt: string;
      amount: number;
      txSignature?: string;
      positiveDeltas: ReputationDelta[];
    };

export interface TeamReadyAgent {
  id: string;
  name: string;
  role: AgentRole;
  icon?: string;
  trustScore: number;
  agentRegistryPda?: string;
  capabilities: string[];
}

interface ReducerState {
  bubbles: Map<string, Bubble>;
  passCount: number;
  hasRejection: boolean;
  rebuildEmittedForPass: number | null;
}

function blankState(): ReducerState {
  return {
    bubbles: new Map(),
    passCount: 1,
    hasRejection: false,
    rebuildEmittedForPass: null,
  };
}

function ensure<T extends Bubble>(state: ReducerState, key: string, factory: () => T): T {
  const existing = state.bubbles.get(key);
  if (existing) return existing as T;
  const next = factory();
  state.bubbles.set(key, next);
  return next;
}

function update<T extends Bubble>(state: ReducerState, key: string, mutator: (current: T) => T): T | undefined {
  const existing = state.bubbles.get(key) as T | undefined;
  if (!existing) return undefined;
  const next = mutator(existing);
  state.bubbles.set(key, next);
  return next;
}

function findCheckpoint(mission: MissionRecord, id: string | undefined): HumanCheckpoint | undefined {
  if (!id) return undefined;
  return mission.humanCheckpoints.find((cp) => cp.id === id);
}

function findApproval(mission: MissionRecord, id: string | undefined): SpendApprovalRequest | undefined {
  if (!id) return undefined;
  return mission.pendingSpendApprovals.find((req) => req.id === id);
}

export function reduceMission(
  mission: MissionRecord | null,
  messages: AgentMessage[],
): Bubble[] {
  if (!mission) return [];
  const state = blankState();

  for (const event of mission.events) {
    handleEvent(event, mission, state);
  }

  // Synthetic: open spend approvals not yet event-tracked (defensive).
  for (const approval of mission.pendingSpendApprovals) {
    const key = `spend:${approval.id}`;
    if (!state.bubbles.has(key)) {
      state.bubbles.set(key, {
        kind: 'spend',
        key,
        sortAt: approval.requestedAt ?? new Date().toISOString(),
        approval,
        agentId: approval.agentId,
        amount: approval.amount,
        service: approval.service,
        status: 'pending',
      });
    }
  }

  // Synthetic: open clarifications without paired event.
  for (const cp of mission.humanCheckpoints) {
    if (cp.status !== 'open') continue;
    const key = `cp:${cp.id}`;
    if (!state.bubbles.has(key)) {
      state.bubbles.set(key, {
        kind: 'clarification',
        key,
        sortAt: cp.requestedAt ?? new Date().toISOString(),
        checkpoint: cp,
      });
    }
  }

  // Distribute agentMessages into existing AgentBubbles' messages array.
  if (messages.length > 0) {
    const byFromAgent = new Map<string, AgentMessage[]>();
    for (const msg of messages) {
      if (!msg.fromAgentId) continue;
      const list = byFromAgent.get(msg.fromAgentId) ?? [];
      list.push(msg);
      byFromAgent.set(msg.fromAgentId, list);
    }
    for (const [agentId, list] of byFromAgent) {
      const key = `agent:${agentId}`;
      const agentBubble = state.bubbles.get(key);
      if (agentBubble && agentBubble.kind === 'agent') {
        agentBubble.messages = list;
      }
    }
  }

  return Array.from(state.bubbles.values()).sort((a, b) => {
    if (a.sortAt === b.sortAt) return 0;
    return a.sortAt < b.sortAt ? -1 : 1;
  });
}

function handleEvent(event: MissionEvent, mission: MissionRecord, state: ReducerState): void {
  switch (event.type) {
    case 'MISSION_CREATED': {
      ensure(state, `evt:created`, () => ({
        kind: 'bifrost',
        key: `evt:created`,
        sortAt: event.createdAt,
        tone: 'bifrost',
        title: 'Bifrost',
        text: 'Mission anchored on devnet. Scoring agents now.',
        subtitle: event.txSignature ? `create tx ${event.txSignature.slice(0, 12)}…` : undefined,
      }));
      return;
    }
    case 'SELECTION_PROPOSED': {
      const proposalId = (event as { proposalId: string }).proposalId;
      ensure(state, `evt:proposal:${proposalId}`, () => ({
        kind: 'bifrost',
        key: `evt:proposal:${proposalId}`,
        sortAt: event.createdAt,
        tone: 'bifrost',
        title: 'Bifrost',
        text: 'Team proposal ready. Review below.',
      }));
      // Also seed a teamReady bubble keyed by proposal id.
      ensure(state, `team:${proposalId}`, () => buildTeamReady(mission, proposalId, event.createdAt));
      return;
    }
    case 'SELECTION_APPROVED': {
      const proposalId = (event as { proposalId: string }).proposalId;
      update<Extract<Bubble, { kind: 'teamReady' }>>(state, `team:${proposalId}`, (cur) => ({
        ...cur,
        approved: true,
      }));
      ensure(state, `evt:approved:${proposalId}`, () => ({
        kind: 'bifrost',
        key: `evt:approved:${proposalId}`,
        sortAt: event.createdAt,
        tone: 'bifrost',
        title: 'Bifrost',
        text: 'Team launched. Agents starting.',
      }));
      return;
    }
    case 'SELECTION_CHANGED': {
      const proposalId = (event as { proposalId: string }).proposalId;
      ensure(state, `evt:change:${proposalId}:${event.id}`, () => ({
        kind: 'bifrost',
        key: `evt:change:${proposalId}:${event.id}`,
        sortAt: event.createdAt,
        tone: 'bifrost',
        title: 'Bifrost',
        text: 'Team adjusted.',
      }));
      return;
    }
    case 'AGENT_SELECTED': {
      // Folded into teamReady; ensure a teamReady exists keyed by latest proposal.
      const proposalId = mission.selectionProposal?.id ?? 'auto';
      const teamKey = `team:${proposalId}`;
      const existing = state.bubbles.get(teamKey) as Extract<Bubble, { kind: 'teamReady' }> | undefined;
      if (!existing) {
        state.bubbles.set(teamKey, buildTeamReady(mission, proposalId, event.createdAt));
      } else {
        existing.agents = teamReadyAgents(mission);
      }
      return;
    }
    case 'AGENT_PHASE_STARTED':
    case 'AGENT_PHASE_UPDATED':
    case 'AGENT_PHASE_COMPLETED':
    case 'AGENT_PHASE_FAILED': {
      const agentId = (event as { agentId: string }).agentId;
      const agentProfile = mission.agents.find((a) => a.id === agentId) ?? mission.registry.find((a) => a.id === agentId);
      const key = `agent:${agentId}`;
      const status: 'running' | 'done' | 'failed' =
        event.type === 'AGENT_PHASE_COMPLETED' ? 'done'
          : event.type === 'AGENT_PHASE_FAILED' ? 'failed'
            : 'running';
      const detail = (event as { detail?: string }).detail;
      ensure(state, key, () => ({
        kind: 'agent',
        key,
        sortAt: event.createdAt,
        agentId,
        agentName: agentProfile?.name ?? agentId,
        role: (agentProfile?.role ?? 'execution') as AgentRole,
        icon: agentProfile?.icon,
        status,
        currentPhaseLabel: event.label,
        detail,
        messages: [],
      }));
      update<Extract<Bubble, { kind: 'agent' }>>(state, key, (cur) => ({
        ...cur,
        status,
        currentPhaseLabel: event.label,
        detail: detail ?? cur.detail,
      }));
      return;
    }
    case 'TASK_STARTED':
    case 'TASK_COMPLETE': {
      // Ignored; covered by AGENT_PHASE events.
      return;
    }
    case 'HUMAN_CHECKPOINT_REQUESTED': {
      const checkpointId = (event as { checkpointId?: string }).checkpointId;
      const cp = findCheckpoint(mission, checkpointId);
      if (!cp || !checkpointId) return;
      ensure(state, `cp:${checkpointId}`, () => ({
        kind: 'clarification',
        key: `cp:${checkpointId}`,
        sortAt: event.createdAt,
        checkpoint: cp,
      }));
      return;
    }
    case 'HUMAN_CHECKPOINT_ANSWERED': {
      const checkpointId = (event as { checkpointId?: string }).checkpointId;
      if (!checkpointId) return;
      const cp = findCheckpoint(mission, checkpointId);
      update<Extract<Bubble, { kind: 'clarification' }>>(state, `cp:${checkpointId}`, (cur) => ({
        ...cur,
        checkpoint: cp ?? cur.checkpoint,
      }));
      return;
    }
    case 'DELIVERABLE_CREATED': {
      const outputRef = (event as { outputRef?: string }).outputRef ?? '';
      if (outputRef.toLowerCase().includes('preview') || mission.deliverables?.previewUrl) {
        const url = mission.deliverables?.previewUrl ?? outputRef;
        const key = `deliv:${event.id}`;
        ensure(state, key, () => ({
          kind: 'preview',
          key,
          sortAt: event.createdAt,
          previewUrl: url,
          label: event.label,
        }));
      }
      return;
    }
    case 'SPEND_REQUESTED': {
      // Ignored — covered by SPEND_APPROVAL_REQUIRED.
      return;
    }
    case 'SPEND_APPROVAL_REQUIRED': {
      const approvalId = (event as { approvalId?: string }).approvalId;
      if (!approvalId) return;
      const approval = findApproval(mission, approvalId);
      ensure(state, `spend:${approvalId}`, () => ({
        kind: 'spend',
        key: `spend:${approvalId}`,
        sortAt: event.createdAt,
        approval,
        agentId: (event as { agentId?: string }).agentId,
        amount: (event as { amount?: number }).amount,
        service: (event as { service?: string }).service,
        status: 'pending',
      }));
      return;
    }
    case 'SPEND_APPROVED': {
      const approvalId = (event as { approvalId?: string }).approvalId;
      if (!approvalId) return;
      update<Extract<Bubble, { kind: 'spend' }>>(state, `spend:${approvalId}`, (cur) => ({
        ...cur,
        status: 'approved',
        txSignature: (event as { txSignature?: string }).txSignature ?? cur.txSignature,
      }));
      return;
    }
    case 'SPEND_REJECTED': {
      const approvalId = (event as { approvalId?: string }).approvalId;
      if (!approvalId) return;
      update<Extract<Bubble, { kind: 'spend' }>>(state, `spend:${approvalId}`, (cur) => ({ ...cur, status: 'rejected' }));
      return;
    }
    case 'VERIFICATION_RUNNING': {
      const pass = state.passCount;
      const key = `verifier:p${pass}`;
      if (state.hasRejection && state.rebuildEmittedForPass !== pass) {
        const rebuildKey = `rebuild:p${pass}`;
        ensure(state, rebuildKey, () => ({
          kind: 'rebuild',
          key: rebuildKey,
          sortAt: event.createdAt,
        }));
        state.rebuildEmittedForPass = pass;
      }
      ensure(state, key, () => ({
        kind: 'verifier',
        key,
        sortAt: event.createdAt,
        pass,
        state: 'running',
        checks: [],
      }));
      update<Extract<Bubble, { kind: 'verifier' }>>(state, key, (cur) => ({
        ...cur,
        state: 'running',
      }));
      return;
    }
    case 'VERIFICATION_APPROVED': {
      const pass = state.passCount;
      const key = `verifier:p${pass}`;
      update<Extract<Bubble, { kind: 'verifier' }>>(state, key, (cur) => ({
        ...cur,
        state: 'approved',
        checks: mission.verificationChecks,
        report: mission.verificationReport,
      }));
      return;
    }
    case 'VERIFICATION_REJECTED': {
      const pass = state.passCount;
      const verifierKey = `verifier:p${pass}`;
      update<Extract<Bubble, { kind: 'verifier' }>>(state, verifierKey, (cur) => ({
        ...cur,
        state: 'rejected',
        checks: mission.verificationChecks,
        report: mission.verificationReport,
      }));
      const negative = mission.reputationDeltas.filter((d) => d.delta < 0);
      const disputeKey = `dispute:p${pass}`;
      ensure(state, disputeKey, () => ({
        kind: 'dispute',
        key: disputeKey,
        sortAt: event.createdAt,
        pass,
        negativeDeltas: negative,
        checks: mission.verificationChecks,
      }));
      state.hasRejection = true;
      state.passCount = pass + 1;
      return;
    }
    case 'SETTLEMENT_RELEASED': {
      const positive = mission.reputationDeltas.filter((d) => d.delta > 0);
      ensure(state, 'settle', () => ({
        kind: 'settlement',
        key: 'settle',
        sortAt: event.createdAt,
        amount: (event as { amount: number }).amount,
        txSignature: (event as { txSignature?: string }).txSignature,
        positiveDeltas: positive,
      }));
      return;
    }
    case 'REPUTATION_UPDATED': {
      // Folded into latest dispute (negative) or settlement (positive); no separate bubble.
      return;
    }
    case 'MISSION_FAILED': {
      ensure(state, 'failed', () => ({
        kind: 'bifrost',
        key: 'failed',
        sortAt: event.createdAt,
        tone: 'danger',
        title: 'Bifrost',
        text: `Mission failed: ${(event as { reason?: string }).reason ?? 'unknown reason'}`,
      }));
      return;
    }
    case 'AGENT_MESSAGE_SENT': {
      // Folded into the matching AgentBubble at message-distribution stage above.
      return;
    }
    default:
      return;
  }
}

function teamReadyAgents(mission: MissionRecord): TeamReadyAgent[] {
  const ids = mission.selectionProposal?.recommendedAgentIds ?? mission.selectedAgentIds ?? [];
  const pool = mission.agents.length > 0 ? mission.agents : mission.registry;
  const out: TeamReadyAgent[] = [];
  for (const id of ids) {
    const profile = pool.find((p) => p.id === id);
    if (!profile) continue;
    out.push({
      id: profile.id,
      name: profile.name,
      role: profile.role,
      icon: profile.icon,
      trustScore: profile.trustScore,
      agentRegistryPda: (profile as { agentRegistryPda?: string }).agentRegistryPda,
      capabilities: profile.capabilities,
    });
  }
  return out;
}

function buildTeamReady(mission: MissionRecord, proposalId: string, sortAt: string): Extract<Bubble, { kind: 'teamReady' }> {
  return {
    kind: 'teamReady',
    key: `team:${proposalId}`,
    sortAt,
    proposalId,
    agents: teamReadyAgents(mission),
    approved: mission.selectionProposal?.status === 'approved',
  };
}
