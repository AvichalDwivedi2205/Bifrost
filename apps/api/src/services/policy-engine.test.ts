import { describe, expect, test } from "bun:test";
import type { AgentProfile, MissionTask } from "@bifrost/shared";
import { demoMissionInput } from "@bifrost/shared";

import { PolicyEngine } from "./policy-engine";
import { MissionStore } from "./store";

function createAgent(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: "risk-1",
    slug: "risk-agent",
    name: "Risk Agent",
    role: "risk",
    icon: "⚠",
    description: "Risk scoring",
    trustScore: 82,
    wallet: "4MwL...7K2P",
    payoutWallet: "4MwL...7K2P",
    verifierWallet: "8RpL...2Qx7",
    active: true,
    totalMissions: 98,
    capabilities: ["risk-scoring"],
    verifierCompatible: false,
    supportedServices: ["simulation.ai"],
    executionMode: "builtin",
    phaseSchema: [],
    budgetCap: 0.8,
    costIncurred: 0,
    status: "idle",
    currentAction: "Queued",
    selected: true,
    ...overrides,
  };
}

function createTask(agent: AgentProfile, overrides: Partial<MissionTask> = {}): MissionTask {
  return {
    id: "task-risk",
    title: "Risk",
    objective: "Run risk scoring",
    assignedAgent: agent.role,
    assignedAgentId: agent.id,
    dependencies: [],
    budgetAllocation: 0.8,
    approvedServices: ["simulation.ai"],
    verificationExpectation: "Risk score emitted",
    status: "pending",
    ...overrides,
  };
}

describe("PolicyEngine", () => {
  test("rejects spend requests above the per-call cap", () => {
    const store = new MissionStore({ seedDemo: false });
    const agent = createAgent();
    const task = createTask(agent);
    const record = store.create(demoMissionInput, [agent], [agent], [task]);

    const engine = new PolicyEngine();
    const result = engine.authorize(
      { ...record, status: "active" },
      agent,
      0.61,
      "simulation.ai",
    );

    expect(result.approved).toBe(false);
    expect(result.reason).toBe("Amount exceeds per-call cap");
  });

  test("rejects non-whitelisted services", () => {
    const store = new MissionStore({ seedDemo: false });
    const agent = createAgent({
      id: "research-1",
      slug: "research-agent",
      name: "Research Agent",
      role: "research",
      wallet: "6PaH...nX9q",
      payoutWallet: "6PaH...nX9q",
      supportedServices: ["chain-intel.io"],
    });
    const task = createTask(agent, {
      id: "task-research",
      title: "Research",
      objective: "Gather wallet context",
      approvedServices: ["chain-intel.io"],
    });
    const record = store.create(demoMissionInput, [agent], [agent], [task]);

    const engine = new PolicyEngine();
    const result = engine.authorize(
      { ...record, status: "active" },
      agent,
      0.2,
      "unknown-service.ai",
    );

    expect(result.approved).toBe(false);
    expect(result.reason).toBe("Service is not whitelisted for this task");
  });

  test("marks valid spends as requiring human approval", () => {
    const store = new MissionStore({ seedDemo: false });
    const agent = createAgent();
    const task = createTask(agent);
    const record = store.create(
      {
        ...demoMissionInput,
        maxBudget: 2,
        maxPerCall: 1,
        humanApprovalAbove: 0,
      },
      [agent],
      [agent],
      [task],
    );

    const engine = new PolicyEngine();
    const result = engine.authorize(
      { ...record, status: "active" },
      agent,
      0.46,
      "simulation.ai",
    );

    expect(result.approved).toBe(true);
    expect(result.requiresHumanApproval).toBe(true);
  });
});
