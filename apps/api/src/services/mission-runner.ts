import type {
  AgentProfile,
  AgentRole,
  AgentSelectionProposal,
  MissionInput,
  MissionProof,
  MissionRecord,
  MissionResult,
  MissionTask,
  SpendApprovalRequest,
} from "@missionmesh/shared";
import { nanoid } from "nanoid";

import { ExecutionAgent, type ExecutionOutput } from "../agents/execution-agent";
import { MarketAgent, type MarketOutput } from "../agents/market-agent";
import { NewsAgent, type NewsOutput } from "../agents/news-agent";
import { SkepticAgent, type SkepticOutput } from "../agents/skeptic-agent";
import { VerifierAgent } from "../agents/verifier-agent";
import { LLMRouter } from "../providers/llm/router";
import { AgentRegistryService } from "./registry";
import { PolicyEngine } from "./policy-engine";
import { MissionMeshSolanaClient } from "./solana/missionmesh-client";
import { MissionStore } from "./store";

const DEFAULT_SELECTION_AGENT_IDS = [
  "trump-news-1",
  "polymarket-1",
  "skeptic-1",
  "execution-1",
  "verifier-1",
] as const;

const REQUIRED_AGENT_ROLES: AgentRole[] = [
  "news",
  "market",
  "skeptic",
  "execution",
  "verifier",
];

const BUDGET_CAPS: Record<string, number> = {
  "trump-news-1": 0.45,
  "polymarket-1": 0.55,
  "skeptic-1": 0.3,
  "execution-1": 0,
  "verifier-1": 0,
};

const SPEND_PLANS = {
  "task-news": {
    amount: 0.22,
    service: "headline-feed.ai",
    purpose: "news_timeline_bundle",
    justification:
      "Pull a paid Trump headline bundle with timestamps before the news agent forms its view.",
  },
  "task-market": {
    amount: 0.32,
    service: "polymarket-scan.ai",
    purpose: "market_scan_bundle",
    justification:
      "Query the market scanner to compare Trump-linked contracts, spreads, and timing.",
  },
  "task-skeptic": {
    amount: 0.08,
    service: "signal-replay.ai",
    purpose: "skeptic_signal_replay",
    justification:
      "Replay the signal timing to decide whether the move is edge, noise, or too suspicious.",
  },
} satisfies Record<
  string,
  {
    amount: number;
    service: string;
    purpose: string;
    justification: string;
  }
>;

interface MissionArtifacts {
  news?: NewsOutput;
  market?: MarketOutput;
  skeptic?: SkepticOutput;
  execution?: ExecutionOutput;
}

export class MissionRunner {
  private readonly inFlightRuns = new Map<string, Promise<void>>();
  private readonly artifacts = new Map<string, MissionArtifacts>();
  private readonly llm = new LLMRouter();
  private readonly policy = new PolicyEngine();
  private readonly solana = new MissionMeshSolanaClient();
  private readonly registry: AgentRegistryService;
  private readonly news = new NewsAgent(this.llm);
  private readonly market = new MarketAgent(this.llm);
  private readonly skeptic = new SkepticAgent(this.llm);
  private readonly execution = new ExecutionAgent(this.llm);
  private readonly verifier = new VerifierAgent(this.llm);

  constructor(
    private readonly store: MissionStore,
    registry?: AgentRegistryService,
  ) {
    this.registry = registry ?? new AgentRegistryService();
  }

  getRegistry() {
    return this.registry.list();
  }

  getRuntimeStatus() {
    return {
      rpc: this.solana.describeConnection(),
    };
  }

