import type { AgentProfile, MissionEvent, MissionTask, ReputationDelta } from "@bifrost/shared";
import { END, START, StateGraph } from "@langchain/langgraph";
import { nanoid } from "nanoid";

import { CoordinatorAgent } from "../agents/coordinator-agent";
import { ExecutionAgent } from "../agents/execution-agent";
import { ResearchAgent } from "../agents/research-agent";
import { RiskAgent } from "../agents/risk-agent";
import { VerifierAgent } from "../agents/verifier-agent";
import type { PolicyEngine } from "../services/policy-engine";
import type { BifrostSolanaClient } from "../services/solana/bifrost-client";
import type { MissionStore } from "../services/store";
import { MissionStateAnnotation, type MissionGraphState } from "./state";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface MissionGraphDeps {
  store: MissionStore;
  solana: BifrostSolanaClient;
  policy: PolicyEngine;
  coordinator: CoordinatorAgent;
  research: ResearchAgent;
  risk: RiskAgent;
  execution: ExecutionAgent;
  verifier: VerifierAgent;
}

function event(state: MissionGraphState, type: MissionEvent["type"], label: string, extra: Partial<MissionEvent> = {}): MissionEvent {
  return {
    id: nanoid(10),
    missionId: state.missionId,
    type,
    label,
    createdAt: new Date().toISOString(),
    ...(extra as object),
  } as MissionEvent;
}

function getAgent(record: MissionGraphState["record"], role: AgentProfile["role"]): AgentProfile {
  const agent = record.agents.find((item) => item.role === role);
  if (!agent) {
    throw new Error(`Agent for role ${role} not found`);
  }
  return agent;
}

function updateTaskStatus(tasks: MissionTask[], taskId: string, status: MissionTask["status"]): MissionTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status } : task));
}

