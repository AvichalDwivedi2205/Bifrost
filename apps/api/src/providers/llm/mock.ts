import type { MissionTask, VerificationCheck } from "@bifrost/shared";

import type { LLMProvider, LLMRequest, LLMTextResponse } from "./types";

function createPlan(prompt: string): MissionTask[] {
  const mission = prompt.slice(0, 180);
  return [
    {
      id: "task-plan",
      title: "Plan mission",
      objective: `Decompose mission: ${mission}`,
      assignedAgent: "coordinator",
      dependencies: [],
      budgetAllocation: 0,
      approvedServices: [],
      verificationExpectation: "Task graph emitted in JSON",
      status: "complete",
    },
    {
      id: "task-research",
      title: "Research wallet context",
      objective: "Gather wallet intelligence, counterparties, and suspicious edges.",
      assignedAgent: "research",
      dependencies: ["task-plan"],
      budgetAllocation: 0.3,
      approvedServices: ["chain-intel.io"],
      verificationExpectation: "Structured research dossier",
      status: "pending",
    },
    {
      id: "task-risk",
      title: "Run risk scoring",
      objective: "Calculate risk score and decide on premium simulation usage.",
      assignedAgent: "risk",
      dependencies: ["task-research"],
      budgetAllocation: 0.8,
      approvedServices: ["risk-model.ai", "simulation.ai"],
      verificationExpectation: "Risk score with rationale",
      status: "pending",
    },
    {
      id: "task-execution",
      title: "Generate recommendation",
      objective: "Prepare concise recommendation and next actions.",
      assignedAgent: "execution",
      dependencies: ["task-risk"],
      budgetAllocation: 0.15,
      approvedServices: [],
      verificationExpectation: "Artifact with recommendation",
      status: "pending",
    },
    {
      id: "task-verify",
      title: "Verify mission",
      objective: "Check outputs against mission success criteria and prepare proof.",
      assignedAgent: "verifier",
      dependencies: ["task-execution"],
      budgetAllocation: 0,
      approvedServices: [],
      verificationExpectation: "Proof hash and verdict",
      status: "pending",
    },
  ];
}

function createResearchSummary(): Record<string, unknown> {
  return {
    summary:
      "Wallet shows dense interactions with 12 high-risk counterparties, recent exposure to thin-liquidity memecoins, and two suspicious bridge hops.",
    flags: [
      "counterparty_cluster_high_risk",
      "illiquid_token_exposure",
      "bridge_hop_pattern",
    ],
    artifactRef: "artifact://mission/research-report",
  };
}

function createRiskSummary(): Record<string, unknown> {
  return {
    riskScore: 74,
    rationale:
      "Counterparty concentration and illiquid exposure suggest elevated downside risk. Premium simulation recommended.",
    simulationRequired: true,
    recommendedService: "simulation.ai",
    artifactRef: "artifact://mission/risk-report",
  };
}

function createExecutionSummary(): Record<string, unknown> {
  return {
    recommendation:
      "Reduce exposure to low-liquidity positions, avoid new bridge transfers, and monitor counterparty cluster for additional outflows.",
    artifactRef: "artifact://mission/recommendation",
  };
}

function createNewsSummary(): Record<string, unknown> {
  return {
    summary:
      "Trump's public narrative shifted from rally logistics to legal pressure and fundraising, with two fast-moving headline bursts in the last six hours.",
    keyPoints: [
      "Headline burst one coincided with a short-lived market spike.",
      "Headline burst two lacked a fresh catalyst and looked mostly recycled.",
      "Public news alone does not fully explain the earliest move.",
    ],
    artifactRef: "artifact://mission/news-dossier",
  };
}

function createMarketSummary(): Record<string, unknown> {
  return {
    summary:
      "The most active Trump-linked market moved quickly on thin liquidity, with a wider spread than the neighboring contracts and a sharp early print before the headline peak.",
    markets: [
      "Will Trump make statement X before date Y?",
      "Will Trump-linked event Z happen this week?",
    ],
    artifactRef: "artifact://mission/market-scan",
  };
}

function createSkepticSummary(): Record<string, unknown> {
  return {
    verdict: "too_sus",
    summary:
      "The market move appears early relative to the public signal, thin enough to be unreliable, and likely too suspicious to justify a fresh position.",
    confidence: 0.74,
    keyPoints: [
      "Price moved before the strongest public catalyst.",
      "Liquidity was thin enough for a small early trade to move the market.",
      "The cleaner action is to wait rather than chase.",
    ],
    artifactRef: "artifact://mission/skeptic-memo",
  };
}

function createTradeRecommendation(): Record<string, unknown> {
  return {
    verdict: "too_sus",
    headline: "Too much weird timing, not enough clean edge",
    recommendation:
      "Do not chase this Trump-related market right now. The timing looks off, liquidity is thin, and the better action is to wait for a cleaner setup.",
    confidence: 0.78,
    keyPoints: [
      "The strongest public catalyst lagged the earliest move.",
      "Thin liquidity makes the market easy to distort.",
      "Bifrost recommends preserving budget rather than forcing a trade.",
    ],
    artifactRef: "artifact://mission/final-recommendation",
  };
}

function createVerificationSummary(): {
  approved: boolean;
  proofHash: string;
  checks: VerificationCheck[];
  summary: string;
} {
  return {
    approved: true,
    proofHash: "proof_0xa46f92f3b5c1d90f",
    summary: "Mission satisfied the success criteria and stayed within budget limits.",
    checks: [
      { id: "risk", label: "Risk score computed", status: "passed" },
      { id: "simulation", label: "Simulation triggered when score exceeded threshold", status: "passed" },
      { id: "recommendation", label: "Recommendation generated", status: "passed" },
      { id: "verifier", label: "Verifier approval prepared", status: "passed" },
    ],
  };
}

function buildMockPayload(task: string, prompt: string): unknown {
  switch (task) {
    case "plan_mission":
      return { tasks: createPlan(prompt) };
    case "research_wallet":
      return createResearchSummary();
    case "risk_assessment":
      return createRiskSummary();
    case "execution_artifact":
      return createExecutionSummary();
    case "news_signal":
      return createNewsSummary();
    case "market_scan":
      return createMarketSummary();
    case "skeptic_review":
      return createSkepticSummary();
    case "trade_recommendation":
      return createTradeRecommendation();
    case "verify_mission":
      return createVerificationSummary();
    default:
      return { message: "No mock payload defined", task };
  }
}

export class MockLLMProvider implements LLMProvider {
  public readonly provider = "mock" as const;

  isConfigured(): boolean {
    return true;
  }

  async generateText(request: LLMRequest): Promise<LLMTextResponse> {
    const payload = buildMockPayload(request.task, request.prompt);
    return {
      provider: this.provider,
      model: "bifrost/mock-runtime",
      text: JSON.stringify(payload),
    };
  }
}
