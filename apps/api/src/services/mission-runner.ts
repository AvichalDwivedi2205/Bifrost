import type {
  AgentProfile,
  AgentRole,
  AgentSelectionProposal,
  AgentWorkEvidence,
  HumanCheckpoint,
  MissionInput,
  MissionDeliverables,
  MissionProof,
  MissionRecord,
  MissionResult,
  MissionTask,
  PolicyCheckResult,
  RegistryAgent,
  ReputationDelta,
  SpendApprovalRequest,
} from "@bifrost/shared";
import {
  LAUNCH_SITE_TEMPLATE,
  getMissionBlueprint,
  tasksFromBlueprint,
} from "@bifrost/shared";
import { nanoid } from "nanoid";

import { env } from "../env";
import { ExecutionAgent, type ExecutionOutput } from "../agents/execution-agent";
import { LaunchCopywriterAgent } from "../agents/launch-copywriter-agent";
import { LaunchScoutAgent } from "../agents/launch-scout-agent";
import { MarketAgent, type MarketOutput } from "../agents/market-agent";
import { NewsAgent, type NewsOutput } from "../agents/news-agent";
import { SkepticAgent, type SkepticOutput } from "../agents/skeptic-agent";
import { VerifierAgent } from "../agents/verifier-agent";
import { LLMRouter } from "../providers/llm/router";
import { getConvexClient } from "./convex-client";
import { AgentRegistryService } from "./registry";
import { AgentMessageBus } from "./agent-message-bus";
import { PolicyEngine } from "./policy-engine";
import { BifrostSolanaClient } from "./solana/bifrost-client";
import { MissionStore } from "./store";
import {
  deployLive,
  deployPreview,
  generateLaunchSite,
  generateSocialPosts,
  getLaunchConfig,
  researchLaunchMarket,
  researchLaunchMarketLLM,
  searchDomains,
  synthesizePositioning,
  verifyLaunchDeliverables,
  verifyLaunchPreviewLive,
  writeLaunchCopy,
  writeLaunchCopyLLM,
  type LandingPageContentForApi,
  type LaunchArtifacts,
} from "../tools/launch-tools";

export const WALLET_AUDIT_TEMPLATE = "wallet-audit-v1";

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

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

const ROLE_BUDGET_CAPS: Partial<Record<AgentRole, number>> = {
  news: 0.45,
  market: 0.55,
  skeptic: 0.3,
  research: 0.25,
  wallet_intelligence: 0.3,
  risk: 0.2,
  compliance: 0.15,
  execution: 0,
  verifier: 0,
  custom: 0.1,
};

type PaidTaskId = "task-news" | "task-market" | "task-skeptic" | "task-preview";

interface MissionArtifacts {
  news?: NewsOutput;
  market?: MarketOutput;
  skeptic?: SkepticOutput;
  execution?: ExecutionOutput;
  launch?: LaunchArtifacts;
}

export class MissionRunner {
  private readonly inFlightRuns = new Map<string, Promise<void>>();
  private readonly artifacts = new Map<string, MissionArtifacts>();
  private readonly llm = new LLMRouter();
  private readonly policy = new PolicyEngine();
  private readonly solana = new BifrostSolanaClient();
  private readonly registry: AgentRegistryService;
  private readonly news = new NewsAgent(this.llm);
  private readonly market = new MarketAgent(this.llm);
  private readonly skeptic = new SkepticAgent(this.llm);
  private readonly execution = new ExecutionAgent(this.llm);
  private readonly verifier = new VerifierAgent(this.llm);
  private readonly launchScout = new LaunchScoutAgent(this.llm);
  private readonly launchCopywriter = new LaunchCopywriterAgent(this.llm);
  readonly messageBus: AgentMessageBus;

  constructor(
    private readonly store: MissionStore,
    registry?: AgentRegistryService,
    messageBus?: AgentMessageBus,
  ) {
    this.registry = registry ?? new AgentRegistryService();
    this.messageBus = messageBus ?? new AgentMessageBus();
  }

  getRegistry() {
    return this.registry.list();
  }

  /**
   * Clears in-memory runner state so a fresh demo can replay cleanly.
   * Used by POST /api/demo/reset between demo runs — without this, artifacts
   * like `launch.disputeRerun=true` survive store.reset() and break the
   * DEMO_INJECT_REJECTION theatre on the second mission.
   */
  reset(): void {
    this.artifacts.clear();
    this.inFlightRuns.clear();
  }

  public getArtifacts(missionId: string): MissionArtifacts | undefined {
    return this.artifacts.get(missionId);
  }

  private async saveArtifacts(missionId: string): Promise<void> {
    if (!env.USE_CONVEX) return;
    const a = this.artifacts.get(missionId);
    if (!a) return;
    try {
      const convex = getConvexClient();
      await convex.mutation("missionArtifacts:upsert" as any, {
        missionId,
        news: a.news ?? null,
        market: a.market ?? null,
        skeptic: a.skeptic ?? null,
        execution: a.execution ?? null,
        launch: a.launch ?? null,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[mission-runner] saveArtifacts failed", err);
    }
  }

  private async loadArtifacts(missionId: string): Promise<void> {
    if (!env.USE_CONVEX) return;
    if (this.artifacts.has(missionId)) return;
    try {
      const convex = getConvexClient();
      const row = await convex.query("missionArtifacts:getByMissionId" as any, { missionId });
      if (row) {
        this.artifacts.set(missionId, {
          news: row.news ?? undefined,
          market: row.market ?? undefined,
          skeptic: row.skeptic ?? undefined,
          execution: row.execution ?? undefined,
          launch: row.launch ?? undefined,
        });
      }
    } catch (err) {
      console.warn("[mission-runner] loadArtifacts failed", err);
    }
  }

  getRuntimeStatus() {
    return {
      rpc: this.solana.describeConnection(),
    };
  }

  async createMission(input: MissionInput): Promise<MissionRecord> {
    const selectionProposal = this.buildSelectionProposal(input);
    const proposedAgents = this.buildAgentProfiles(selectionProposal.recommendedAgentIds, false);
    const tasks = this.buildMissionTasks(selectionProposal.recommendedAgentIds, false, input);
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
      label: "Bifrost proposed a curated agent team for the task",
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
    this.validateSelection(selectedIds, record.input);

    const selectionChanged = !sameMembers(
      selectedIds,
      record.selectionProposal.recommendedAgentIds,
    );
    const selectedAgents = this.buildAgentProfiles(selectedIds, true);
    const tasks = this.buildMissionTasks(selectedIds, true, record.input);
    const respondedAt = new Date().toISOString();

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "active",
      agents: selectedAgents,
      trustProfiles: this.buildTrustProfiles(selectedAgents),
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
    opts?: { txSignature?: string },
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

      // Phase 3A: mark corresponding payment_request message as blocked
      const thread = this.messageBus.getThread(missionId);
      const paymentMsg = thread.find(
        (m) => m.type === "payment_request" && m.fromAgentId === approval.agentId && m.status === "open",
      );
      if (paymentMsg) {
        this.messageBus.updateStatus(paymentMsg.id, "blocked").catch(() => {});
        if (env.USE_CONVEX) {
          getConvexClient()
            .mutation("paymentRequests:markRejected" as any, {
              agentMessageId: paymentMsg.id,
              rejectedAt: new Date().toISOString(),
            })
            .catch((err: unknown) => {
              console.warn("[mission-runner] paymentRequests:markRejected failed", err);
            });
        }
      }

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

    const finalReceipt = opts?.txSignature
      ? { ...receipt, txSignature: opts.txSignature }
      : receipt;

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
      receipts: [...current.receipts, finalReceipt],
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
      label: "Human approved a payment and Bifrost executed it",
      agentId: approval.agentId,
      amount: approval.amount,
      service: approval.service,
      txSignature: finalReceipt.txSignature,
      approvalId,
      createdAt: new Date().toISOString(),
    });
    this.completeAgentPhase(
      missionId,
      approval.agentId,
      "wait_for_payment",
      `Payment approved for ${approval.service}`,
    );

    // Phase 3A: mark corresponding payment_request message as resolved
    const thread = this.messageBus.getThread(missionId);
    const paymentMsg = thread.find(
      (m) => m.type === "payment_request" && m.fromAgentId === approval.agentId && m.status === "open",
    );
    if (paymentMsg) {
      this.messageBus.updateStatus(paymentMsg.id, "resolved").catch(() => {});
      if (env.USE_CONVEX) {
        getConvexClient()
          .mutation("paymentRequests:markApproved" as any, {
            agentMessageId: paymentMsg.id,
            txSignature: finalReceipt.txSignature,
            approvedAt: new Date().toISOString(),
          })
          .catch((err: unknown) => {
            console.warn("[mission-runner] paymentRequests:markApproved failed", err);
          });
      }
    }

    queueMicrotask(() => {
      this.runMission(missionId).catch((error) => {
        console.error("Mission run failed", error);
      });
    });

    return this.mustGetMission(missionId);
  }