export function createMissionGraph(deps: MissionGraphDeps) {
  const planMission = async (state: MissionGraphState) => {
    await sleep(250);
    const created = await deps.solana.createMission(state.record);
    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      status: "active",
      settlement: { ...record.settlement, state: "active" },
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "MISSION_CREATED", "Mission created — vault PDA initialized", {
        txSignature: created.txSignature,
      }),
    );

    const tasks = await deps.coordinator.planMission(state.input);
    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      tasks,
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "AGENT_SELECTED", "Coordinator decomposed mission and selected agent mesh", {
        agentId: getAgent(state.record, "coordinator").id,
        role: "coordinator",
      }),
    );

    return {
      tasks,
      record: deps.store.get(state.missionId) ?? state.record,
    };
  };

  const runResearch = async (state: MissionGraphState) => {
    await sleep(350);
    const currentRecord = deps.store.get(state.missionId) ?? state.record;
    const researchAgent = getAgent(currentRecord, "research");
    const researchTask = state.tasks.find((task) => task.assignedAgent === "research");
    if (!researchTask) {
      return {};
    }

    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      tasks: updateTaskStatus(record.tasks, researchTask.id, "active"),
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "TASK_STARTED", "Research Agent started wallet intelligence sweep", {
        taskId: researchTask.id,
        agentId: researchAgent.id,
      }),
    );

    const spendResult = deps.policy.authorize(currentRecord, researchAgent, 0.2, "chain-intel.io");
    if (!spendResult.approved) {
      deps.store.appendEvent(
        state.missionId,
        event(state, "SPEND_REJECTED", spendResult.reason ?? "Research spend rejected", {
          agentId: researchAgent.id,
          reason: spendResult.reason,
        }),
      );
      throw new Error(spendResult.reason ?? "Research spend rejected");
    }

    const receipt = await deps.solana.authorizeSpend(currentRecord, researchAgent.id, "chain-intel.io", 0.2, "wallet_graph_lookup");
    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      budget: {
        ...record.budget,
        spent: Number((record.budget.spent + 0.2).toFixed(2)),
        remaining: Number((record.budget.remaining - 0.2).toFixed(2)),
      },
      agents: record.agents.map((agent) =>
        agent.id === researchAgent.id
          ? { ...agent, costIncurred: Number(((agent.costIncurred ?? 0) + 0.2).toFixed(2)), status: "working" }
          : agent,
      ),
      receipts: [...record.receipts, receipt],
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "SPEND_APPROVED", "Spend authorized — 0.20 USDC → chain-intel.io", {
        agentId: researchAgent.id,
        amount: 0.2,
        service: "chain-intel.io",
        txSignature: receipt.txSignature,
      }),
    );

    const result = await deps.research.execute(state.input.objective);
    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      tasks: updateTaskStatus(record.tasks, researchTask.id, "complete"),
      agents: record.agents.map((agent) =>
        agent.id === researchAgent.id
          ? { ...agent, status: "complete", currentAction: "Research dossier finalized" }
          : agent,
      ),
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "TASK_COMPLETE", "Research Agent — counterparty graph completed", {
        taskId: researchTask.id,
        agentId: researchAgent.id,
        outputRef: result.artifactRef,
      }),
    );

    return {
      artifacts: {
        researchSummary: result.summary,
        researchArtifactRef: result.artifactRef,
      },
      tasks: updateTaskStatus(state.tasks, researchTask.id, "complete"),
      record: deps.store.get(state.missionId) ?? state.record,
    };
  };

  const runRisk = async (state: MissionGraphState) => {
    await sleep(350);
    const currentRecord = deps.store.get(state.missionId) ?? state.record;
    const riskAgent = getAgent(currentRecord, "risk");
    const riskTask = state.tasks.find((task) => task.assignedAgent === "risk");
    if (!riskTask) {
      return {};
    }

    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      tasks: updateTaskStatus(record.tasks, riskTask.id, "active"),
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "TASK_STARTED", "Risk Agent started exposure scoring", {
        taskId: riskTask.id,
        agentId: riskAgent.id,
      }),
    );

    const result = await deps.risk.execute(
      state.artifacts.researchSummary ?? "",
      state.input.objective,
    );

    if (result.simulationRequired) {
      const service = result.recommendedService ?? "simulation.ai";
      const approval = deps.policy.authorize(currentRecord, riskAgent, 0.46, service);
      if (!approval.approved) {
        deps.store.appendEvent(
          state.missionId,
          event(state, "SPEND_REJECTED", approval.reason ?? "Spend rejected", {
            agentId: riskAgent.id,
            reason: approval.reason,
          }),
        );
        throw new Error(approval.reason ?? "Risk simulation spend rejected");
      }

      const receipt = await deps.solana.authorizeSpend(currentRecord, riskAgent.id, service, 0.46, "premium_sim");
      deps.store.mutate(state.missionId, (record) => ({
        ...record,
        budget: {
          ...record.budget,
          spent: Number((record.budget.spent + 0.46).toFixed(2)),
          remaining: Number((record.budget.remaining - 0.46).toFixed(2)),
        },
        agents: record.agents.map((agent) =>
          agent.id === riskAgent.id
            ? { ...agent, costIncurred: Number(((agent.costIncurred ?? 0) + 0.46).toFixed(2)), status: "working" }
            : agent,
        ),
        receipts: [...record.receipts, receipt],
      }));
      deps.store.appendEvent(
        state.missionId,
        event(state, "SPEND_APPROVED", `Spend authorized — 0.46 USDC → ${service}`, {
          agentId: riskAgent.id,
          amount: 0.46,
          service,
          txSignature: receipt.txSignature,
        }),
      );
    }

    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      tasks: updateTaskStatus(record.tasks, riskTask.id, "complete"),
      agents: record.agents.map((agent) =>
        agent.id === riskAgent.id
          ? { ...agent, status: "complete", currentAction: `Risk score ${result.riskScore}/100 computed` }
          : agent,
      ),
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "TASK_COMPLETE", `Risk Agent — risk score ${result.riskScore}/100 finalized`, {
        taskId: riskTask.id,
        agentId: riskAgent.id,
        outputRef: result.artifactRef,
      }),
    );

    return {
      artifacts: {
        riskScore: result.riskScore,
        riskSummary: result.rationale,
        riskArtifactRef: result.artifactRef,
      },
      tasks: updateTaskStatus(state.tasks, riskTask.id, "complete"),
      record: deps.store.get(state.missionId) ?? state.record,
    };
  };

  const runExecution = async (state: MissionGraphState) => {
    await sleep(280);
    const executionTask = state.tasks.find((task) => task.assignedAgent === "execution");
    const executionAgent = state.record.agents.find((agent) => agent.role === "execution") ?? {
      id: "execution-synth",
      name: "Execution Agent",
      role: "execution",
      icon: "⚡",
      description: "Execution artifacts and recommendations",
      trustScore: 90,
      wallet: "auto-generated",
      active: true,
      totalMissions: 0,
      capabilities: ["execution", "artifact-generation"],
      verifierCompatible: false,
    };

    if (!executionTask) {
      return {};
    }

    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      tasks: updateTaskStatus(record.tasks, executionTask.id, "active"),
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "TASK_STARTED", "Execution Agent assembling final recommendation", {
        taskId: executionTask.id,
        agentId: executionAgent.id,
      }),
    );

    const result = await deps.execution.execute(state.artifacts.riskSummary ?? "");
    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      tasks: updateTaskStatus(record.tasks, executionTask.id, "complete"),
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "TASK_COMPLETE", "Execution Agent — recommendation artifact prepared", {
        taskId: executionTask.id,
        agentId: executionAgent.id,
        outputRef: result.artifactRef,
      }),
    );

    return {
      artifacts: {
        executionRecommendation: result.recommendation,
        executionArtifactRef: result.artifactRef,
      },
      tasks: updateTaskStatus(state.tasks, executionTask.id, "complete"),
      record: deps.store.get(state.missionId) ?? state.record,
    };
  };

  const runVerification = async (state: MissionGraphState) => {
    await sleep(250);
    const currentRecord = deps.store.get(state.missionId) ?? state.record;
    const verifier = getAgent(currentRecord, "verifier");
    const verifyTask = state.tasks.find((task) => task.assignedAgent === "verifier");
    if (!verifyTask) {
      return {};
    }

    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      status: "verifying",
      settlement: { ...record.settlement, state: "verifying" },
      tasks: updateTaskStatus(record.tasks, verifyTask.id, "active"),
      agents: record.agents.map((agent) =>
        agent.id === verifier.id ? { ...agent, status: "working", currentAction: "Checking mission proof" } : agent,
      ),
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "VERIFICATION_RUNNING", "Verifier evaluating mission outputs"),
    );

    const result = await deps.verifier.execute(
      state.input.successCriteria,
      state.artifacts.executionRecommendation ?? "",
    );
    const proofTx = await deps.solana.submitVerification(currentRecord, result.proofHash);
    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      proof: {
        missionId: record.id,
        outputSummary: result.summary,
        artifactLinks: [
          state.artifacts.researchArtifactRef ?? "",
          state.artifacts.riskArtifactRef ?? "",
          state.artifacts.executionArtifactRef ?? "",
        ].filter(Boolean),
        resultHash: result.proofHash,
        apiReceiptHashes: record.receipts.map((receipt) => receipt.receiptId),
        txHashes: record.receipts.map((receipt) => receipt.txSignature),
        completionConfidence: result.approved ? 94 : 32,
      },
      verificationChecks: result.checks,
      tasks: updateTaskStatus(record.tasks, verifyTask.id, "complete"),
      agents: record.agents.map((agent) =>
        agent.id === verifier.id
          ? { ...agent, status: result.approved ? "complete" : "waiting", currentAction: result.summary }
          : agent,
      ),
    }));
    deps.store.appendEvent(
      state.missionId,
      event(
        state,
        result.approved ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED",
        result.approved ? "Proof hash submitted to VerifierRecord PDA" : "Verifier rejected the mission proof",
        { proofHash: result.proofHash },
      ),
    );
    deps.store.appendEvent(
      state.missionId,
      event(state, "TASK_COMPLETE", "Verifier — proof package finalized", {
        taskId: verifyTask.id,
        agentId: verifier.id,
        outputRef: proofTx.txSignature,
      }),
    );

    if (!result.approved) {
      deps.store.mutate(state.missionId, (record) => ({
        ...record,
        status: "failed",
        failureReason: result.summary,
        settlement: { ...record.settlement, state: "failed" },
      }));
      throw new Error(`Mission verification rejected: ${result.summary}`);
    }

    return {
      verificationChecks: result.checks,
      verificationApproved: result.approved,
      artifacts: {
        proofHash: result.proofHash,
        verificationSummary: result.summary,
      },
      tasks: updateTaskStatus(state.tasks, verifyTask.id, "complete"),
      record: deps.store.get(state.missionId) ?? state.record,
    };
  };

  const settleMission = async (state: MissionGraphState) => {
    await sleep(200);
    const currentRecord = deps.store.get(state.missionId) ?? state.record;
    const settlement = await deps.solana.approveSettlement(currentRecord);
    const deltas: ReputationDelta[] = currentRecord.agents
      .filter((agent) => ["research", "risk", "verifier"].includes(agent.role))
      .map((agent) => ({
        agentId: agent.id,
        before: agent.trustScore,
        after: Math.min(100, agent.trustScore + 1),
        delta: 1,
        rationale: "Verified mission completion.",
      }));

    await Promise.all(deltas.map((delta) => deps.solana.updateReputation(delta.agentId, delta.delta)));

    deps.store.mutate(state.missionId, (record) => ({
      ...record,
      status: "settled",
      settlement: {
        state: "settled",
        settledAmount: record.budget.spent,
        refundedAmount: record.budget.remaining,
        protocolFee: Number((record.budget.spent * 0.01).toFixed(2)),
      },
      reputationDeltas: deltas,
      agents: record.agents.map((agent) => {
        const delta = deltas.find((item) => item.agentId === agent.id);
        return delta ? { ...agent, trustScore: delta.after } : agent;
      }),
    }));
    deps.store.appendEvent(
      state.missionId,
      event(state, "SETTLEMENT_RELEASED", "Settlement released — remaining mission budget refunded", {
        amount: currentRecord.budget.remaining,
        txSignature: settlement.txSignature,
      }),
    );
    deltas.forEach((delta) => {
      deps.store.appendEvent(
        state.missionId,
        event(state, "REPUTATION_UPDATED", `Reputation updated for ${delta.agentId}`, {
          agentId: delta.agentId,
          delta: delta.delta,
        }),
      );
    });

    return {
      record: deps.store.get(state.missionId) ?? currentRecord,
    };
  };

  const graph = new StateGraph(MissionStateAnnotation)
    .addNode("planMission", planMission)
    .addNode("runResearch", runResearch)
    .addNode("runRisk", runRisk)
    .addNode("runExecution", runExecution)
    .addNode("runVerification", runVerification)
    .addNode("settleMission", settleMission)
    .addEdge(START, "planMission")
    .addEdge("planMission", "runResearch")
    .addEdge("runResearch", "runRisk")
    .addEdge("runRisk", "runExecution")
    .addEdge("runExecution", "runVerification")
    .addConditionalEdges("runVerification", (state) => (state.verificationApproved ? "settleMission" : END), {
      settleMission: "settleMission",
      [END]: END,
    })
    .addEdge("settleMission", END);

  return graph.compile();
}