  async createMission(input: MissionInput): Promise<MissionRecord> {
    const selectionProposal = this.buildSelectionProposal();
    const proposedAgents = this.buildAgentProfiles(selectionProposal.recommendedAgentIds, false);
    const tasks = this.buildMissionTasks(selectionProposal.recommendedAgentIds, false);
    const record = this.store.create(input, this.registry.list(), proposedAgents, tasks);

    let chainResult:
      | {
          missionPda?: string;
          verificationPda?: string;
          vaultAta?: string;
          txSignature: string;
        }
      | undefined;

    try {
      chainResult = await this.solana.createMission(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create mission on Solana";
      this.store.mutate(record.id, (current) => ({
        ...current,
        status: "failed",
        failureReason: message,
      }));
      throw error;
    }

    this.store.mutate(record.id, (current) => ({
      ...current,
      status: "selection_pending",
      selectionProposal,
      chain: {
        ...this.solana.describeConnection(),
        ...current.chain,
        missionPda: chainResult?.missionPda,
        verificationPda: chainResult?.verificationPda,
        vaultAta: chainResult?.vaultAta,
      },
    }));

    this.store.appendEvent(record.id, {
      id: `evt_${nanoid(10)}`,
      missionId: record.id,
      type: "MISSION_CREATED",
      label: "Mission created on Solana and waiting for agent approval",
      txSignature: chainResult?.txSignature,
      createdAt: new Date().toISOString(),
    });
    this.store.appendEvent(record.id, {
      id: `evt_${nanoid(10)}`,
      missionId: record.id,
      type: "SELECTION_PROPOSED",
      label: "MissionMesh proposed a curated agent team for the task",
      proposalId: selectionProposal.id,
      agentIds: selectionProposal.recommendedAgentIds,
      createdAt: new Date().toISOString(),
    });

    return this.mustGetMission(record.id);
  }

  async approveAgentSelection(
    missionId: string,
    chosenAgentIds?: string[],
  ): Promise<MissionRecord> {
    const record = this.mustGetMission(missionId);
    if (record.status !== "selection_pending" || !record.selectionProposal) {
      throw new Error("Mission is not waiting for agent approval");
    }

    const selectedIds =
      chosenAgentIds && chosenAgentIds.length > 0
        ? [...new Set(chosenAgentIds)]
        : record.selectionProposal.recommendedAgentIds;
    this.validateSelection(selectedIds);

    const selectionChanged = !sameMembers(
      selectedIds,
      record.selectionProposal.recommendedAgentIds,
    );
    const selectedAgents = this.buildAgentProfiles(selectedIds, true);
    const tasks = this.buildMissionTasks(selectedIds, true);
    const respondedAt = new Date().toISOString();

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "active",
      agents: selectedAgents,
      tasks,
      selectedAgentIds: selectedIds,
      selectionProposal: current.selectionProposal
        ? {
            ...current.selectionProposal,
            status: "approved",
            chosenAgentIds: selectedIds,
            respondedAt,
          }
        : undefined,
    }));

    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: selectionChanged ? "SELECTION_CHANGED" : "SELECTION_APPROVED",
      label: selectionChanged
        ? "Human changed the proposed agent lineup and approved it"
        : "Human approved the proposed agent lineup",
      proposalId: record.selectionProposal.id,
      agentIds: selectedIds,
      createdAt: respondedAt,
    });

    try {
      const prepared = await this.solana.prepareMission(this.mustGetMission(missionId));
      this.store.appendEvent(missionId, {
        id: `evt_${nanoid(10)}`,
        missionId,
        type: "TASK_COMPLETE",
        label: "Onchain budget rails prepared for the approved mission",
        taskId: "task-plan",
        agentId: "coordinator-1",
        outputRef: prepared.txSignature,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to prepare the onchain mission budget";
      this.store.mutate(missionId, (current) => ({
        ...current,
        status: "failed",
        failureReason: message,
      }));
      throw error;
    }

    for (const agent of selectedAgents) {
      this.store.appendEvent(missionId, {
        id: `evt_${nanoid(10)}`,
        missionId,
        type: "AGENT_SELECTED",
        label: `${agent.name} is approved for this mission`,
        agentId: agent.id,
        role: agent.role,
        createdAt: new Date().toISOString(),
      });
    }

    queueMicrotask(() => {
      this.runMission(missionId).catch((error) => {
        console.error("Mission run failed", error);
      });
    });

    return this.mustGetMission(missionId);
  }

  async resolveSpendApproval(
    missionId: string,
    approvalId: string,
    approve: boolean,
  ): Promise<MissionRecord> {
    const record = this.mustGetMission(missionId);
    const approval = record.pendingSpendApprovals.find((item) => item.id === approvalId);
    if (!approval) {
      throw new Error("Spend approval request not found");
    }

    if (!approve) {
      const reason = `Human rejected the payment request for ${approval.service}`;
      this.failAgentPhase(
        missionId,
        approval.agentId,
        "wait_for_payment",
        reason,
      );
      this.store.mutate(missionId, (current) => ({
        ...current,
        status: "failed",
        failureReason: reason,
        pendingSpendApprovals: current.pendingSpendApprovals.filter(
          (item) => item.id !== approvalId,
        ),
        tasks: current.tasks.map((task) =>
          task.assignedAgentId === approval.agentId && task.status !== "complete"
            ? { ...task, status: "failed" }
            : task,
        ),
      }));

      this.store.appendEvent(missionId, {
        id: `evt_${nanoid(10)}`,
        missionId,
        type: "SPEND_REJECTED",
        label: "Human rejected a spend request",
        agentId: approval.agentId,
        amount: approval.amount,
        service: approval.service,
        reason,
        approvalId,
        createdAt: new Date().toISOString(),
      });
      this.store.appendEvent(missionId, {
        id: `evt_${nanoid(10)}`,
        missionId,
        type: "MISSION_FAILED",
        label: "Mission halted because a required payment was rejected",
        reason,
        createdAt: new Date().toISOString(),
      });
      return this.mustGetMission(missionId);
    }

    const agent = record.agents.find((item) => item.id === approval.agentId);
    if (!agent) {
      throw new Error(`Agent ${approval.agentId} is not selected for this mission`);
    }

    const policy = this.policy.authorize(record, agent, approval.amount, approval.service);
    if (!policy.approved) {
      throw new Error(policy.reason ?? "Spend request is not allowed");
    }

    const receipt = await this.solana.authorizeSpend(
      record,
      approval.agentId,
      approval.service,
      approval.amount,
      approval.purpose,
    );

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "active",
      pendingSpendApprovals: current.pendingSpendApprovals.filter(
        (item) => item.id !== approvalId,
      ),
      budget: {
        ...current.budget,
        spent: roundUsd(current.budget.spent + approval.amount),
        remaining: roundUsd(current.budget.remaining - approval.amount),
      },
      receipts: [...current.receipts, receipt],
      agents: current.agents.map((item) =>
        item.id === approval.agentId
          ? {
              ...item,
              costIncurred: roundUsd((item.costIncurred ?? 0) + approval.amount),
              status: "idle",
              currentAction: `Payment approved for ${approval.service}`,
            }
          : item,
      ),
    }));

    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "SPEND_APPROVED",
      label: "Human approved a payment and MissionMesh executed it",
      agentId: approval.agentId,
      amount: approval.amount,
      service: approval.service,
      txSignature: receipt.txSignature,
      approvalId,
      createdAt: new Date().toISOString(),
    });
    this.completeAgentPhase(
      missionId,
      approval.agentId,
      "wait_for_payment",
      `Payment approved for ${approval.service}`,
    );

    queueMicrotask(() => {
      this.runMission(missionId).catch((error) => {
        console.error("Mission run failed", error);
      });
    });

    return this.mustGetMission(missionId);
  }

  async runMission(missionId: string): Promise<void> {
    const existingRun = this.inFlightRuns.get(missionId);
    if (existingRun) {
      return existingRun;
    }

    const run = this.executeMission(missionId)
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Mission runner failed";
        this.store.mutate(missionId, (record) => ({
          ...record,
          status: "failed",
          failureReason: message,
        }));
        this.store.appendEvent(missionId, {
          id: `evt_${nanoid(10)}`,
          missionId,
          type: "MISSION_FAILED",
          label: "Mission execution failed",
          reason: message,
          createdAt: new Date().toISOString(),
        });
        throw error;
      })
      .finally(() => {
        this.inFlightRuns.delete(missionId);
      });

    this.inFlightRuns.set(missionId, run);
    return run;
  }

  private async executeMission(missionId: string): Promise<void> {
    for (let index = 0; index < 12; index += 1) {
      const record = this.mustGetMission(missionId);
      if (record.status !== "active") {
        return;
      }

      if (record.pendingSpendApprovals.length > 0) {
        this.store.mutate(missionId, (current) => ({
          ...current,
          status: "awaiting_spend_approval",
        }));
        return;
      }

      if (!this.isTaskComplete(record, "task-news")) {
        const ready = this.ensureSpendApproval(missionId, "task-news");
        if (!ready) {
          return;
        }
        await this.runNewsTask(missionId);
        continue;
      }

      if (!this.isTaskComplete(record, "task-market")) {
        const ready = this.ensureSpendApproval(missionId, "task-market");
        if (!ready) {
          return;
        }
        await this.runMarketTask(missionId);
        continue;
      }

      if (!this.isTaskComplete(record, "task-skeptic")) {
        const ready = this.ensureSpendApproval(missionId, "task-skeptic");
        if (!ready) {
          return;
        }
        await this.runSkepticTask(missionId);
        continue;
      }

      if (!this.isTaskComplete(record, "task-execution")) {
        await this.runExecutionTask(missionId);
        continue;
      }

      if (!this.isTaskComplete(record, "task-verify")) {
        await this.runVerificationTask(missionId);
        return;
      }

      return;
    }

    throw new Error("Mission exceeded the maximum execution steps");
  }

  private buildSelectionProposal(): AgentSelectionProposal {
    return {
      id: `proposal_${nanoid(8)}`,
      status: "pending",
      recommendedAgentIds: [...DEFAULT_SELECTION_AGENT_IDS],
      chosenAgentIds: [...DEFAULT_SELECTION_AGENT_IDS],
      reason:
        "This mission needs a curated team for news, market structure, skepticism, execution, and verification.",
      createdAt: new Date().toISOString(),
    };
  }

  private buildAgentProfiles(agentIds: string[], selected: boolean): AgentProfile[] {
    return this.registry.getMany(agentIds).map((agent) => ({
      ...this.registry.toProfile(agent, BUDGET_CAPS[agent.id] ?? 0),
      selected,
      status: selected
        ? agent.role === "verifier"
          ? "waiting"
          : "idle"
        : "waiting",
      currentAction: selected
        ? agent.role === "verifier"
          ? "Waiting for downstream execution"
          : "Ready for mission start"
        : "Awaiting human approval",
    }));
  }

  private buildMissionTasks(agentIds: string[], approved: boolean): MissionTask[] {
    const selectedAgents = this.registry.getMany(agentIds);
    const agentIdByRole = new Map(selectedAgents.map((agent) => [agent.role, agent.id]));

    return [
      {
        id: "task-plan",
        title: "Review the proposed agent team",
        objective:
          "MissionMesh proposes a curated lineup and waits for a human to approve or change it.",
        assignedAgent: "coordinator",
        dependencies: [],
        budgetAllocation: 0,
        approvedServices: [],
        verificationExpectation: "Human approval recorded for the selected agents",
        status: "complete",
      },
      {
        id: "task-news",
        title: "Build the Trump news timeline",
        objective:
          "Collect the most relevant Trump-related headlines, timestamps, and public narrative shifts.",
        assignedAgent: "news",
        assignedAgentId: agentIdByRole.get("news"),
        dependencies: ["task-plan"],
        budgetAllocation: 0.45,
        approvedServices: ["headline-feed.ai", "archive-indexer.ai"],
        verificationExpectation: "Timestamped news summary with artifacts",
        status: approved ? "pending" : "waiting",
      },
      {
        id: "task-market",
        title: "Scan Trump-linked Polymarket markets",
        objective:
          "Review current Trump-related contracts, price movements, spreads, and recent changes.",
        assignedAgent: "market",
        assignedAgentId: agentIdByRole.get("market"),
        dependencies: ["task-plan"],
        budgetAllocation: 0.55,
        approvedServices: ["polymarket-scan.ai", "orderflow-ai"],
        verificationExpectation: "Ranked markets with timing notes",
        status: approved ? "pending" : "waiting",
      },
      {
        id: "task-skeptic",
        title: "Challenge the edge",
        objective:
          "Decide whether the apparent opportunity is real, stale, or too suspicious to touch.",
        assignedAgent: "skeptic",
        assignedAgentId: agentIdByRole.get("skeptic"),
        dependencies: ["task-news", "task-market"],
        budgetAllocation: 0.3,
        approvedServices: ["signal-replay.ai"],
        verificationExpectation: "Asymmetry score and caution flags",
        status: "waiting",
      },
      {
        id: "task-execution",
        title: "Prepare the final recommendation",
        objective:
          "Turn the analysis into a verdict: good trade, no trade, too late, or too suspicious.",
        assignedAgent: "execution",
        assignedAgentId: agentIdByRole.get("execution"),
        dependencies: ["task-skeptic"],
        budgetAllocation: 0,
        approvedServices: [],
        verificationExpectation: "Final recommendation artifact",
        status: "waiting",
      },
      {
        id: "task-verify",
        title: "Verify the run and settle",
        objective:
          "Check the output, confirm human approvals were honored, and settle the mission on Solana.",
        assignedAgent: "verifier",
        assignedAgentId: agentIdByRole.get("verifier"),
        dependencies: ["task-execution"],
        budgetAllocation: 0,
        approvedServices: [],
        verificationExpectation: "Verification proof and settlement receipt",
        status: "waiting",
      },
    ];
  }

  private validateSelection(agentIds: string[]): void {
    const agents = this.registry.getMany(agentIds);
    if (agents.length !== agentIds.length) {
      throw new Error("One or more selected agents are missing from the registry");
    }

    for (const role of REQUIRED_AGENT_ROLES) {
      const count = agents.filter((agent) => agent.role === role).length;
      if (count !== 1) {
        throw new Error(`Selection must contain exactly one ${role} agent`);
      }
    }
  }

  private ensureSpendApproval(missionId: string, taskId: keyof typeof SPEND_PLANS): boolean {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, taskId);
    const agent = this.mustGetTaskAgent(record, taskId);
    const plan = SPEND_PLANS[taskId];

    const existingReceipt = record.receipts.find(
      (receipt) => receipt.agentId === agent.id && receipt.purpose === plan.purpose,
    );
    if (existingReceipt) {
      return true;
    }

    const existingApproval = record.pendingSpendApprovals.find(
      (approval) => approval.agentId === agent.id && approval.purpose === plan.purpose,
    );
    if (existingApproval) {
      return false;
    }

    const policy = this.policy.authorize(record, agent, plan.amount, plan.service);
    if (!policy.approved) {
      throw new Error(policy.reason ?? "Spend request is not allowed");
    }

    const approval: SpendApprovalRequest = {
      id: `approval_${nanoid(8)}`,
      missionId,
      agentId: agent.id,
      status: "pending",
      amount: plan.amount,
      service: plan.service,
      purpose: plan.purpose,
      justification: plan.justification,
      requestedAt: new Date().toISOString(),
    };

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "awaiting_spend_approval",
      pendingSpendApprovals: [...current.pendingSpendApprovals, approval],
      tasks: current.tasks.map((item) =>
        item.id === task.id ? { ...item, status: "blocked" } : item,
      ),
      agents: current.agents.map((item) =>
        item.id === agent.id
          ? {
              ...item,
              status: "waiting",
              currentAction: `Waiting for human approval to pay ${plan.service}`,
            }
          : item,
      ),
    }));

    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "SPEND_REQUESTED",
      label: `${agent.name} requested a paid tool call`,
      agentId: agent.id,
      amount: plan.amount,
      service: plan.service,
      approvalId: approval.id,
      createdAt: new Date().toISOString(),
    });
    this.startAgentPhase(
      missionId,
      agent.id,
      "wait_for_payment",
      `Waiting for human approval to pay ${plan.service}`,
    );
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "SPEND_APPROVAL_REQUIRED",
      label: "Mission is paused until a human approves the payment",
      agentId: agent.id,
      amount: plan.amount,
      service: plan.service,
      approvalId: approval.id,
      createdAt: new Date().toISOString(),
    });

    return false;
  }

  private async runNewsTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-news");
    const agent = this.mustGetTaskAgent(record, "task-news");

    this.startTask(missionId, task.id, agent.id, `${agent.name} is building the news timeline`);
    this.startAgentPhase(
      missionId,
      agent.id,
      "plan_timeline",
      "Framing the highest-signal Trump time windows",
    );
    this.completeAgentPhase(
      missionId,
      agent.id,
      "plan_timeline",
      "Mission scope narrowed to the most relevant time windows",
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "gather_headlines",
      "Collecting timestamped Trump headlines and public signals",
    );
    const output = await this.news.execute(record.input.objective);
    this.completeAgentPhase(
      missionId,
      agent.id,
      "gather_headlines",
      "Timestamped headline bundle collected",
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "synthesize_signal",
      "Condensing the timeline into a handoff memo",
    );
    this.artifacts.set(missionId, {
      ...this.artifacts.get(missionId),
      news: output,
    });
    this.completeAgentPhase(
      missionId,
      agent.id,
      "synthesize_signal",
      "News timeline memo packaged for the next agent",
    );
    this.completeTask(
      missionId,
      task.id,
      agent.id,
      output.artifactRef,
      "News bundle finalized",
    );
  }

  private async runMarketTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-market");
    const agent = this.mustGetTaskAgent(record, "task-market");
    const newsOutput = this.artifacts.get(missionId)?.news;
    if (!newsOutput) {
      throw new Error("News output is required before the market scan can run");
    }

    this.startTask(missionId, task.id, agent.id, `${agent.name} is scanning the market`);
    this.startAgentPhase(
      missionId,
      agent.id,
      "map_contracts",
      "Mapping relevant Trump-linked markets",
    );
    this.completeAgentPhase(
      missionId,
      agent.id,
      "map_contracts",
      "Relevant contracts mapped for market inspection",
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "scan_orderflow",
      "Scanning price movement, spread, and liquidity",
    );
    const output = await this.market.execute(record.input.objective, newsOutput.summary);
    this.completeAgentPhase(
      missionId,
      agent.id,
      "scan_orderflow",
      "Market structure and movement scan completed",
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "rank_markets",
      "Ranking the best markets for downstream analysis",
    );
    this.artifacts.set(missionId, {
      ...this.artifacts.get(missionId),
      market: output,
    });
    this.completeAgentPhase(
      missionId,
      agent.id,
      "rank_markets",
      "Actionable markets ranked for the skeptic",
    );
    this.completeTask(
      missionId,
      task.id,
      agent.id,
      output.artifactRef,
      "Market scan complete",
    );
  }

  private async runSkepticTask(missionId: string): Promise<void> {
    const taskRecord = this.mustGetMission(missionId);
    const task = this.mustGetTask(taskRecord, "task-skeptic");
    const agent = this.mustGetTaskAgent(taskRecord, "task-skeptic");
    const artifacts = this.artifacts.get(missionId);
    if (!artifacts?.news || !artifacts.market) {
      throw new Error("News and market artifacts must exist before the skeptic runs");
    }

    this.startTask(missionId, task.id, agent.id, `${agent.name} is challenging the thesis`);
    this.startAgentPhase(
      missionId,
      agent.id,
      "replay_timing",
      "Replaying public signal timing against market moves",
    );
    const output = await this.skeptic.execute(
      artifacts.news.summary,
      artifacts.market.summary,
    );
    this.completeAgentPhase(
      missionId,
      agent.id,
      "replay_timing",
      "Timing replay complete",
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "challenge_thesis",
      "Stress testing whether the edge is real or stale",
    );
    this.completeAgentPhase(
      missionId,
      agent.id,
      "challenge_thesis",
      "Core thesis challenged against the collected evidence",
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "score_suspicion",
      "Estimating whether the setup is too suspicious to touch",
    );
    this.artifacts.set(missionId, {
      ...artifacts,
      skeptic: output,
    });
    this.completeAgentPhase(
      missionId,
      agent.id,
      "score_suspicion",
      "Suspicion score and verdict prepared",
    );
    this.completeTask(
      missionId,
      task.id,
      agent.id,
      output.artifactRef,
      "Skeptic verdict is ready",
    );
  }

  private async runExecutionTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-execution");
    const agent = this.mustGetTaskAgent(record, "task-execution");
    const skepticOutput = this.artifacts.get(missionId)?.skeptic;
    if (!skepticOutput) {
      throw new Error("Skeptic output is required before execution can run");
    }

    this.startTask(
      missionId,
      task.id,
      agent.id,
      `${agent.name} is preparing the final recommendation`,
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "draft_verdict",
      "Drafting the final trade verdict",
    );
    const output = await this.execution.execute(skepticOutput.summary);
    this.completeAgentPhase(
      missionId,
      agent.id,
      "draft_verdict",
      "Core verdict drafted",
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "package_artifact",
      "Packaging the recommendation artifact for verification",
    );
    this.artifacts.set(missionId, {
      ...this.artifacts.get(missionId),
      execution: output,
    });

    const finalResult: MissionResult = {
      verdict: output.verdict,
      headline: output.headline,
      summary: output.recommendation,
      confidence: output.confidence,
      keyPoints: output.keyPoints,
    };

    this.store.mutate(missionId, (current) => ({
      ...current,
      finalResult,
    }));
    this.completeAgentPhase(
      missionId,
      agent.id,
      "package_artifact",
      "Final recommendation artifact packaged",
    );
    this.completeTask(
      missionId,
      task.id,
      agent.id,
      output.artifactRef,
      "Final recommendation drafted",
    );
  }

  private async runVerificationTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-verify");
    const agent = this.mustGetTaskAgent(record, "task-verify");
    const executionOutput = this.artifacts.get(missionId)?.execution;
    if (!executionOutput) {
      throw new Error("Execution output is required before verification can run");
    }

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "verifying",
    }));
    this.startTask(
      missionId,
      task.id,
      agent.id,
      `${agent.name} is verifying the mission result`,
      "verifying",
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "audit_approvals",
      "Auditing that every paid action was explicitly approved",
    );
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "VERIFICATION_RUNNING",
      label: "Verifier is checking outputs and payment approvals",
      createdAt: new Date().toISOString(),
    });

    const verification = await this.verifier.execute(
      record.input.successCriteria,
      executionOutput.recommendation,
    );
    this.completeAgentPhase(
      missionId,
      agent.id,
      "audit_approvals",
      "Human approval audit complete",
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "check_artifacts",
      "Checking the final artifact against the mission criteria",
    );
    const verificationTx = await this.solana.submitVerification(
      record,
      verification.proofHash,
    );

    if (!verification.approved) {
      this.store.mutate(missionId, (current) => ({
        ...current,
        status: "failed",
        verificationChecks: verification.checks,
        failureReason: verification.summary,
      }));
      this.store.appendEvent(missionId, {
        id: `evt_${nanoid(10)}`,
        missionId,
        type: "VERIFICATION_REJECTED",
        label: "Verifier rejected the mission output",
        proofHash: verification.proofHash,
        createdAt: new Date().toISOString(),
      });
      this.store.appendEvent(missionId, {
        id: `evt_${nanoid(10)}`,
        missionId,
        type: "MISSION_FAILED",
        label: "Mission failed verification",
        reason: verification.summary,
        createdAt: new Date().toISOString(),
      });
      this.failAgentPhase(
        missionId,
        agent.id,
        "check_artifacts",
        verification.summary,
      );
      return;
    }

    this.completeAgentPhase(
      missionId,
      agent.id,
      "check_artifacts",
      "Artifacts passed verification checks",
    );
    this.startAgentPhase(
      missionId,
      agent.id,
      "settle_onchain",
      "Submitting verification proof and releasing settlement on Solana",
    );
    const settlementTx = await this.solana.approveSettlement(record);
    const settledRecord = this.mustGetMission(missionId);
    const reputationDeltas = await this.buildReputationDeltas(settledRecord);
    const proof = this.buildProof(settledRecord, verification);

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "settled",
      verificationChecks: verification.checks,
      proof,
      settlement: {
        state: "settled",
        settledAmount: current.budget.spent,
        refundedAmount: current.budget.remaining,
        protocolFee: 0,
      },
      reputationDeltas,
      agents: current.agents.map((item) => ({
        ...item,
        status: "complete",
        currentAction: "Mission settled on Solana",
        currentPhaseStatus:
          item.id === agent.id ? "complete" : item.currentPhaseStatus,
      })),
    }));
    this.completeAgentPhase(
      missionId,
      agent.id,
      "settle_onchain",
      "Settlement recorded on Solana and unused budget refunded",
    );

    this.completeTask(
      missionId,
      task.id,
      agent.id,
      proof.resultHash,
      "Verification complete and settlement released",
      "settled",
    );
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "VERIFICATION_APPROVED",
      label: "Verifier approved the mission output",
      proofHash: verification.proofHash,
      createdAt: new Date().toISOString(),
    });
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "SETTLEMENT_RELEASED",
      label: "MissionMesh released settlement and refunded the unused budget",
      amount: settledRecord.budget.spent,
      txSignature: settlementTx.txSignature,
      createdAt: new Date().toISOString(),
    });

    for (const delta of reputationDeltas) {
      this.store.appendEvent(missionId, {
        id: `evt_${nanoid(10)}`,
        missionId,
        type: "REPUTATION_UPDATED",
        label: "Agent reputation updated after successful completion",
        agentId: delta.agentId,
        delta: delta.delta,
        createdAt: new Date().toISOString(),
      });
    }

    this.store.mutate(missionId, (current) => ({
      ...current,
      proof: {
        ...current.proof!,
        txHashes: [...current.proof!.txHashes, verificationTx.txSignature, settlementTx.txSignature],
      },
    }));
  }

  private buildProof(
    record: MissionRecord,
    verification: {
      summary: string;
      proofHash: string;
    },
  ): MissionProof {
    const artifacts = this.artifacts.get(record.id);
    const artifactLinks = [
      artifacts?.news?.artifactRef,
      artifacts?.market?.artifactRef,
      artifacts?.skeptic?.artifactRef,
      artifacts?.execution?.artifactRef,
    ].filter((item): item is string => Boolean(item));

    return {
      missionId: record.id,
      outputSummary: verification.summary,
      artifactLinks,
      resultHash: verification.proofHash,
      apiReceiptHashes: record.receipts.map((receipt) => receipt.receiptId),
      txHashes: [],
      completionConfidence: record.finalResult?.confidence ?? 0.7,
    };
  }

  private async buildReputationDeltas(record: MissionRecord) {
    const deltas = [];
    for (const agent of record.agents) {
      await this.solana.updateReputation(agent.id, 1);
      deltas.push({
        agentId: agent.id,
        before: agent.trustScore,
        after: Math.min(agent.trustScore + 1, 99),
        delta: 1,
        rationale: "Mission completed successfully with explicit human approvals",
      });
    }
    return deltas;
  }

  private startTask(
    missionId: string,
    taskId: string,
    agentId: string,
    action: string,
    status: MissionRecord["status"] = "active",
  ): void {
    this.store.mutate(missionId, (current) => ({
      ...current,
      status,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, status: "active" } : task,
      ),
      agents: current.agents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              status: "working",
              currentAction: action,
            }
          : agent,
      ),
    }));
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "TASK_STARTED",
      label: action,
      taskId,
      agentId,
      createdAt: new Date().toISOString(),
    });
  }

  private completeTask(
    missionId: string,
    taskId: string,
    agentId: string,
    outputRef: string,
    action: string,
    status: MissionRecord["status"] = "active",
  ): void {
    this.store.mutate(missionId, (current) => ({
      ...current,
      status,
      tasks: current.tasks.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            status: "complete",
            outputArtifactRef: outputRef,
          };
        }

        if (status !== "settled" && task.status === "waiting") {
          const dependenciesMet = task.dependencies.every((dependency) =>
            current.tasks.find((candidate) => candidate.id === dependency)?.status === "complete",
          );
          return dependenciesMet ? { ...task, status: "pending" } : task;
        }

        return task;
      }),
      agents: current.agents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              status: status === "settled" ? "complete" : "idle",
              currentAction: action,
            }
          : agent,
      ),
    }));
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "TASK_COMPLETE",
      label: action,
      taskId,
      agentId,
      outputRef,
      createdAt: new Date().toISOString(),
    });
  }

  private startAgentPhase(
    missionId: string,
    agentId: string,
    phaseId: string,
    detail: string,
  ): void {
    const createdAt = new Date().toISOString();
    let attempt = 1;

    this.store.mutate(missionId, (current) => ({
      ...current,
      agents: current.agents.map((agent) => {
        if (agent.id !== agentId) {
          return agent;
        }

        const previousAttempts =
          agent.phaseHistory?.filter((phase) => phase.phaseId === phaseId).length ?? 0;
        attempt = previousAttempts + 1;

        return {
          ...agent,
          currentPhaseId: phaseId,
          currentPhaseStatus: "active",
          currentAction: detail,
          phaseHistory: [
            ...(agent.phaseHistory ?? []),
            {
              phaseId,
              status: "active",
              detail,
              attempt,
              startedAt: createdAt,
            },
          ],
        };
      }),
    }));

    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "AGENT_PHASE_STARTED",
      label: detail,
      agentId,
      phaseId,
      detail,
      attempt,
      createdAt,
    });
  }

  private completeAgentPhase(
    missionId: string,
    agentId: string,
    phaseId: string,
    detail: string,
  ): void {
    this.resolveAgentPhase(missionId, agentId, phaseId, "complete", detail);
  }

  private failAgentPhase(
    missionId: string,
    agentId: string,
    phaseId: string,
    detail: string,
  ): void {
    this.resolveAgentPhase(missionId, agentId, phaseId, "failed", detail);
  }

  private resolveAgentPhase(
    missionId: string,
    agentId: string,
    phaseId: string,
    status: "complete" | "failed",
    detail: string,
  ): void {
    const createdAt = new Date().toISOString();
    let attempt = 1;

    this.store.mutate(missionId, (current) => ({
      ...current,
      agents: current.agents.map((agent) => {
        if (agent.id !== agentId) {
          return agent;
        }

        const phaseHistory = [...(agent.phaseHistory ?? [])];
        const phaseIndex = findLatestActivePhaseIndex(phaseHistory, phaseId);
        if (phaseIndex === -1) {
          const previousAttempts =
            phaseHistory.filter((phase) => phase.phaseId === phaseId).length;
          attempt = previousAttempts + 1;
          phaseHistory.push({
            phaseId,
            status,
            detail,
            attempt,
            startedAt: createdAt,
            completedAt: createdAt,
          });
        } else {
          attempt = phaseHistory[phaseIndex]?.attempt ?? 1;
          phaseHistory[phaseIndex] = {
            ...phaseHistory[phaseIndex]!,
            status,
            detail,
            completedAt: createdAt,
          };
        }

        return {
          ...agent,
          currentPhaseId: phaseId,
          currentPhaseStatus: status,
          currentAction: detail,
          phaseHistory,
        };
      }),
    }));

    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: status === "complete" ? "AGENT_PHASE_COMPLETED" : "AGENT_PHASE_FAILED",
      label: detail,
      agentId,
      phaseId,
      detail,
      attempt,
      createdAt,
    });
  }

  private mustGetMission(missionId: string): MissionRecord {
    const record = this.store.get(missionId);
    if (!record) {
      throw new Error(`Mission ${missionId} not found`);
    }
    return record;
  }

  private mustGetTask(record: MissionRecord, taskId: string): MissionTask {
    const task = record.tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found for mission ${record.id}`);
    }
    return task;
  }

  private mustGetTaskAgent(record: MissionRecord, taskId: string): AgentProfile {
    const task = this.mustGetTask(record, taskId);
    const agent = record.agents.find((item) => item.id === task.assignedAgentId);
    if (!agent) {
      throw new Error(`Agent for task ${taskId} is not selected`);
    }
    return agent;
  }

  private isTaskComplete(record: MissionRecord, taskId: string): boolean {
    return this.mustGetTask(record, taskId).status === "complete";
  }
}

function roundUsd(value: number): number {
  return Number(value.toFixed(2));
}

function sameMembers(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

function findLatestActivePhaseIndex(
  phaseHistory: Array<{ phaseId: string; status: string }>,
  phaseId: string,
): number {
  for (let index = phaseHistory.length - 1; index >= 0; index -= 1) {
    const phase = phaseHistory[index];
    if (phase?.phaseId === phaseId && phase.status === "active") {
      return index;
    }
  }
  return -1;
}