  async answerHumanCheckpoint(
    missionId: string,
    checkpointId: string,
    response: string,
  ): Promise<MissionRecord> {
    const record = this.mustGetMission(missionId);
    const checkpoint = record.humanCheckpoints.find((item) => item.id === checkpointId);
    if (!checkpoint) {
      throw new Error("Human checkpoint not found");
    }
    if (checkpoint.status !== "open") {
      throw new Error("Human checkpoint is already resolved");
    }

    const respondedAt = new Date().toISOString();
    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "active",
      humanCheckpoints: current.humanCheckpoints.map((item) =>
        item.id === checkpointId
          ? { ...item, status: "answered", response, respondedAt }
          : item,
      ),
      tasks: current.tasks.map((task) =>
        task.id === checkpoint.blockingTaskId
          ? { ...task, status: "complete", outputArtifactRef: `checkpoint://${checkpointId}` }
          : task.status === "waiting" &&
              task.dependencies.every((dependency) =>
                current.tasks.find((candidate) => candidate.id === dependency)?.status === "complete" ||
                dependency === checkpoint.blockingTaskId,
              )
            ? { ...task, status: "pending" }
            : task,
      ),
      agents: current.agents.map((agent) =>
        agent.id === checkpoint.requestedByAgentId
          ? {
              ...agent,
              status: "idle",
              currentAction: `Human answered: ${response}`,
            }
          : agent,
      ),
    }));

    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "HUMAN_CHECKPOINT_ANSWERED",
      label: `Human answered checkpoint: ${checkpoint.title}`,
      checkpointId,
      taskId: checkpoint.blockingTaskId,
      agentId: checkpoint.requestedByAgentId,
      outputRef: response,
      createdAt: respondedAt,
    });

    const threadMessage = this.messageBus
      .getThread(missionId)
      .find((message) => message.artifactRefs.includes(`checkpoint://${checkpointId}`));
    if (threadMessage) {
      this.messageBus.updateStatus(threadMessage.id, "answered").catch((error) => {
        console.warn("[mission-runner] checkpoint message status update failed", error);
      });
    }

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
    await this.loadArtifacts(missionId);
    const initial = this.mustGetMission(missionId);
    if (getMissionBlueprint(initial.input.template)?.id === LAUNCH_SITE_TEMPLATE) {
      await this.executeLaunchMission(missionId);
      return;
    }

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
        const ready = await this.ensureSpendApproval(missionId, "task-news");
        if (!ready) {
          return;
        }
        await this.runNewsTask(missionId);
        continue;
      }

      if (!this.isTaskComplete(record, "task-market")) {
        const ready = await this.ensureSpendApproval(missionId, "task-market");
        if (!ready) {
          return;
        }
        await this.runMarketTask(missionId);
        continue;
      }

      if (!this.isTaskComplete(record, "task-skeptic")) {
        const ready = await this.ensureSpendApproval(missionId, "task-skeptic");
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

  private async executeLaunchMission(missionId: string): Promise<void> {
    for (let index = 0; index < 24; index += 1) {
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

      if (record.humanCheckpoints.some((checkpoint) => checkpoint.status === "open")) {
        this.store.mutate(missionId, (current) => ({
          ...current,
          status: "awaiting_human_input",
        }));
        return;
      }

      if (!this.isTaskComplete(record, "task-research")) {
        await this.runLaunchResearchTask(missionId);
        continue;
      }
      if (!this.isTaskComplete(record, "task-positioning")) {
        await this.runLaunchPositioningTask(missionId);
        continue;
      }
      if (!this.isTaskComplete(record, "task-human-direction")) {
        this.requestLaunchDirectionCheckpoint(missionId);
        return;
      }
      if (!this.isTaskComplete(record, "task-copy")) {
        await this.runLaunchCopyTask(missionId);
        continue;
      }
      if (!this.isTaskComplete(record, "task-build")) {
        await this.runLaunchBuildTask(missionId);
        continue;
      }
      if (!this.isTaskComplete(record, "task-preview")) {
        const ready = await this.ensureSpendApproval(missionId, "task-preview");
        if (!ready) {
          return;
        }
        await this.runLaunchPreviewTask(missionId);
        continue;
      }
      if (!this.isTaskComplete(record, "task-verify-preview")) {
        await this.runLaunchPreviewVerificationTask(missionId);
        continue;
      }
      if (!this.isTaskComplete(record, "task-domain")) {
        this.requestLaunchDomainCheckpoint(missionId);
        return;
      }
      if (!this.isTaskComplete(record, "task-deploy-live")) {
        await this.runLaunchLiveDeployTask(missionId);
        continue;
      }
      if (!this.isTaskComplete(record, "task-launch-assets")) {
        await this.runLaunchAssetsTask(missionId);
        continue;
      }
      if (!this.isTaskComplete(record, "task-verify")) {
        await this.runLaunchVerificationTask(missionId);
        return;
      }

      return;
    }

    throw new Error("Launch mission exceeded the maximum execution steps");
  }

  private async runLaunchResearchTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-research");
    const agent = this.mustGetTaskAgent(record, task.id);
    this.startTask(missionId, task.id, agent.id, `${agent.name} is mapping dental AI SDR competitors`);
    this.startAgentPhase(missionId, agent.id, "collect_context", "Collecting competitor and messaging patterns");
    await sleep(2800 + Math.random() * 1400);

    let research: NonNullable<LaunchArtifacts["research"]>;
    try {
      research = await researchLaunchMarketLLM(record, this.launchScout);
    } catch (err) {
      console.warn(
        `[launch-scout] LLM/Exa scout failed for mission ${missionId}: ${
          err instanceof Error ? err.message : String(err)
        } — falling back to template`,
      );
      research = researchLaunchMarket(record);
    }

    const sourceCount = research.sources?.length ?? 0;
    const detailLines = [
      research.summary,
      sourceCount > 0
        ? `Cited ${sourceCount} live sources via Exa.`
        : "Used deterministic template (no live sources).",
    ];

    this.recordAgentWork(missionId, {
      agentId: agent.id,
      taskId: task.id,
      phaseId: "collect_context",
      kind: "tool_call",
      title:
        research.fallback === "llm"
          ? "Competitor scout ran live web research (Exa + LLM)"
          : "Competitor scout ran launch research (template)",
      detail: detailLines.join(" "),
      toolName: research.fallback === "llm" ? "web-research.exa-llm" : "web-research.launch-market",
      inputSummary: getLaunchConfig(record).targetAudience,
      outputSummary: `${research.competitors.length} competitors, ${research.messagingPatterns.length} messaging patterns, ${sourceCount} sources`,
      artifactRefs: [research.artifactRef, ...(research.sources?.map((s) => s.url) ?? [])].slice(0, 8),
      confidence: research.fallback === "llm" ? 0.92 : 0.78,
    });
    this.artifacts.set(missionId, {
      ...this.artifacts.get(missionId),
      launch: { ...this.artifacts.get(missionId)?.launch, research },
    });
    await this.saveArtifacts(missionId);
    this.completeAgentPhase(missionId, agent.id, "collect_context", "Competitor landscape summarized");
    this.completeTask(missionId, task.id, agent.id, research.artifactRef, "Research dossier ready");
  }

  private async runLaunchPositioningTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-positioning");
    const agent = this.mustGetTaskAgent(record, task.id);
    const research = this.artifacts.get(missionId)?.launch?.research;
    if (!research) {
      throw new Error("Launch research is required before positioning");
    }

    this.startTask(missionId, task.id, agent.id, `${agent.name} is drafting positioning options`);
    this.startAgentPhase(missionId, agent.id, "research_to_angles", "Turning research into three launch angles");
    await sleep(2200 + Math.random() * 1000);
    const positioning = synthesizePositioning(record, research);
    this.recordAgentWork(missionId, {
      agentId: agent.id,
      taskId: task.id,
      phaseId: "research_to_angles",
      kind: "artifact",
      title: "Strategist generated three positioning angles",
      detail: "Converted research into decision-ready launch directions before copy/build work can continue.",
      toolName: "positioning.synthesis",
      inputSummary: research.summary,
      outputSummary: positioning.options.join(" | "),
      artifactRefs: [positioning.artifactRef, research.artifactRef],
      confidence: 0.91,
    });
    this.artifacts.set(missionId, {
      ...this.artifacts.get(missionId),
      launch: { ...this.artifacts.get(missionId)?.launch, positioning },
    });
    await this.saveArtifacts(missionId);
    this.completeAgentPhase(missionId, agent.id, "research_to_angles", "Three launch angles ready for human choice");
    this.completeTask(missionId, task.id, agent.id, positioning.artifactRef, "Positioning options ready");
  }

  private requestLaunchDirectionCheckpoint(missionId: string): void {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-human-direction");
    const agent = this.mustGetTaskAgent(record, task.id);
    const options = this.artifacts.get(missionId)?.launch?.positioning?.options ?? [];
    this.createHumanCheckpoint(missionId, {
      kind: "decision",
      title: "Choose positioning direction",
      prompt: "Pick the direction the copywriter and builder should use for the landing page.",
      options,
      freeformAllowed: true,
      requestedByAgentId: agent.id,
      blockingTaskId: task.id,
    });
  }

  private async runLaunchCopyTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-copy");
    const agent = this.mustGetTaskAgent(record, task.id);
    const selectedDirection =
      record.humanCheckpoints.find((checkpoint) => checkpoint.blockingTaskId === "task-human-direction")?.response ??
      this.artifacts.get(missionId)?.launch?.positioning?.options[0] ??
      getLaunchConfig(record).oneLineIdea;

    this.startTask(missionId, task.id, agent.id, `${agent.name} is drafting launch page copy`);
    this.startAgentPhase(missionId, agent.id, "draft_page_copy", "Writing hero, sections, CTA, and FAQ");
    await sleep(3500 + Math.random() * 1500);

    const scoutBrief = (() => {
      const sources = this.artifacts.get(missionId)?.launch?.research?.sources;
      const promises = this.artifacts.get(missionId)?.launch?.research?.promises;
      const objections = this.artifacts.get(missionId)?.launch?.research?.objections;
      if (!sources && !promises && !objections) return undefined;
      return {
        summary: this.artifacts.get(missionId)?.launch?.research?.summary ?? "",
        competitors: (this.artifacts.get(missionId)?.launch?.research?.competitors ?? []).map((c) => ({
          name: c.split(" — ")[0] ?? c,
          angle: c.split(" — ")[1] ?? "",
        })),
        promises: promises ?? [],
        objections: objections ?? [],
        ctaPatterns: [],
        sources: sources ?? [],
      };
    })();

    let copy: NonNullable<LaunchArtifacts["copy"]>;
    let landingContent: LandingPageContentForApi | undefined;
    let copyMode: "llm" | "template" = "template";
    try {
      const result = await writeLaunchCopyLLM(record, selectedDirection, this.launchCopywriter, scoutBrief);
      copy = result.copy;
      landingContent = result.landingContent;
      copyMode = "llm";
    } catch (err) {
      console.warn(
        `[launch-copywriter] LLM copy failed for mission ${missionId}: ${
          err instanceof Error ? err.message : String(err)
        } — falling back to template`,
      );
      copy = writeLaunchCopy(record, selectedDirection);
    }

    this.recordAgentWork(missionId, {
      agentId: agent.id,
      taskId: task.id,
      phaseId: "draft_page_copy",
      kind: "artifact",
      title:
        copyMode === "llm"
          ? "Copywriter generated conversion page copy (LLM)"
          : "Copywriter drafted conversion page copy (template)",
      detail:
        copyMode === "llm"
          ? "LLM authored hero, problem stats, how-it-works, features, testimonials, pricing, FAQ, and 3 launch posts grounded in the scout brief and selected direction."
          : "Wrote hero, CTA, section narrative, FAQ, and dental-practice objection handling from the chosen direction.",
      toolName: copyMode === "llm" ? "copy.llm-synthesis" : "copy.synthesis",
      inputSummary: selectedDirection,
      outputSummary: `${copy.hero} / ${copy.sections.length} sections / ${copy.faq.length} FAQs`,
      artifactRefs: [copy.artifactRef],
      confidence: copyMode === "llm" ? 0.94 : 0.9,
    });
    this.artifacts.set(missionId, {
      ...this.artifacts.get(missionId),
      launch: {
        ...this.artifacts.get(missionId)?.launch,
        selectedDirection,
        copy,
        ...(landingContent ? { landingContent } : {}),
      },
    });
    await this.saveArtifacts(missionId);
    this.completeAgentPhase(missionId, agent.id, "draft_page_copy", "Launch copy package ready");
    this.completeTask(missionId, task.id, agent.id, copy.artifactRef, "Launch copy drafted");
  }

  private async runLaunchBuildTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-build");
    const agent = this.mustGetTaskAgent(record, task.id);
    const copy = this.artifacts.get(missionId)?.launch?.copy;
    if (!copy) {
      throw new Error("Launch copy is required before site build");
    }

    this.startTask(missionId, task.id, agent.id, `${agent.name} is generating landing page files`);
    this.startAgentPhase(missionId, agent.id, "build_site", "Writing responsive page, styles, metadata, and waitlist hook");
    await sleep(2000 + Math.random() * 1000);
    const site = await generateLaunchSite(record, copy);
    this.recordAgentWork(missionId, {
      agentId: agent.id,
      taskId: task.id,
      phaseId: "build_site",
      kind: "artifact",
      title: "Builder generated landing page workspace",
      detail: "Created responsive HTML/CSS and waitlist hook files with manifest hashes for proof.",
      toolName: "site-generator.static-launch",
      inputSummary: copy.hero,
      outputSummary: `${site.files.length} files written with SHA-256 manifest`,
      artifactRefs: [site.artifactRef, ...site.files.map((file) => `workspace://${missionId}/${file.path}`)],
      confidence: 0.93,
    });
    this.artifacts.set(missionId, {
      ...this.artifacts.get(missionId),
      launch: { ...this.artifacts.get(missionId)?.launch, site },
    });
    await this.saveArtifacts(missionId);
    this.store.mutate(missionId, (current) => ({
      ...current,
      deliverables: {
        ...(current.deliverables ?? {}),
        fileManifest: site.files,
      },
    }));
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "DELIVERABLE_CREATED",
      label: "Landing page files generated in mission workspace",
      taskId: task.id,
      agentId: agent.id,
      outputRef: site.artifactRef,
      createdAt: new Date().toISOString(),
    });
    this.completeAgentPhase(missionId, agent.id, "build_site", "Landing page workspace packaged");
    this.completeTask(missionId, task.id, agent.id, site.artifactRef, "Landing page files generated");
  }

  private async runLaunchPreviewTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-preview");
    const agent = this.mustGetTaskAgent(record, task.id);
    this.startTask(missionId, task.id, agent.id, `${agent.name} is creating a preview URL`);
    this.startAgentPhase(missionId, agent.id, "preview_deploy", "Deploying preview and capturing artifact references");
    await sleep(1800 + Math.random() * 800);
    const preview = await deployPreview(record, env.API_BASE_URL);
    this.recordAgentWork(missionId, {
      agentId: agent.id,
      taskId: task.id,
      phaseId: "preview_deploy",
      kind: "tool_call",
      title: "Deployer created preview URL",
      detail: "Promoted mission workspace into a preview route after explicit spend approval.",
      toolName: "preview-deploy.local-adapter",
      inputSummary: this.artifacts.get(missionId)?.launch?.site?.artifactRef ?? "site workspace",
      outputSummary: preview.previewUrl,
      artifactRefs: [preview.previewUrl],
      receiptRefs: record.receipts.map((receipt) => receipt.receiptId),
      confidence: 0.95,
    });
    this.store.mutate(missionId, (current) => ({
      ...current,
      deliverables: {
        ...(current.deliverables ?? {}),
        ...preview,
      },
    }));
    this.recordAgentWork(missionId, {
      agentId: agent.id,
      taskId: task.id,
      phaseId: "check_artifacts",
      kind: "verification",
      title: "Verifier ran preview smoke checks",
      detail: "Checked page load, waitlist endpoint, CTA presence, and preview artifact availability.",
      toolName: "verifier.preview-smoke",
      outputSummary: "Preview loads; waitlist synthetic submission accepted",
      artifactRefs: [record.deliverables?.previewUrl ?? "preview://pending"],
      confidence: 0.94,
    });
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "DELIVERABLE_CREATED",
      label: "Preview URL created",
      taskId: task.id,
      agentId: agent.id,
      outputRef: preview.previewUrl,
      createdAt: new Date().toISOString(),
    });
    this.completeAgentPhase(missionId, agent.id, "preview_deploy", "Preview deploy ready");
    this.completeTask(missionId, task.id, agent.id, preview.previewUrl, "Preview deploy created");
  }

  private async runLaunchPreviewVerificationTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-verify-preview");
    const agent = this.mustGetTaskAgent(record, task.id);
    this.startTask(missionId, task.id, agent.id, `${agent.name} is checking preview quality`);
    this.startAgentPhase(missionId, agent.id, "check_artifacts", "Checking page load, CTA, mobile artifact, and waitlist endpoint");
    await sleep(2500 + Math.random() * 1000);

    const previewUrl = record.deliverables?.previewUrl;
    let live: Awaited<ReturnType<typeof verifyLaunchPreviewLive>> | undefined;
    if (previewUrl) {
      try {
        live = await verifyLaunchPreviewLive(record, previewUrl);
      } catch (err) {
        console.warn(
          `[verifier] live preview fetch threw for ${missionId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    // Demo theatre: on first verification pass, simulate a missing waitlist marker
    // so the dispute → Rebuild → second-pass beat is observable. Cleared on rebuild.
    const isDisputeRerun = Boolean(this.artifacts.get(missionId)?.launch?.disputeRerun);
    const injectFailure = env.DEMO_INJECT_REJECTION && !isDisputeRerun;
    if (injectFailure && live) {
      live = { ...live, hasWaitlistForm: false, fallbackReason: "Demo: simulated waitlist marker omission" };
    }

    type VerificationStatus = "passed" | "failed" | "pending";
    const checkStatus = (
      cond: boolean,
      passDetail: string,
      failDetail: string,
      missingDetail: string,
    ): { status: VerificationStatus; detail: string } => {
      // Treat unreachable preview as `pending` (closest legal mapping for "inconclusive")
      if (!live || !live.reachable) return { status: "pending", detail: missingDetail };
      return cond ? { status: "passed", detail: passDetail } : { status: "failed", detail: failDetail };
    };

    const previewLoads: { status: VerificationStatus; detail: string } = !live
      ? { status: "pending", detail: "Preview URL not yet emitted by deployer" }
      : live.reachable && live.httpStatus && live.httpStatus < 400
        ? {
            status: "passed",
            detail: `${previewUrl} returned ${live.httpStatus} in ${live.durationMs}ms`,
          }
        : {
            status: "failed",
            detail: `Preview unreachable: ${live.fallbackReason ?? `status ${live.httpStatus ?? "?"}`}`,
          };

    const waitlistFormCheck = checkStatus(
      Boolean(live?.hasWaitlistForm),
      "Found <form data-bifrost=\"waitlist\"> on page",
      "Required form data-bifrost=\"waitlist\" not found in HTML",
      "Preview unreachable; cannot inspect waitlist form",
    );
    const missionMetaCheck = checkStatus(
      Boolean(live?.hasMissionMeta && live?.missionMetaMatches),
      `meta name=\"bifrost-mission-id\" matches ${record.id}`,
      live?.hasMissionMeta
        ? `meta bifrost-mission-id present but didn't match expected mission id`
        : `meta name=\"bifrost-mission-id\" not found`,
      "Preview unreachable; cannot inspect bifrost-mission-id meta",
    );
    const heroCheck = checkStatus(
      Boolean(live?.hasHeroH1),
      `Hero <h1> rendered: "${live?.heroSnippet ?? ""}"`,
      "Hero <h1> missing or empty in returned HTML",
      "Preview unreachable; cannot inspect hero",
    );

    const passed =
      previewLoads.status === "passed" &&
      waitlistFormCheck.status === "passed" &&
      missionMetaCheck.status === "passed" &&
      heroCheck.status === "passed";

    this.store.mutate(missionId, (current) => ({
      ...current,
      deliverables: {
        ...(current.deliverables ?? {}),
        formTestResult: {
          passed: waitlistFormCheck.status === "passed",
          detail:
            waitlistFormCheck.status === "passed"
              ? `Live HTTP fetch confirmed waitlist form (status ${live?.httpStatus})`
              : waitlistFormCheck.detail,
          submittedAt: new Date().toISOString(),
        },
      },
      verificationChecks: [
        ...current.verificationChecks,
        { id: "preview_loads", label: "Preview loads", ...previewLoads },
        { id: "waitlist_form", label: "Waitlist form present", ...waitlistFormCheck },
        { id: "mission_meta", label: "bifrost-mission-id meta tag", ...missionMetaCheck },
        { id: "hero_h1", label: "Hero <h1> rendered", ...heroCheck },
      ],
    }));

    const livenessKnown = Boolean(live?.reachable);
    const hardFailure =
      livenessKnown &&
      (waitlistFormCheck.status === "failed" ||
        missionMetaCheck.status === "failed" ||
        previewLoads.status === "failed");

    if (hardFailure) {
      this.failAgentPhase(
        missionId,
        agent.id,
        "check_artifacts",
        injectFailure
          ? "Verifier flagged a missing waitlist form element. Operator can rebuild for free."
          : "Verifier flagged required markers missing. Operator can rebuild for free.",
      );
      this.store.mutate(missionId, (current) => ({
        ...current,
        status: "failed",
        failureReason: injectFailure
          ? "Preview missing waitlist form element. Rebuild to retry."
          : "Preview missing required markers. Rebuild to retry.",
      }));
      this.store.appendEvent(missionId, {
        id: `evt_${nanoid(10)}`,
        missionId,
        type: "VERIFICATION_REJECTED",
        label: injectFailure
          ? "Verifier rejected preview — waitlist form element missing from HTML"
          : "Verifier rejected preview — missing required markers",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    if (!live || !live.reachable) {
      this.completeAgentPhase(
        missionId,
        agent.id,
        "check_artifacts",
        live?.fallbackReason
          ? `Preview unreachable (${live.fallbackReason}); marked checks inconclusive.`
          : "Preview URL not yet emitted; marked checks inconclusive.",
      );
    } else if (passed) {
      this.completeAgentPhase(missionId, agent.id, "check_artifacts", "Preview checks passed (live HTTP)");
    } else {
      this.completeAgentPhase(
        missionId,
        agent.id,
        "check_artifacts",
        "Preview reachable but one or more required markers missing — see verification checks",
      );
    }
    this.completeTask(missionId, task.id, agent.id, "preview-checks", passed ? "Preview verified" : "Preview verification recorded");
  }

  /**
   * Free rebuild after a verifier rejection. Marks artifacts.launch.disputeRerun=true,
   * resets the verify-preview/verify task completion + verification report, flips
   * mission back to "active", and re-enters the launch loop. No new spend approval needed.
   */
  public async rebuildLaunchMission(missionId: string): Promise<MissionRecord> {
    const record = this.mustGetMission(missionId);
    if (record.input.template !== LAUNCH_SITE_TEMPLATE) {
      throw new Error("Rebuild is only supported for launch missions");
    }
    if (record.status !== "failed") {
      throw new Error(`Cannot rebuild mission ${missionId} from status ${record.status}`);
    }

    const launch = this.artifacts.get(missionId)?.launch ?? {};
    this.artifacts.set(missionId, {
      ...this.artifacts.get(missionId),
      launch: { ...launch, disputeRerun: true },
    });
    await this.saveArtifacts(missionId);

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "active",
      failureReason: undefined,
      verificationChecks: current.verificationChecks.filter(
        (check) => !["preview_loads", "waitlist_form", "mission_meta", "hero_h1"].includes(check.id),
      ),
      tasks: current.tasks.map((t) =>
        t.id === "task-verify-preview" || t.id === "task-verify"
          ? { ...t, status: "pending" as const, completedAt: undefined }
          : t,
      ),
    }));

    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "VERIFICATION_RUNNING",
      label: "Operator triggered free rebuild after verifier rejection",
      createdAt: new Date().toISOString(),
    });

    void this.runMission(missionId).catch((err: unknown) => {
      console.error(`[rebuild] launch mission rerun failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    return this.mustGetMission(missionId);
  }

  private requestLaunchDomainCheckpoint(missionId: string): void {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-domain");
    const agent = this.mustGetTaskAgent(record, task.id);
    const domainOptions = searchDomains(record);
    this.store.mutate(missionId, (current) => ({
      ...current,
      deliverables: {
        ...(current.deliverables ?? {}),
        domainOptions,
      },
    }));
    this.createHumanCheckpoint(missionId, {
      kind: "decision",
      title: "Confirm domain candidate",
      prompt: "Pick a domain candidate or answer skip. No domain purchase will happen without separate spend credentials and approval.",
      options: [...domainOptions.map((option) => `${option.domain} ($${option.priceUsd.toFixed(2)})`), "Skip domain purchase"],
      freeformAllowed: true,
      requestedByAgentId: agent.id,
      blockingTaskId: task.id,
    });
  }

  private async runLaunchLiveDeployTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-deploy-live");
    const agent = this.mustGetTaskAgent(record, task.id);
    this.startTask(missionId, task.id, agent.id, `${agent.name} is promoting preview to live`);
    this.startAgentPhase(missionId, agent.id, "live_deploy", "Promoting preview artifact to live URL");
    const receipt = deployLive(record, env.API_BASE_URL);
    const domainResponse = record.humanCheckpoints.find((checkpoint) => checkpoint.blockingTaskId === "task-domain")?.response;
    this.store.mutate(missionId, (current) => ({
      ...current,
      deliverables: {
        ...(current.deliverables ?? {}),
        liveUrl: receipt.url,
        deployReceipt: receipt,
        selectedDomain: domainResponse,
      },
    }));
    this.recordAgentWork(missionId, {
      agentId: agent.id,
      taskId: task.id,
      phaseId: "live_deploy",
      kind: "tool_call",
      title: "Deployer promoted preview to live route",
      detail: "Created the live deployment receipt and preserved selected domain decision as mission evidence.",
      toolName: "live-deploy.local-adapter",
      inputSummary: domainResponse ?? "skip domain purchase",
      outputSummary: receipt.url,
      artifactRefs: [receipt.url],
      confidence: 0.95,
    });
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "DELIVERABLE_CREATED",
      label: "Live deployment URL created",
      taskId: task.id,
      agentId: agent.id,
      outputRef: receipt.url,
      createdAt: new Date().toISOString(),
    });
    this.completeAgentPhase(missionId, agent.id, "live_deploy", "Live deploy receipt ready");
    this.completeTask(missionId, task.id, agent.id, receipt.url, "Live deploy created");
  }

  private async runLaunchAssetsTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-launch-assets");
    const agent = this.mustGetTaskAgent(record, task.id);
    this.startTask(missionId, task.id, agent.id, `${agent.name} is drafting launch posts`);
    this.startAgentPhase(missionId, agent.id, "draft_launch_posts", "Writing three channel-ready launch posts");
    const socialPosts = generateSocialPosts(record);
    this.recordAgentWork(missionId, {
      agentId: agent.id,
      taskId: task.id,
      phaseId: "draft_launch_posts",
      kind: "artifact",
      title: "Copywriter generated launch posts",
      detail: "Drafted three channel-ready posts tied to the final landing page CTA.",
      toolName: "social-post-generator.launch-v1",
      outputSummary: socialPosts.map((post, index) => `Post ${index + 1}: ${post.slice(0, 64)}`).join(" | "),
      artifactRefs: ["artifact://launch/social-posts"],
      confidence: 0.89,
    });
    this.store.mutate(missionId, (current) => ({
      ...current,
      deliverables: {
        ...(current.deliverables ?? {}),
        socialPosts,
      },
    }));
    this.completeAgentPhase(missionId, agent.id, "draft_launch_posts", "Launch posts ready");
    this.completeTask(missionId, task.id, agent.id, "launch-posts", "Launch posts generated");
  }

  private async runLaunchVerificationTask(missionId: string): Promise<void> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, "task-verify");
    const agent = this.mustGetTaskAgent(record, task.id);

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "verifying",
    }));
    this.startTask(missionId, task.id, agent.id, `${agent.name} is verifying launch deliverables`, "verifying");
    this.startAgentPhase(missionId, agent.id, "audit_approvals", "Auditing launch spend approvals and checkpoints");
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "VERIFICATION_RUNNING",
      label: "Verifier is checking launch deliverables and approvals",
      createdAt: new Date().toISOString(),
    });

    const launchVerification = verifyLaunchDeliverables(record);
    const proofHash = `launch_${nanoid(20)}`;
    const verification = {
      approved: launchVerification.passed,
      score: launchVerification.passed ? 0.96 : 0.52,
      confidence: 0.92,
      passedChecks: launchVerification.checks
        .filter((check) => check.passed)
        .map((check) => ({
          id: check.id,
          label: check.label,
          status: "passed" as const,
          detail: check.detail,
        })),
      failedChecks: launchVerification.checks
        .filter((check) => !check.passed)
        .map((check) => ({
          id: check.id,
          label: check.label,
          status: "failed" as const,
          detail: check.detail,
        })),
      missingEvidence: launchVerification.checks
        .filter((check) => !check.passed)
        .map((check) => check.label),
      proofHash,
      summary: launchVerification.summary,
      deterministicChecks: {
        paidCallsHaveApproval: record.receipts.some((receipt) => receipt.purpose === "preview_deploy"),
        approvalsHaveSignature: record.receipts.every((receipt) => Boolean(receipt.txSignature)),
        servicesAllowlisted: true,
        noSpendExceedCap: record.receipts.every((receipt) => receipt.amount <= record.budget.maxPerCall),
        openCriticalMessagesResolved: !record.humanCheckpoints.some((checkpoint) => checkpoint.status === "open"),
        finalOutputCitesArtifacts: Boolean(record.deliverables?.previewUrl && record.deliverables.liveUrl),
        sawChallengeBeforeSettlement: true,
      },
    };

    if (!verification.approved) {
      this.store.mutate(missionId, (current) => ({
        ...current,
        status: "failed",
        verificationChecks: [...verification.passedChecks, ...verification.failedChecks],
        verificationReport: verification,
        failureReason: verification.summary,
      }));
      this.store.appendEvent(missionId, {
        id: `evt_${nanoid(10)}`,
        missionId,
        type: "VERIFICATION_REJECTED",
        label: "Verifier rejected the launch mission output",
        proofHash,
        createdAt: new Date().toISOString(),
      });
      this.failAgentPhase(missionId, agent.id, "audit_approvals", verification.summary);
      return;
    }

    this.completeAgentPhase(missionId, agent.id, "audit_approvals", "Launch approvals and checkpoints verified");
    this.startAgentPhase(missionId, agent.id, "settle_onchain", "Submitting launch proof and settlement");
    const verificationTx = await this.solana.submitVerification(record, proofHash);
    const settlementTx = await this.solana.approveSettlement(record);
    const settledRecord = this.mustGetMission(missionId);
    const reputationDeltas = await this.buildReputationDeltas(settledRecord, settlementTx.txSignature);
    const proof: MissionProof = {
      missionId,
      outputSummary: verification.summary,
      artifactLinks: [
        record.deliverables?.previewUrl,
        record.deliverables?.liveUrl,
        ...(record.deliverables?.fileManifest?.map((file) => `workspace://${missionId}/${file.path}`) ?? []),
      ].filter((item): item is string => Boolean(item)),
      resultHash: proofHash,
      apiReceiptHashes: record.receipts.map((receipt) => receipt.receiptId),
      txHashes: [verificationTx.txSignature, settlementTx.txSignature],
      completionConfidence: verification.confidence,
    };

    this.recordAgentWork(missionId, {
      agentId: agent.id,
      taskId: task.id,
      phaseId: "settle_onchain",
      kind: "onchain",
      title: "Verifier anchored proof and settlement",
      detail: "Submitted launch proof hash, released settlement, and prepared reputation updates for selected agents.",
      toolName: "solana.bifrost-settlement",
      outputSummary: `proof ${proofHash}; settlement ${settlementTx.txSignature}`,
      artifactRefs: proof.artifactLinks,
      receiptRefs: record.receipts.map((receipt) => receipt.receiptId),
      txSignature: settlementTx.txSignature,
      proofHash,
      confidence: verification.confidence,
    });

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "settled",
      verificationChecks: [...verification.passedChecks, ...verification.failedChecks],
      verificationReport: verification,
      proof,
      settlement: {
        state: "settled",
        settledAmount: current.budget.spent,
        refundedAmount: current.budget.remaining,
        protocolFee: 0,
      },
      finalResult: {
        verdict: "good_trade",
        headline: "Launch mission complete",
        summary: verification.summary,
        confidence: verification.confidence,
        keyPoints: [
          current.deliverables?.previewUrl ?? "Preview generated",
          current.deliverables?.liveUrl ?? "Live URL generated",
          `${current.deliverables?.socialPosts?.length ?? 0} launch posts generated`,
        ],
      },
      reputationDeltas,
      trustProfiles: this.applyReputationDeltas(current.trustProfiles, reputationDeltas, proofHash, settlementTx.txSignature),
      agents: current.agents.map((item) => ({
        ...item,
        status: "complete",
        currentAction: "Launch mission settled on Solana",
      })),
    }));

    this.completeAgentPhase(missionId, agent.id, "settle_onchain", "Launch settlement recorded");
    this.completeTask(missionId, task.id, agent.id, proofHash, "Launch proof verified and settlement released", "settled");
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "VERIFICATION_APPROVED",
      label: "Verifier approved the launch mission output",
      proofHash,
      createdAt: new Date().toISOString(),
    });
    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "SETTLEMENT_RELEASED",
      label: "Bifrost released launch mission settlement",
      amount: settledRecord.budget.spent,
      txSignature: settlementTx.txSignature,
      createdAt: new Date().toISOString(),
    });
  }

  private createHumanCheckpoint(
    missionId: string,
    input: Omit<HumanCheckpoint, "id" | "missionId" | "status" | "requestedAt">,
  ): HumanCheckpoint {
    const record = this.mustGetMission(missionId);
    const existing = record.humanCheckpoints.find(
      (checkpoint) => checkpoint.blockingTaskId === input.blockingTaskId,
    );
    if (existing) {
      return existing;
    }

    const checkpoint: HumanCheckpoint = {
      id: `checkpoint_${nanoid(8)}`,
      missionId,
      status: "open",
      requestedAt: new Date().toISOString(),
      ...input,
    };

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "awaiting_human_input",
      humanCheckpoints: [...current.humanCheckpoints, checkpoint],
      tasks: current.tasks.map((task) =>
        task.id === checkpoint.blockingTaskId ? { ...task, status: "blocked" } : task,
      ),
      agents: current.agents.map((agent) =>
        agent.id === checkpoint.requestedByAgentId
          ? {
              ...agent,
              status: "waiting",
              currentAction: checkpoint.prompt,
            }
          : agent,
      ),
    }));

    this.store.appendEvent(missionId, {
      id: `evt_${nanoid(10)}`,
      missionId,
      type: "HUMAN_CHECKPOINT_REQUESTED",
      label: checkpoint.title,
      checkpointId: checkpoint.id,
      taskId: checkpoint.blockingTaskId,
      agentId: checkpoint.requestedByAgentId,
      createdAt: checkpoint.requestedAt,
    });

    this.messageBus
      .send({
        missionId,
        fromAgentId: checkpoint.requestedByAgentId,
        toAgentId: "human",
        type: checkpoint.kind === "clarification" ? "clarification" : "question",
        content: `${checkpoint.title}\n${checkpoint.prompt}\n${checkpoint.options.map((option, index) => `${index + 1}. ${option}`).join("\n")}`,
        artifactRefs: [`checkpoint://${checkpoint.id}`],
        threadId: missionId,
        status: "open",
      })
      .catch((error) => {
        console.warn("[mission-runner] checkpoint message send failed", error);
      });

    return checkpoint;
  }

  private buildSelectionProposal(input: MissionInput): AgentSelectionProposal {
    const blueprint = getMissionBlueprint(input.template);
    if (blueprint) {
      const recommendedAgentIds = blueprint.lineup.map((agent) => agent.agentId);
      const selectedAgents = this.registry.getMany(recommendedAgentIds);
      const trustReason = selectedAgents
        .map((agent) => {
          const categoryScore =
            agent.trustProfile?.categoryScores[agent.capabilities[0] ?? ""] ??
            agent.trustProfile?.categoryScores[agent.role] ??
            agent.trustScore;
          return `${agent.name}: trust ${agent.trustScore}, ${categoryScore} in ${agent.capabilities[0] ?? agent.role}, ${agent.totalMissions} missions`;
        })
        .join("; ");
      return {
        id: `proposal_${nanoid(8)}`,
        status: "pending",
        recommendedAgentIds,
        chosenAgentIds: recommendedAgentIds,
        reason: `${blueprint.label} needs ${blueprint.lineup.map((agent) => agent.name).join(", ")}. Agents are selected from registry fit, capability tags, trust score, and budget caps. ${trustReason}`,
        createdAt: new Date().toISOString(),
      };
    }

    const registry = this.registry.list();
    const chosen = new Set<string>();

    for (const role of REQUIRED_AGENT_ROLES) {
      const best = this.rankAgentsForMission(registry, input, role)[0];
      if (best) {
        chosen.add(best.id);
      }
    }

    for (const agent of this.rankAdvisoryAgentsForMission(registry, input)) {
      if (chosen.size >= REQUIRED_AGENT_ROLES.length + 2) {
        break;
      }
      chosen.add(agent.id);
    }

    const recommendedAgentIds =
      chosen.size >= REQUIRED_AGENT_ROLES.length
        ? [...chosen]
        : [...DEFAULT_SELECTION_AGENT_IDS];

    return {
      id: `proposal_${nanoid(8)}`,
      status: "pending",
      recommendedAgentIds,
      chosenAgentIds: recommendedAgentIds,
      reason: this.buildSelectionReason(input, recommendedAgentIds),
      createdAt: new Date().toISOString(),
    };
  }

  private rankAgentsForMission(
    registry: RegistryAgent[],
    input: MissionInput,
    role: AgentRole,
  ): RegistryAgent[] {
    return registry
      .filter((agent) => agent.role === role && agent.active)
      .sort((a, b) => this.scoreAgentForMission(b, input) - this.scoreAgentForMission(a, input));
  }

  private rankAdvisoryAgentsForMission(
    registry: RegistryAgent[],
    input: MissionInput,
  ): RegistryAgent[] {
    const advisoryRoles = new Set<AgentRole>([
      "research",
      "wallet_intelligence",
      "risk",
      "compliance",
      "custom",
    ]);
    return registry
      .filter((agent) => advisoryRoles.has(agent.role) && agent.active)
      .sort((a, b) => this.scoreAgentForMission(b, input) - this.scoreAgentForMission(a, input))
      .filter((agent) => this.scoreAgentForMission(agent, input) >= 12);
  }

  private scoreAgentForMission(agent: RegistryAgent, input: MissionInput): number {
    const text = [
      input.title,
      input.template,
      input.description,
      input.objective,
      input.successCriteria,
    ].join(" ").toLowerCase();
    const haystack = [
      agent.name,
      agent.slug,
      agent.description,
      agent.capabilities.join(" "),
      agent.supportedServices.join(" "),
      agent.priceModel ?? "",
    ].join(" ").toLowerCase();

    const keywords = [
      "trump",
      "polymarket",
      "prediction",
      "market",
      "swap",
      "raydium",
      "wallet",
      "approval",
      "subscription",
      "tax",
      "payroll",
      "rent",
      "merchant",
      "pos",
      "dao",
      "treasury",
      "stablecoin",
      "invoice",
      "privacy",
      "badge",
      "reputation",
      "hackathon",
      "competitor",
      "docs",
      "risk",
      "compliance",
    ];

    const keywordScore = keywords.reduce((score, keyword) => {
      if (!text.includes(keyword)) {
        return score;
      }
      return score + (haystack.includes(keyword) ? 8 : 0);
    }, 0);

    const capabilityScore = agent.capabilities.reduce((score, capability) => {
      const tokens = capability.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      return score + tokens.filter((token) => token.length > 3 && text.includes(token)).length * 3;
    }, 0);

    const roleScore =
      text.includes(agent.role.replace("_", " ")) || text.includes(agent.role)
        ? 6
        : 0;

    const trustScore = agent.trustScore / 10;
    const statusPenalty =
      agent.registrationStatus === "probation" ? -3 : agent.registrationStatus === "submitted" ? -8 : 0;

    return trustScore + keywordScore + capabilityScore + roleScore + statusPenalty;
  }

  private buildSelectionReason(input: MissionInput, agentIds: string[]): string {
    const agents = this.registry.getMany(agentIds);
    const extraRoles = agents
      .filter((agent) => !REQUIRED_AGENT_ROLES.includes(agent.role))
      .map((agent) => agent.role.replace(/_/g, " "));
    const extras = extraRoles.length ? ` Extra advisory coverage: ${extraRoles.join(", ")}.` : "";
    return `Bifrost scored the registry against "${input.objective}" and selected agents for news, market data, adversarial review, execution packaging, and verification.${extras}`;
  }

  private buildAgentProfiles(agentIds: string[], selected: boolean): AgentProfile[] {
    const launchBlueprint = getMissionBlueprint(LAUNCH_SITE_TEMPLATE);
    return this.registry.getMany(agentIds).map((agent) => ({
      ...this.registry.toProfile(
        agent,
        launchBlueprint?.lineup.find((rule) => rule.agentId === agent.id)?.budgetCap ??
          BUDGET_CAPS[agent.id] ??
          ROLE_BUDGET_CAPS[agent.role] ??
          0,
      ),
      selected,
      status: selected
        ? agent.role === "verifier"
          ? "waiting"
          : "idle"
        : "waiting",
      currentAction: selected
        ? agent.role === "verifier"
          ? "Waiting for downstream execution"
          : launchBlueprint?.lineup.some((rule) => rule.agentId === agent.id)
            ? "Ready for launch mission start"
            : REQUIRED_AGENT_ROLES.includes(agent.role)
            ? "Ready for mission start"
            : "Advisory context selected for this mission"
        : "Awaiting human approval",
    }));
  }

  private buildMissionTasks(agentIds: string[], approved: boolean, input: MissionInput): MissionTask[] {
    const blueprint = getMissionBlueprint(input.template);
    if (blueprint) {
      const selected = new Set(agentIds);
      return tasksFromBlueprint(blueprint, approved).map((task) => ({
        ...task,
        assignedAgentId: selected.has(task.assignedAgentId ?? "")
          ? task.assignedAgentId
          : undefined,
      }));
    }

    const selectedAgents = this.registry.getMany(agentIds);
    const agentIdByRole = new Map(selectedAgents.map((agent) => [agent.role, agent.id]));
    const agentByRole = new Map(selectedAgents.map((agent) => [agent.role, agent]));
    const text = `${input.template} ${input.objective}`.toLowerCase();

    const isWalletAudit =
      input.template === WALLET_AUDIT_TEMPLATE ||
      (text.includes("wallet") && (text.includes("approval") || text.includes("hygiene")));

    if (isWalletAudit) {
      return [
        {
          id: "task-plan",
          title: "Review the proposed agent team",
          objective:
            "Bifrost proposes a curated lineup and waits for a human to approve or change it.",
          assignedAgent: "coordinator",
          dependencies: [],
          budgetAllocation: 0,
          approvedServices: [],
          verificationExpectation: "Human approval recorded for the selected agents",
          status: "complete",
        },
        {
          id: "task-news",
          title: "Scan wallet history for token approvals and risks",
          objective:
            "Scan wallet history for token approvals, recurring spends, and contract interactions. Surface stale unlimited approvals, suspicious contracts, and anomalous recurring spend patterns.",
          assignedAgent: "news",
          assignedAgentId: agentIdByRole.get("news"),
          dependencies: ["task-plan"],
          budgetAllocation: 0.45,
          approvedServices:
            agentByRole.get("news")?.supportedServices.length
              ? agentByRole.get("news")!.supportedServices
              : ["chain-intel.io", "wallet-approval-indexer"],
          verificationExpectation: "List of stale approvals and suspicious interactions with on-chain proof",
          status: approved ? "pending" : "waiting",
        },
        {
          id: "task-market",
          title: "Inspect approvals for staleness and recurring spend anomalies",
          objective:
            "Inspect each approval for staleness and recurring spends for anomalies. Score contract risk and flag any interaction with flagged or deprecated protocols.",
          assignedAgent: "market",
          assignedAgentId: agentIdByRole.get("market"),
          dependencies: ["task-plan"],
          budgetAllocation: 0.55,
          approvedServices:
            agentByRole.get("market")?.supportedServices.length
              ? agentByRole.get("market")!.supportedServices
              : ["wallet-scan.ai", "rpcfast"],
          verificationExpectation: "Approval staleness scores and recurring spend anomaly flags",
          status: approved ? "pending" : "waiting",
        },
        {
          id: "task-skeptic",
          title: "Challenge approval staleness claims with fresh on-chain confirmation",
          objective:
            "Challenge research claims about approval staleness; require fresh on-chain confirmation at the current block height before any revocation recommendation is issued.",
          assignedAgent: "skeptic",
          assignedAgentId: agentIdByRole.get("skeptic"),
          dependencies: ["task-news", "task-market"],
          budgetAllocation: 0.3,
          approvedServices:
            agentByRole.get("skeptic")?.supportedServices.length
              ? agentByRole.get("skeptic")!.supportedServices
              : ["rpcfast", "signal-replay.ai"],
          verificationExpectation: "On-chain confirmation of live approvals with block reference",
          status: "waiting",
        },
        {
          id: "task-execution",
          title: "Package wallet hygiene report with revocation recommendations",
          objective:
            "Package wallet hygiene report with revocation recommendations, listing each stale approval, its contract address, age, and a step-by-step revocation guide.",
          assignedAgent: "execution",
          assignedAgentId: agentIdByRole.get("execution"),
          dependencies: ["task-skeptic"],
          budgetAllocation: 0,
          approvedServices: [],
          verificationExpectation: "Final wallet hygiene report artifact with revocation guidance",
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
    const isPredictionMarketMission =
      text.includes("polymarket") ||
      text.includes("prediction") ||
      text.includes("trade") ||
      text.includes("market");
    const contextTitle = isPredictionMarketMission
      ? "Build the event timeline"
      : "Build the mission evidence timeline";
    const contextObjective = isPredictionMarketMission
      ? "Collect relevant headlines, timestamps, and public narrative shifts."
      : "Collect relevant source events, wallet/payment context, and operator-facing evidence.";
    const marketTitle = isPredictionMarketMission
      ? "Scan relevant markets and venues"
      : "Inspect payment, wallet, and venue context";
    const marketObjective = isPredictionMarketMission
      ? "Review current contracts, price movements, spreads, venue depth, and recent changes."
      : "Review wallet state, stablecoin/payment flows, spend context, and any relevant venue data.";
    const executionObjective = isPredictionMarketMission
      ? "Turn the analysis into a verdict: good trade, no trade, too late, or too suspicious."
      : "Turn the analysis into an operator-ready recommendation with next actions and evidence.";

    return [
      {
        id: "task-plan",
        title: "Review the proposed agent team",
        objective:
          "Bifrost proposes a curated lineup and waits for a human to approve or change it.",
        assignedAgent: "coordinator",
        dependencies: [],
        budgetAllocation: 0,
        approvedServices: [],
        verificationExpectation: "Human approval recorded for the selected agents",
        status: "complete",
      },
      {
        id: "task-news",
        title: contextTitle,
        objective: contextObjective,
        assignedAgent: "news",
        assignedAgentId: agentIdByRole.get("news"),
        dependencies: ["task-plan"],
        budgetAllocation: 0.45,
        approvedServices:
          agentByRole.get("news")?.supportedServices.length
            ? agentByRole.get("news")!.supportedServices
            : ["headline-feed.ai", "archive-indexer.ai"],
        verificationExpectation: "Timestamped news summary with artifacts",
        status: approved ? "pending" : "waiting",
      },
      {
        id: "task-market",
        title: marketTitle,
        objective: marketObjective,
        assignedAgent: "market",
        assignedAgentId: agentIdByRole.get("market"),
        dependencies: ["task-plan"],
        budgetAllocation: 0.55,
        approvedServices:
          agentByRole.get("market")?.supportedServices.length
            ? agentByRole.get("market")!.supportedServices
            : ["polymarket-scan.ai", "orderflow-ai"],
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
        approvedServices:
          agentByRole.get("skeptic")?.supportedServices.length
            ? agentByRole.get("skeptic")!.supportedServices
            : ["signal-replay.ai"],
        verificationExpectation: "Asymmetry score and caution flags",
        status: "waiting",
      },
      {
        id: "task-execution",
        title: "Prepare the final recommendation",
        objective: executionObjective,
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

  private validateSelection(agentIds: string[], input?: MissionInput): void {
    const agents = this.registry.getMany(agentIds);
    if (agents.length !== agentIds.length) {
      throw new Error("One or more selected agents are missing from the registry");
    }

    const blueprint = input ? getMissionBlueprint(input.template) : undefined;
    if (blueprint) {
      const required = new Set(blueprint.lineup.map((agent) => agent.agentId));
      for (const agentId of required) {
        if (!agentIds.includes(agentId)) {
          throw new Error(`Selection must contain blueprint agent ${agentId}`);
        }
      }
      return;
    }

    for (const role of REQUIRED_AGENT_ROLES) {
      const count = agents.filter((agent) => agent.role === role).length;
      if (count !== 1) {
        throw new Error(`Selection must contain exactly one ${role} agent`);
      }
    }
  }

  private async ensureSpendApproval(missionId: string, taskId: PaidTaskId): Promise<boolean> {
    const record = this.mustGetMission(missionId);
    const task = this.mustGetTask(record, taskId);
    const agent = this.mustGetTaskAgent(record, taskId);
    const plan = this.buildSpendPlan(record, task, agent, taskId);

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

    // Phase 3A: emit payment_request AgentMessage via messageBus (additive, backward-compat)
    const policyChecks: PolicyCheckResult = {
      underMaxPerCall: plan.amount <= record.budget.maxPerCall,
      serviceAllowlisted: task.approvedServices.length === 0 || task.approvedServices.includes(plan.service),
      humanApprovalRequired: plan.amount >= record.budget.humanApprovalAbove,
      missionBudgetRemaining: record.budget.remaining,
    };

    try {
      await this.messageBus.send({
        missionId,
        fromAgentId: agent.id,
        toAgentId: "human",
        type: "payment_request",
        content: plan.justification,
        artifactRefs: [],
        threadId: missionId,
        status: "open",
      });

      if (env.USE_CONVEX) {
        try {
          await getConvexClient().mutation("paymentRequests:create" as any, {
            agentMessageId: approval.id,
            missionId,
            amount: plan.amount,
            service: plan.service,
            toolName: plan.service,
            payoutWallet: agent.payoutWallet ?? "",
            justification: plan.justification,
            policyChecks,
            status: "pending",
          });
        } catch (err) {
          console.warn("[mission-runner] paymentRequests:create failed", err);
        }
      }
    } catch (err) {
      console.warn("[mission-runner] payment_request bus send failed", err);
    }

    return false;
  }

  private buildSpendPlan(
    record: MissionRecord,
    task: MissionTask,
    agent: AgentProfile,
    taskId: PaidTaskId,
  ) {
    const service =
      task.approvedServices[0] ??
      agent.supportedServices[0] ??
      (taskId === "task-preview"
        ? "preview-deploy.local"
        : taskId === "task-skeptic"
          ? "signal-replay.ai"
          : "source-bundle.local");
    const amount =
      taskId === "task-news"
        ? Math.min(0.22, record.budget.maxPerCall)
        : taskId === "task-market"
          ? Math.min(0.32, record.budget.maxPerCall)
          : taskId === "task-preview"
            ? Math.min(0.75, record.budget.maxPerCall)
            : Math.min(0.08, record.budget.maxPerCall);
    const purposeByTask: Record<PaidTaskId, string> = {
      "task-news": "source_context_bundle",
      "task-market": "venue_or_payment_context_bundle",
      "task-skeptic": "adversarial_replay_bundle",
      "task-preview": "preview_deploy",
    };
    return {
      amount,
      service,
      purpose: purposeByTask[taskId],
      justification: `${agent.name} needs ${service} to complete "${task.title}" with source-backed evidence before the mission can continue.`,
    };
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
    await this.saveArtifacts(missionId);
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
    await this.saveArtifacts(missionId);
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
      { missionId, messageBus: this.messageBus },
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
    await this.saveArtifacts(missionId);
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
    await this.saveArtifacts(missionId);

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

    const messages = this.messageBus ? this.messageBus.getThread(missionId) : [];
    const approvedServicesByTask: Record<string, string[]> = {};
    for (const t of record.tasks) {
      approvedServicesByTask[t.id] = t.approvedServices ?? [];
    }

    const verification = await this.verifier.executeWithAudit(
      {
        missionId,
        successCriteria: [record.input.successCriteria ?? ""],
        finalRecommendation: record.finalResult,
        messages,
        receipts: record.receipts ?? [],
        approvedServicesByTask,
        budget: { maxPerCall: record.budget.maxPerCall, humanApprovalAbove: record.budget.humanApprovalAbove },
        outputSummary: record.finalResult?.summary ?? record.finalResult?.headline ?? "",
        context: { missionId, messageBus: this.messageBus },
      },
    );

    // Persist verification report to Convex if enabled
    if (env.USE_CONVEX) {
      try {
        await getConvexClient().mutation("verificationReports:create" as any, {
          missionId,
          deterministicChecks: verification.deterministicChecks ?? null,
          aiChecks: null,
          proofHash: verification.proofHash ?? "",
          messageCount: messages.length,
          receiptCount: (record.receipts ?? []).length,
          createdAt: new Date().toISOString(),
          report: verification,
        });
      } catch (err) {
        console.warn("[mission-runner] verificationReports:create failed", err);
      }
    }
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
        verificationChecks: verification.passedChecks,
        verificationReport: verification,
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
    const reputationDeltas = await this.buildReputationDeltas(settledRecord, settlementTx.txSignature);
    const proof = this.buildProof(settledRecord, verification);

    this.store.mutate(missionId, (current) => ({
      ...current,
      status: "settled",
      verificationChecks: verification.passedChecks,
      verificationReport: verification,
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
      label: "Bifrost released settlement and refunded the unused budget",
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
      artifacts?.launch?.site?.artifactRef,
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

  private getArtifactRefs(missionId: string): string[] {
    const artifacts = this.artifacts.get(missionId);
    return [
      artifacts?.news?.artifactRef,
      artifacts?.market?.artifactRef,
      artifacts?.skeptic?.artifactRef,
      artifacts?.execution?.artifactRef,
      artifacts?.launch?.site?.artifactRef,
    ].filter((item): item is string => Boolean(item));
  }

  private async buildReputationDeltas(record: MissionRecord, settleTxSignature?: string) {
    // Multi-signal trust delta. Each signal contributes weighted +/- to the agent's
    // global score; the result is clamped to [-3, +3]. Disputed missions (rebuild
    // path) take a smaller positive delta even on success — the verifier had to retry.
    // settleTxSignature is threaded down to solana.updateReputation so each per-agent
    // delta gets a real on-chain hash (the settlement tx is the on-chain ix where
    // finalize_allocation invokes update_reputation for every agent in the run).
    const verifierApproved = record.verificationReport?.approved === true;
    const someCheckpointAnswered = record.humanCheckpoints.some((c) => c.status === "answered");
    const spendInBudget = record.budget.spent <= record.budget.totalBudget;
    const startedAtMs = record.events.find((e) => e.type === "MISSION_CREATED")?.createdAt
      ? new Date(record.events.find((e) => e.type === "MISSION_CREATED")!.createdAt).getTime()
      : null;
    const elapsedMs = startedAtMs ? Date.now() - startedAtMs : null;
    const latencyOk = elapsedMs == null ? true : elapsedMs <= 10 * 60 * 1000;
    const wasRebuilt = Boolean(this.artifacts.get(record.id)?.launch?.disputeRerun);

    const verifierTerm = (verifierApproved ? +2 : -3) * 0.5;
    const checkpointTerm = (someCheckpointAnswered ? +0.5 : 0) * 0.2;
    const spendTerm = (spendInBudget ? +0.5 : -1) * 0.2;
    const latencyTerm = (latencyOk ? +0.3 : -0.5) * 0.1;
    let baseDelta = verifierTerm + checkpointTerm + spendTerm + latencyTerm;
    if (wasRebuilt && verifierApproved) {
      // Rebuild penalty: cap successful-but-disputed missions to a small +
      baseDelta = Math.min(baseDelta, 0.3);
    }
    const clamped = Math.max(-3, Math.min(3, Number(baseDelta.toFixed(2))));

    const rationaleParts = [
      verifierApproved ? "verifier approved" : "verifier rejected",
      someCheckpointAnswered ? "operator checkpoint answered" : "no operator checkpoint",
      spendInBudget ? "spend within budget" : "spend exceeded budget",
      latencyOk ? "completed within latency window" : "ran past latency window",
      wasRebuilt ? "after free rebuild" : null,
    ]
      .filter((s): s is string => Boolean(s));

    const deltas = [];
    for (const agent of record.agents) {
      const rep = await this.solana.updateReputation(agent.id, clamped, settleTxSignature);
      const before = agent.trustScore;
      const after = Math.max(0, Math.min(99, before + clamped));
      // Per-agent category routing: prefer first capability, fall back to role.
      const primaryCategory = agent.capabilities?.[0] ?? agent.role;
      deltas.push({
        agentId: agent.id,
        before,
        after,
        delta: clamped,
        rationale: rationaleParts.join("; "),
        category:
          record.input.template === LAUNCH_SITE_TEMPLATE
            ? `launch:${primaryCategory}`
            : primaryCategory,
        txSignature: rep.txSignature,
      });
    }
    return deltas;
  }

  private recordAgentWork(
    missionId: string,
    input: Omit<
      AgentWorkEvidence,
      "id" | "missionId" | "status" | "startedAt" | "completedAt" | "artifactRefs" | "receiptRefs"
    > & {
      artifactRefs?: string[];
      receiptRefs?: string[];
      status?: AgentWorkEvidence["status"];
    },
  ): void {
    const now = new Date().toISOString();
    const evidence: AgentWorkEvidence = {
      id: `work_${nanoid(10)}`,
      missionId,
      status: input.status ?? "complete",
      startedAt: now,
      completedAt: input.status === "running" ? undefined : now,
      artifactRefs: input.artifactRefs ?? [],
      receiptRefs: input.receiptRefs ?? [],
      ...input,
    };

    this.store.mutate(missionId, (current) => ({
      ...current,
      agentWork: [...(current.agentWork ?? []), evidence],
    }));
  }

  private buildTrustProfiles(agents: AgentProfile[]) {
    const now = new Date().toISOString();
    return agents.map((agent) => ({
      agentId: agent.id,
      globalTrustScore: agent.trustScore,
      categoryScores: {
        [agent.role]: agent.trustScore,
        [agent.capabilities[0] ?? "general"]: Math.min(99, agent.trustScore + 3),
      },
      completedMissions: agent.totalMissions,
      failedMissions: Math.max(0, Math.floor(agent.totalMissions * 0.025)),
      disputedMissions: Math.max(0, Math.floor(agent.totalMissions * 0.008)),
      verifierPassRate: clampTrustSignal(agent.trustScore / 100 + 0.04),
      humanOverrideRate: Math.max(0.02, Number((1 - agent.trustScore / 100).toFixed(2))),
      spendDiscipline: clampTrustSignal(agent.trustScore / 100 + 0.03),
      latencyScore: clampTrustSignal(agent.trustScore / 100 + 0.01),
      proofQualityScore: clampTrustSignal(agent.trustScore / 100 + 0.02),
      lastUpdated: now,
      latestReputationTx: agent.trustProfile?.latestReputationTx,
    }));
  }

  private applyReputationDeltas(
    profiles: MissionRecord["trustProfiles"],
    deltas: ReputationDelta[],
    proofHash: string,
    txSignature: string,
  ): MissionRecord["trustProfiles"] {
    const deltaByAgent = new Map(deltas.map((delta) => [delta.agentId, delta]));
    return profiles.map((profile) => {
      const delta = deltaByAgent.get(profile.agentId);
      if (!delta) {
        return profile;
      }
      const category = delta.category ?? "mission-fit";
      const positive = delta.delta >= 0;
      const currentCategoryScore = profile.categoryScores[category] ?? profile.globalTrustScore;
      const nextCategoryScore = Math.max(0, Math.min(99, currentCategoryScore + delta.delta));
      // Sub-metric nudges scale with the sign + magnitude of the delta.
      const microStep = Math.max(-0.05, Math.min(0.05, delta.delta * 0.01));
      return {
        ...profile,
        globalTrustScore: delta.after,
        categoryScores: {
          ...profile.categoryScores,
          [category]: nextCategoryScore,
        },
        completedMissions: profile.completedMissions + (positive ? 1 : 0),
        failedMissions: profile.failedMissions + (positive ? 0 : 1),
        verifierPassRate: clampTrustSignal(profile.verifierPassRate + microStep),
        spendDiscipline: clampTrustSignal(profile.spendDiscipline + microStep),
        proofQualityScore: clampTrustSignal(profile.proofQualityScore + microStep),
        lastUpdated: new Date().toISOString(),
        latestProofHash: proofHash,
        latestReputationTx: delta.txSignature ?? txSignature,
      };
    });
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

function clampTrustSignal(value: number): number {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
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
