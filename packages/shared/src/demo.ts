import type {
  AgentProfile,
  AgentSelectionProposal,
  AnalyticsOverview,
  MissionEvent,
  MissionInput,
  MissionRecord,
  MissionStatus,
  MissionTask,
  RegistryAgent,
  SpendApprovalRequest,
  SpendReceipt,
  VerificationCheck,
} from "./types";

export const demoMissionInput: MissionInput = {
  title: "Trump Momentum Trade Hunt",
  template: "trump-polymarket",
  description:
    "Analyze Trump-related news and Polymarket data to recommend the best trade or call it too late or too suspicious.",
  objective:
    "Use curated agents to gather news, inspect Trump-linked markets, challenge the thesis, and return a final recommendation under 2.00 USDC.",
  successCriteria:
    "A final trade recommendation is produced with supporting evidence, receipts, and all payments explicitly approved by a human.",
  authorityWallet: "11111111111111111111111111111111",
  urgency: "high",
  executionMode: "guarded_autonomy",
  verificationMode: "human",
  maxBudget: 2,
  maxPerCall: 0.6,
  humanApprovalAbove: 0,
  challengeWindowHours: 24,
};

function isoAgo(millisecondsAgo: number): string {
  return new Date(Date.now() - millisecondsAgo).toISOString();
}

function phaseRun(
  phaseId: string,
  status: "active" | "complete" | "failed",
  detail: string,
  startedAgoMs: number,
  completedAgoMs?: number,
) {
  return {
    phaseId,
    status,
    detail,
    attempt: 1,
    startedAt: isoAgo(startedAgoMs),
    completedAt: completedAgoMs ? isoAgo(completedAgoMs) : undefined,
  };
}

const coordinatorPhases = [
  {
    id: "score_registry",
    label: "Score Registry",
    description: "Review the curated registry and score agents for the mission.",
    streams: true,
  },
  {
    id: "propose_team",
    label: "Propose Team",
    description: "Propose a starter lineup and wait for human confirmation.",
    streams: true,
  },
];

const newsPhases = [
  {
    id: "wait_for_payment",
    label: "Wait For Payment",
    description: "Pause until the human approves the paid query.",
    streams: true,
  },
  {
    id: "plan_timeline",
    label: "Plan Timeline",
    description: "Frame the exact events and time windows to inspect.",
    streams: true,
  },
  {
    id: "gather_headlines",
    label: "Gather Headlines",
    description: "Pull Trump-related headlines, quotes, and timestamps.",
    streams: true,
  },
  {
    id: "synthesize_signal",
    label: "Synthesize Signal",
    description: "Turn the raw timeline into an actionable news memo.",
    streams: true,
  },
];

const marketPhases = [
  {
    id: "wait_for_payment",
    label: "Wait For Payment",
    description: "Pause until the human approves the paid market scan.",
    streams: true,
  },
  {
    id: "map_contracts",
    label: "Map Contracts",
    description: "Find Trump-linked markets relevant to the mission objective.",
    streams: true,
  },
  {
    id: "scan_orderflow",
    label: "Scan Orderflow",
    description: "Inspect price moves, spreads, and liquidity conditions.",
    streams: true,
  },
  {
    id: "rank_markets",
    label: "Rank Markets",
    description: "Rank the most actionable markets for the downstream agents.",
    streams: true,
  },
];

const skepticPhases = [
  {
    id: "wait_for_payment",
    label: "Wait For Payment",
    description: "Pause until the human approves the replay analysis.",
    streams: true,
  },
  {
    id: "replay_timing",
    label: "Replay Timing",
    description: "Line up public signals against market movement.",
    streams: true,
  },
  {
    id: "challenge_thesis",
    label: "Challenge Thesis",
    description: "Stress test whether the apparent edge is real or stale.",
    streams: true,
  },
  {
    id: "score_suspicion",
    label: "Score Suspicion",
    description: "Estimate whether the setup is too suspicious to touch.",
    streams: true,
  },
];

const executionPhases = [
  {
    id: "draft_verdict",
    label: "Draft Verdict",
    description: "Turn the research into a concrete trade verdict.",
    streams: true,
  },
  {
    id: "package_artifact",
    label: "Package Artifact",
    description: "Produce the final recommendation artifact for the mission.",
    streams: true,
  },
];

const launchStrategistPhases = [
  {
    id: "research_to_angles",
    label: "Research To Angles",
    description: "Turn landscape findings into positioning options.",
    streams: true,
  },
  {
    id: "wait_for_direction",
    label: "Wait For Direction",
    description: "Pause until the human chooses the launch direction.",
    streams: true,
  },
];

const launchCopyPhases = [
  {
    id: "draft_page_copy",
    label: "Draft Page Copy",
    description: "Write the hero, sections, CTA, and FAQ.",
    streams: true,
  },
  {
    id: "draft_launch_posts",
    label: "Draft Launch Posts",
    description: "Prepare social posts for launch channels.",
    streams: true,
  },
];

const launchDeployPhases = [
  {
    id: "build_site",
    label: "Build Site",
    description: "Generate landing page files and waitlist hook.",
    streams: true,
  },
  {
    id: "preview_deploy",
    label: "Preview Deploy",
    description: "Create the preview URL and receipt.",
    streams: true,
  },
  {
    id: "live_deploy",
    label: "Live Deploy",
    description: "Promote the preview to a live URL.",
    streams: true,
  },
];

const verifierPhases = [
  {
    id: "audit_approvals",
    label: "Audit Approvals",
    description: "Confirm that every paid action was explicitly approved.",
    streams: true,
  },
  {
    id: "check_artifacts",
    label: "Check Artifacts",
    description: "Verify the output against the mission success criteria.",
    streams: true,
  },
  {
    id: "settle_onchain",
    label: "Settle Onchain",
    description: "Record verification and release settlement on Solana.",
    streams: true,
  },
];

const researchPhases = [
  {
    id: "collect_context",
    label: "Collect Context",
    description: "Gather source material and prior artifacts for the mission.",
    streams: true,
  },
  {
    id: "build_dossier",
    label: "Build Dossier",
    description: "Package findings into a structured research artifact.",
    streams: true,
  },
];

const riskPhases = [
  {
    id: "score_exposure",
    label: "Score Exposure",
    description: "Calculate risk, uncertainty, and failure modes.",
    streams: true,
  },
  {
    id: "recommend_guardrails",
    label: "Recommend Guardrails",
    description: "Suggest spend, execution, and verification controls.",
    streams: true,
  },
];

const compliancePhases = [
  {
    id: "screen_policy",
    label: "Screen Policy",
    description: "Check mission and tools against declared policy constraints.",
    streams: true,
  },
  {
    id: "emit_controls",
    label: "Emit Controls",
    description: "Return allowed actions, blocked actions, and audit notes.",
    streams: true,
  },
];

const walletIntelPhases = [
  {
    id: "map_wallet",
    label: "Map Wallet",
    description: "Inspect wallet counterparties, token exposure, and recent flows.",
    streams: true,
  },
  {
    id: "flag_edges",
    label: "Flag Edges",
    description: "Surface wallet-level opportunities and suspicious patterns.",
    streams: true,
  },
];

function placeholderAgent(input: {
  id: string;
  slug: string;
  name: string;
  role: RegistryAgent["role"];
  icon: string;
  description: string;
  trustScore: number;
  totalMissions: number;
  capabilities: string[];
  supportedServices: string[];
  executionMode?: RegistryAgent["executionMode"];
  registrationStatus?: RegistryAgent["registrationStatus"];
  verifierCompatible?: boolean;
  priceModel: string;
  phaseSchema: RegistryAgent["phaseSchema"];
  wallet?: string;
  payoutWallet?: string;
  verifierWallet?: string;
  agentRegistryPda?: string;
  anchorTxSignature?: string;
}): RegistryAgent {
  const trustProfile = {
    agentId: input.id,
    globalTrustScore: input.trustScore,
    categoryScores: {
      [input.role]: input.trustScore,
      [input.capabilities[0] ?? "general"]: Math.min(99, input.trustScore + 3),
    },
    completedMissions: input.totalMissions,
    failedMissions: Math.max(0, Math.floor(input.totalMissions * 0.025)),
    disputedMissions: Math.max(0, Math.floor(input.totalMissions * 0.008)),
    verifierPassRate: Math.min(0.99, input.trustScore / 100 + 0.04),
    humanOverrideRate: Math.max(0.02, 1 - input.trustScore / 100),
    spendDiscipline: Math.min(0.99, input.trustScore / 100 + 0.03),
    latencyScore: Math.min(0.99, input.trustScore / 100 + 0.01),
    proofQualityScore: Math.min(0.99, input.trustScore / 100 + 0.02),
    lastUpdated: "2026-05-05T00:00:00.000Z",
    latestReputationTx: `rep_${input.id}_${input.trustScore}`,
  };
  return {
    wallet: `${input.id.slice(0, 4).toUpperCase()}...${String(input.trustScore)}BF`,
    payoutWallet: `${input.id.slice(0, 4).toUpperCase()}...PAY`,
    verifierWallet: input.verifierCompatible ? "2aQm...7LmP" : "8RpL...2Qx7",
    active:
      input.registrationStatus === undefined ||
      input.registrationStatus === "active" ||
      input.registrationStatus === "certified",
    executionMode: input.executionMode ?? "callback",
    verifierCompatible: input.verifierCompatible ?? false,
    metadataUri: `mock://registry/${input.slug}/metadata.json`,
    trustProfile,
    ...input,
  };
}

const realWorldAgents: RegistryAgent[] = [
  placeholderAgent({
    id: "cold-email-sdr-1",
    slug: "cold-email-sdr",
    name: "Cold Email SDR",
    role: "custom",
    icon: "✉",
    description:
      "Drafts personalized outbound email sequences from ICP brief + lead context, signs each send with the operator wallet, and respects opt-out and CAN-SPAM rules.",
    trustScore: 86,
    totalMissions: 174,
    capabilities: ["sequence-drafting", "icp-personalization", "opt-out-honoring"],
    supportedServices: ["smtp-gateway.local", "lead-context.api"],
    executionMode: "callback",
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.04 USDC per signed send",
    phaseSchema: executionPhases,
  }),
  placeholderAgent({
    id: "lead-enrichment-1",
    slug: "lead-enrichment",
    name: "Lead Enrichment",
    role: "research",
    icon: "🔎",
    description:
      "Enriches lead lists with title, company, recent triggers, and freshness checks via Apollo/Clearbit-class APIs. Returns structured profiles with provenance.",
    trustScore: 89,
    totalMissions: 248,
    capabilities: ["contact-enrichment", "freshness-check", "company-trigger-events"],
    supportedServices: ["enrichment.api", "linkedin-public-search"],
    executionMode: "callback",
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.08 USDC per enriched lead",
    phaseSchema: researchPhases,
  }),
  placeholderAgent({
    id: "meeting-booker-1",
    slug: "meeting-booker",
    name: "Meeting Booker",
    role: "custom",
    icon: "📅",
    description:
      "Handles reply-to-book flow on inbound responses: parses intent, proposes calendar slots, books the meeting, and notifies the operator. Routes via signed scheduling tokens.",
    trustScore: 82,
    totalMissions: 96,
    capabilities: ["reply-classification", "slot-proposal", "calendar-booking"],
    supportedServices: ["calendar.api", "intent-classifier.local"],
    executionMode: "callback",
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.05 USDC per booked meeting",
    phaseSchema: executionPhases,
  }),
  placeholderAgent({
    id: "pr-reviewer-1",
    slug: "pr-reviewer",
    name: "PR Reviewer",
    role: "custom",
    icon: "🧮",
    description:
      "Reviews pull request diffs, flags likely bugs and unsafe patterns, and produces inline comments. Verifier audits signal-to-noise ratio against ground truth.",
    trustScore: 91,
    totalMissions: 312,
    capabilities: ["diff-analysis", "bug-detection", "security-flagging"],
    supportedServices: ["github.api", "tree-sitter.local"],
    executionMode: "callback",
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.10 USDC per reviewed PR",
    phaseSchema: researchPhases,
  }),
  placeholderAgent({
    id: "docs-generator-1",
    slug: "docs-generator",
    name: "Docs Generator",
    role: "custom",
    icon: "📘",
    description:
      "Generates README, API reference, and runbook docs directly from source. Cross-checks examples against actual function signatures.",
    trustScore: 84,
    totalMissions: 142,
    capabilities: ["readme-generation", "api-reference", "example-verification"],
    supportedServices: ["github.api", "static-analyzer.local"],
    executionMode: "builtin",
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.06 USDC per doc",
    phaseSchema: executionPhases,
  }),
  placeholderAgent({
    id: "deploy-gatekeeper-1",
    slug: "deploy-gatekeeper",
    name: "Deploy Gatekeeper",
    role: "execution",
    icon: "🚦",
    description:
      "Confirms CI green, smoke tests pass, and rollback path exists before signing the promote-to-prod transaction. Records gate evidence on-chain.",
    trustScore: 94,
    totalMissions: 89,
    capabilities: ["ci-status-check", "smoke-test-gate", "rollback-validation"],
    supportedServices: ["ci.api", "deploy.api"],
    executionMode: "callback",
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.15 USDC per signed promote",
    phaseSchema: executionPhases,
  }),
  placeholderAgent({
    id: "invoice-auditor-1",
    slug: "invoice-auditor",
    name: "Invoice Auditor",
    role: "compliance",
    icon: "🧾",
    description:
      "OCRs invoices, reconciles line items against purchase orders, validates math + tax + due dates, and flags duplicates or anomalies for human approval.",
    trustScore: 92,
    totalMissions: 268,
    capabilities: ["invoice-ocr", "po-reconciliation", "anomaly-detection"],
    supportedServices: ["ocr.api", "po-store.local"],
    executionMode: "callback",
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.07 USDC per invoice",
    phaseSchema: compliancePhases,
  }),
  placeholderAgent({
    id: "expense-reviewer-1",
    slug: "expense-reviewer",
    name: "Expense Reviewer",
    role: "compliance",
    icon: "💳",
    description:
      "Reviews team expense submissions against company spend policy, flags policy violations, and routes ambiguous cases to the assigned approver.",
    trustScore: 88,
    totalMissions: 201,
    capabilities: ["policy-match", "violation-flag", "approver-routing"],
    supportedServices: ["expense-feed.api", "policy-store.local"],
    executionMode: "builtin",
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.03 USDC per expense reviewed",
    phaseSchema: compliancePhases,
  }),
  placeholderAgent({
    id: "contract-redliner-1",
    slug: "contract-redliner",
    name: "Contract Redliner",
    role: "compliance",
    icon: "📜",
    description:
      "Highlights risky clauses (liability, IP assignment, termination, indemnity) in vendor or partnership contracts and proposes counter-language. Human signs final version.",
    trustScore: 87,
    totalMissions: 124,
    capabilities: ["clause-classification", "risk-scoring", "counter-language"],
    supportedServices: ["doc-parser.local", "clause-library.local"],
    executionMode: "callback",
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.18 USDC per contract reviewed",
    phaseSchema: compliancePhases,
  }),
  placeholderAgent({
    id: "compliance-auditor-1",
    slug: "compliance-auditor",
    name: "Compliance Auditor",
    role: "compliance",
    icon: "🛡",
    description:
      "Runs SOC 2 / GDPR / HIPAA evidence sweeps, identifies controls with stale evidence, and prepares the auditor packet. Verifier checks coverage against the framework.",
    trustScore: 93,
    totalMissions: 78,
    capabilities: ["control-coverage", "evidence-collection", "audit-packet-prep"],
    supportedServices: ["compliance-store.local", "evidence-collector.api"],
    executionMode: "builtin",
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.40 USDC per audit sweep",
    phaseSchema: compliancePhases,
  }),
];

export const demoRegistry: RegistryAgent[] = [
  {
    id: "coordinator-1",
    slug: "mission-coordinator",
    name: "Mission Coordinator",
    role: "coordinator",
    icon: "🧭",
    description: "Plans the mission, chooses agents, and keeps the run on rails.",
    trustScore: 96,
    wallet: "3Fjx...9M8Q",
    payoutWallet: "3Fjx...9M8Q",
    verifierWallet: "8RpL...2Qx7",
    active: true,
    totalMissions: 211,
    capabilities: ["planning", "routing", "budgeting"],
    verifierCompatible: false,
    supportedServices: [],
    executionMode: "builtin",
    priceModel: "No direct spend",
    phaseSchema: coordinatorPhases,
  },
  {
    id: "trump-news-1",
    slug: "news-researcher",
    name: "News Researcher",
    role: "news",
    icon: "📰",
    description: "Collects industry headlines, regulatory filings, and narrative shifts relevant to the mission's domain.",
    trustScore: 88,
    wallet: "6PaH...nX9q",
    payoutWallet: "6PaH...nX9q",
    verifierWallet: "8RpL...2Qx7",
    active: true,
    totalMissions: 142,
    capabilities: ["headline-triage", "timestamp-analysis", "signal-aggregation"],
    verifierCompatible: true,
    supportedServices: ["headline-feed.ai", "archive-indexer.ai"],
    executionMode: "builtin",
    priceModel: "Per paid query",
    phaseSchema: newsPhases,
  },
  {
    id: "polymarket-1",
    slug: "market-analyst",
    name: "Market Analyst",
    role: "market",
    icon: "📈",
    description: "Surveys market structure, pricing, liquidity, and volume context across exchanges relevant to the mission.",
    trustScore: 90,
    wallet: "4MwL...7K2P",
    payoutWallet: "4MwL...7K2P",
    verifierWallet: "8RpL...2Qx7",
    active: true,
    totalMissions: 98,
    capabilities: ["market-scanning", "liquidity-checks", "price-move-analysis"],
    verifierCompatible: true,
    supportedServices: ["market-scan.ai", "orderflow-ai"],
    executionMode: "builtin",
    priceModel: "Per market scan",
    phaseSchema: marketPhases,
  },
  {
    id: "skeptic-1",
    slug: "skeptic-agent",
    name: "Skeptic Agent",
    role: "skeptic",
    icon: "🕵️",
    description: "Challenges whether the move is edge, noise, or too suspicious to touch.",
    trustScore: 84,
    wallet: "8RpL...2Qx7",
    payoutWallet: "8RpL...2Qx7",
    verifierWallet: "8RpL...2Qx7",
    active: true,
    totalMissions: 76,
    capabilities: ["thesis-challenge", "timing-analysis", "asymmetry-scoring"],
    verifierCompatible: true,
    supportedServices: ["signal-replay.ai"],
    executionMode: "builtin",
    priceModel: "Per analysis run",
    phaseSchema: skepticPhases,
  },
  {
    id: "execution-1",
    slug: "execution-agent",
    name: "Execution Agent",
    role: "execution",
    icon: "⚡",
    description: "Produces the final recommendation artifact and suggested action.",
    trustScore: 91,
    wallet: "9EpQ...1NxL",
    payoutWallet: "9EpQ...1NxL",
    verifierWallet: "8RpL...2Qx7",
    active: true,
    totalMissions: 114,
    capabilities: ["artifact-generation", "trade-framing", "action-synthesis"],
    verifierCompatible: false,
    supportedServices: [],
    executionMode: "builtin",
    priceModel: "No direct spend",
    phaseSchema: executionPhases,
  },
  {
    id: "verifier-1",
    slug: "verifier-agent",
    name: "Verifier Agent",
    role: "verifier",
    icon: "✓",
    description: "Checks the mission output and ensures human-approved payments were respected.",
    trustScore: 93,
    wallet: "Bq83RwMr1kjgHUdD6pFc2uj66jdmCFDwiRjqz49YXKyL",
    payoutWallet: "FncLmdpGouTbLTsD9zSGE1ZPxJDAzCuAiQDeZ4x2CWki",
    verifierWallet: "HZcj5tG3S5SuARhLo7VJ2DcKHzWGxwp1Zw5GZg3ur4FW",
    agentRegistryPda: "AFi7H4iZyyvdvLKwQJSHFkbtg1bf3LAKpwF5iUxiZbfQ",
    anchorTxSignature: "C3gh2nqR2aAKZaRQ2rVhzht8if5mMg1KiBdmwegRRwZ48neuYZ6Ez9kJY2mZ3hs4oVJ3sBysroS4DCchKvC9bfR",
    active: true,
    totalMissions: 330,
    capabilities: ["proof-check", "policy-audit", "artifact-verify"],
    verifierCompatible: true,
    supportedServices: [],
    executionMode: "builtin",
    priceModel: "No direct spend",
    phaseSchema: verifierPhases,
  },
  placeholderAgent({
    id: "competitor-map-1",
    slug: "competitor-research-scout",
    name: "Competitor Research Scout",
    role: "research",
    icon: "⬡",
    description:
      "Maps live competitors and their messaging patterns from a domain query, then computes positioning gaps the launch team can claim.",
    trustScore: 82,
    totalMissions: 127,
    capabilities: ["competitor-map", "gap-analysis"],
    supportedServices: ["web-search", "colosseum-copilot"],
    registrationStatus: "active",
    verifierCompatible: true,
    priceModel: "0.25 USDC per map",
    phaseSchema: researchPhases,
    wallet: "25j8VQLHoGkjaKJ56fWV7irKNEvAXW6Tp7WqbFiaFqi8",
    payoutWallet: "7CqQ2XqX8DgiNKs6auQ751EHWgP6Jk7hs8Hdb5FeFR5c",
    verifierWallet: "Fecqonf3TLhpbHjTichfSz8y7HCFNCm9AaShZKU1LhL5",
    agentRegistryPda: "Bkee8XmJK6gQGn2UXiw81WxaztBPC1h8SQu8GrPRVpnq",
    anchorTxSignature: "2grHGLzgrjDdfMG151bKzVVL5KUJihboZGe5KjoLb6vCWUeRUqYoCW2q71QE1pasg68cQCrYNE6W5vuJFJGmh87J",
  }),
  {
    id: "launch-strategist-1",
    slug: "launch-strategist",
    name: "Launch Strategist",
    role: "planner",
    icon: "S",
    description: "Shapes broad mission briefs into launch angles, checkpoints, and decision-ready options.",
    trustScore: 92,
    wallet: "8xHvUkTmxzCKEBSt4dd5RpzJrg9ppt4VccL9Ck2hJKmb",
    payoutWallet: "DyFTqBfNKiqizLVJhT1h3UzbRkguq7kebBVtVEg1WfgW",
    verifierWallet: "ELVjG9jWZCSePe9EuuzyQp6xSkWDgPhGGabi4Yx8KzYp",
    agentRegistryPda: "8qKLDxWnkgExWE6mEi2b9mbbzHDwYjCCwMxzQwobzhao",
    anchorTxSignature: "4qggCAL5jVCdXHiVKxmRCpS2eYcrdGEp1e6TDKyg5iMAcy87f5c1BrSFfoPvPfw2wqDm5HWJkdDndMbXqim4bXsz",
    active: true,
    totalMissions: 148,
    capabilities: ["positioning", "launch-plan", "checkpoint-design"],
    verifierCompatible: true,
    supportedServices: [],
    executionMode: "builtin",
    priceModel: "No direct spend",
    phaseSchema: launchStrategistPhases,
  },
  {
    id: "launch-copywriter-1",
    slug: "launch-copywriter",
    name: "Launch Copywriter",
    role: "custom",
    icon: "C",
    description: "Writes conversion copy, FAQs, and launch posts from approved positioning.",
    trustScore: 88,
    wallet: "3c3vHvEYWAwMqxYnGeMoNw66PGWS1B43vHUC3VnWHNrK",
    payoutWallet: "3Kc5JPTenQFEV9tcLnJ1zVEM73Lf9K9oftePHn2f3NQb",
    verifierWallet: "ENXZTQTZcByXkBz2h1MH9HTSYqxv7MvuCwDxHt2EuPcR",
    agentRegistryPda: "BBbZPnyWpUGQG5pVh8ho7ndoQ3DjMhZmF5aZThh4Waox",
    anchorTxSignature: "29sLN9WCBVAvyBR5xXmPjkp7fMLLcY1qp9z1vcgWjNbKHf4NMyYNTRLuZCvmQjTNfq3DdEiksGKozvU22TBAUGyz",
    active: true,
    totalMissions: 121,
    capabilities: ["landing-copy", "faq-copy", "social-posts"],
    verifierCompatible: true,
    supportedServices: [],
    executionMode: "builtin",
    priceModel: "No direct spend",
    phaseSchema: launchCopyPhases,
  },
  {
    id: "launch-builder-1",
    slug: "launch-builder",
    name: "Landing Page Builder",
    role: "execution",
    icon: "B",
    description: "Generates production-ready landing page files and waitlist wiring.",
    trustScore: 90,
    wallet: "4RJPYqmMLRg6rAC9CSCjNmrsMd2qjapw6qwkgeZcEeME",
    payoutWallet: "5yzA66H3nrMgDBLGeR1fQs7UhYf8kFStEme8buq7YcZC",
    verifierWallet: "J9zbh7DVuo4iJnzeb3LvsFXS1xB9kcS5rZgQMfkJQbbx",
    agentRegistryPda: "33CdYW2PXxyfkmFAobvVTb6eXWYsPVSupbkt4sU9EduC",
    anchorTxSignature: "4jvPHMdsSSDXuEthDWcfNN1M18MJudUkSrVwuGQVb7uUFh2FGbMm1Hy1QT9rnMZ4WbrfCdbWDNj8HrcyLEsB8eqx",
    active: true,
    totalMissions: 102,
    capabilities: ["site-generation", "responsive-layout", "waitlist-form"],
    verifierCompatible: true,
    supportedServices: [],
    executionMode: "builtin",
    priceModel: "No direct spend",
    phaseSchema: launchDeployPhases,
  },
  {
    id: "launch-deployer-1",
    slug: "launch-deployer",
    name: "Launch Deployer",
    role: "execution",
    icon: "D",
    description: "Creates preview/live deployment receipts and searches domain candidates under policy.",
    trustScore: 87,
    wallet: "DVRwMojM1Cu7uiZ96U6mvb6pwzMiKg7v2PsXun3poZRG",
    payoutWallet: "C7m77Dx3L4EEmpyuQGJfoHwUYEymnPDpTpChxrme8BGN",
    verifierWallet: "FBm9ZVQgiJMkU9p7grqwmszPQX2ysyuqKLuSduojXGYd",
    agentRegistryPda: "EqVrMwBxJHS9VUZDhgbCYCcPsLnxYMLfnYAz86synGwC",
    anchorTxSignature: "2XzmvCegLGtANgprSH7JGfYGKYPeYeuFXsHkJMVbQLzNDoeN3oynvznuL9cKDocCmYYPXr4uDixhPirimYL7Pipo",
    active: true,
    totalMissions: 96,
    capabilities: ["preview-deploy", "live-deploy", "domain-search"],
    verifierCompatible: true,
    supportedServices: ["preview-deploy.local", "live-deploy.local", "domain-search.local"],
    executionMode: "builtin",
    priceModel: "0.75 USDC per preview deploy",
    phaseSchema: launchDeployPhases,
  },
  ...realWorldAgents,
];

const selectionProposal: AgentSelectionProposal = {
  id: "proposal-demo-1",
  status: "approved",
  recommendedAgentIds: ["trump-news-1", "polymarket-1", "skeptic-1", "execution-1", "verifier-1"],
  chosenAgentIds: ["trump-news-1", "polymarket-1", "skeptic-1", "execution-1", "verifier-1"],
  reason:
    "This mission needs one agent for news, one for market data, one to challenge the thesis, one to compile the recommendation, and one to verify the run.",
  createdAt: new Date(Date.now() - 185_000).toISOString(),
  respondedAt: new Date(Date.now() - 170_000).toISOString(),
};

export const demoAgents: AgentProfile[] = demoRegistry
  .filter((agent) => selectionProposal.chosenAgentIds.includes(agent.id))
  .map((agent) => {
    const runtime: Record<string, Partial<AgentProfile>> = {
      "coordinator-1": {
        selected: true,
        status: "complete",
        currentAction: "Registry proposal approved",
        currentPhaseId: "propose_team",
        currentPhaseStatus: "complete",
        phaseHistory: [
          phaseRun("score_registry", "complete", "Curated registry scored for the mission", 188_000, 184_000),
          phaseRun("propose_team", "complete", "Starter lineup proposed and approved", 183_000, 170_000),
        ],
        budgetCap: 0,
        costIncurred: 0,
      },
      "trump-news-1": {
        selected: true,
        status: "complete",
        currentAction: "News bundle finalized",
        currentPhaseId: "synthesize_signal",
        currentPhaseStatus: "complete",
        phaseHistory: [
          phaseRun("wait_for_payment", "complete", "Headline-feed payment approved", 125_000, 122_000),
          phaseRun("plan_timeline", "complete", "Mission scope reduced to the highest-signal Trump events", 121_000, 118_000),
          phaseRun("gather_headlines", "complete", "Timestamped headline batch collected", 117_000, 111_000),
          phaseRun("synthesize_signal", "complete", "News timeline memo packaged for the next agent", 110_000, 108_000),
        ],
        budgetCap: 0.45,
        costIncurred: 0.22,
      },
      "polymarket-1": {
        selected: true,
        status: "complete",
        currentAction: "Market scan and spread check complete",
        currentPhaseId: "rank_markets",
        currentPhaseStatus: "complete",
        phaseHistory: [
          phaseRun("wait_for_payment", "complete", "Market-scan payment approved", 91_000, 88_000),
          phaseRun("map_contracts", "complete", "Trump-related contracts mapped", 87_000, 83_000),
          phaseRun("scan_orderflow", "complete", "Liquidity and movement scanned", 82_000, 76_000),
          phaseRun("rank_markets", "complete", "Most relevant markets ranked for the skeptic", 75_000, 73_000),
        ],
        budgetCap: 0.55,
        costIncurred: 0.32,
      },
      "skeptic-1": {
        selected: true,
        status: "working",
        currentAction: "Testing whether the move is already priced in",
        currentPhaseId: "wait_for_payment",
        currentPhaseStatus: "active",
        phaseHistory: [
          phaseRun("wait_for_payment", "active", "Waiting for payment approval to replay timing data", 16_000),
        ],
        budgetCap: 0.3,
        costIncurred: 0,
      },
      "execution-1": {
        selected: true,
        status: "waiting",
        currentAction: "Waiting for skeptic verdict",
        currentPhaseStatus: "pending",
        phaseHistory: [],
        budgetCap: 0,
        costIncurred: 0,
      },
      "verifier-1": {
        selected: true,
        status: "waiting",
        currentAction: "Waiting for final artifact",
        currentPhaseStatus: "pending",
        phaseHistory: [],
        budgetCap: 0,
        costIncurred: 0,
      },
    };

    return {
      ...agent,
      ...runtime[agent.id],
    };
  });

export const demoTasks: MissionTask[] = [
  {
    id: "task-plan",
    title: "Select agents from registry",
    objective: "Choose the curated agents best suited for the mission and wait for human approval.",
    assignedAgent: "coordinator",
    assignedAgentId: "coordinator-1",
    dependencies: [],
    budgetAllocation: 0,
    approvedServices: [],
    verificationExpectation: "Human-approved agent selection proposal",
    status: "complete",
  },
  {
    id: "task-news",
    title: "Build the Trump news timeline",
    objective: "Collect the most relevant Trump-related events, timestamps, and public narrative shifts.",
    assignedAgent: "news",
    assignedAgentId: "trump-news-1",
    dependencies: ["task-plan"],
    budgetAllocation: 0.45,
    approvedServices: ["headline-feed.ai", "archive-indexer.ai"],
    verificationExpectation: "Timestamped news summary with links",
    outputArtifactRef: "artifact://mission/news-dossier",
    status: "complete",
  },
  {
    id: "task-market",
    title: "Scan Trump-linked Polymarket markets",
    objective: "Fetch relevant markets, prices, spread, and recent movement before proposing a trade.",
    assignedAgent: "market",
    assignedAgentId: "polymarket-1",
    dependencies: ["task-plan"],
    budgetAllocation: 0.55,
    approvedServices: ["polymarket-scan.ai", "orderflow-ai"],
    verificationExpectation: "Ranked markets with timing notes",
    outputArtifactRef: "artifact://mission/market-scan",
    status: "complete",
  },
  {
    id: "task-skeptic",
    title: "Challenge the edge",
    objective: "Decide whether the thesis is real, stale, or too suspicious to touch.",
    assignedAgent: "skeptic",
    assignedAgentId: "skeptic-1",
    dependencies: ["task-news", "task-market"],
    budgetAllocation: 0.3,
    approvedServices: ["signal-replay.ai"],
    verificationExpectation: "Explicit asymmetry score and caution flags",
    outputArtifactRef: "artifact://mission/skeptic-memo",
    status: "active",
  },
  {
    id: "task-execution",
    title: "Prepare final recommendation",
    objective: "Produce the final answer: good trade, no trade, too late, or too suspicious.",
    assignedAgent: "execution",
    assignedAgentId: "execution-1",
    dependencies: ["task-skeptic"],
    budgetAllocation: 0,
    approvedServices: [],
    verificationExpectation: "Final recommendation artifact",
    status: "waiting",
  },
  {
    id: "task-verify",
    title: "Verify output and approvals",
    objective: "Ensure every payment was human-approved and the final answer matches the evidence.",
    assignedAgent: "verifier",
    assignedAgentId: "verifier-1",
    dependencies: ["task-execution"],
    budgetAllocation: 0,
    approvedServices: [],
    verificationExpectation: "Verifier verdict and proof hash",
    status: "waiting",
  },
];

export const demoReceipts: SpendReceipt[] = [
  {
    receiptId: "receipt-1",
    missionId: "mission-demo-1",
    agentId: "trump-news-1",
    serviceWallet: "headline-feed.ai",
    amount: 0.22,
    purpose: "news_timeline_bundle",
    toolName: "headline-feed.ai",
    timestamp: new Date(Date.now() - 118_000).toISOString(),
    txSignature: "2aQw...Qr8m",
  },
  {
    receiptId: "receipt-2",
    missionId: "mission-demo-1",
    agentId: "polymarket-1",
    serviceWallet: "polymarket-scan.ai",
    amount: 0.32,
    purpose: "market_scan_bundle",
    toolName: "polymarket-scan.ai",
    timestamp: new Date(Date.now() - 84_000).toISOString(),
    txSignature: "7kLm...2Qa1",
  },
];

export const demoSpendApprovals: SpendApprovalRequest[] = [
  {
    id: "approval-1",
    missionId: "mission-demo-1",
    agentId: "trump-news-1",
    status: "approved",
    amount: 0.22,
    service: "headline-feed.ai",
    purpose: "news_timeline_bundle",
    justification: "Pull a timestamped batch of recent Trump headlines and structured story metadata.",
    requestedAt: new Date(Date.now() - 125_000).toISOString(),
    respondedAt: new Date(Date.now() - 122_000).toISOString(),
    txSignature: "2aQw...Qr8m",
  },
  {
    id: "approval-2",
    missionId: "mission-demo-1",
    agentId: "polymarket-1",
    status: "approved",
    amount: 0.32,
    service: "polymarket-scan.ai",
    purpose: "market_scan_bundle",
    justification: "Scan current Trump-tagged markets for price changes, spread, and liquidity context.",
    requestedAt: new Date(Date.now() - 91_000).toISOString(),
    respondedAt: new Date(Date.now() - 88_000).toISOString(),
    txSignature: "7kLm...2Qa1",
  },
  {
    id: "approval-3",
    missionId: "mission-demo-1",
    agentId: "skeptic-1",
    status: "pending",
    amount: 0.08,
    service: "signal-replay.ai",
    purpose: "skeptic_signal_replay",
    justification: "Replay the timing between public Trump news and market movement to estimate whether the edge is stale or too suspicious.",
    requestedAt: new Date(Date.now() - 16_000).toISOString(),
  },
];

export const demoVerificationChecks: VerificationCheck[] = [
  {
    id: "selection",
    label: "Human approved the selected agents",
    status: "passed",
    detail: "Agent lineup was signed by the mission authority wallet.",
  },
  {
    id: "news",
    label: "News timeline assembled",
    status: "passed",
    detail: "Timestamped headline artifact is attached.",
  },
  {
    id: "market",
    label: "Market scan completed",
    status: "passed",
    detail: "Market scan receipt and artifact are present.",
  },
  {
    id: "skeptic",
    label: "Skeptic verdict still pending",
    status: "running",
    detail: "Timing replay payment is waiting for approval.",
  },
  {
    id: "payments",
    label: "Every payment requires explicit approval",
    status: "running",
    detail: "Two receipts approved; one receipt pending.",
  },
];

export const demoEvents: MissionEvent[] = [
  {
    id: "event-1",
    missionId: "mission-demo-1",
    type: "MISSION_CREATED",
    label: "Mission created — budget authorized and vault initialized",
    txSignature: "5pQw...Rz1m",
    createdAt: new Date(Date.now() - 190_000).toISOString(),
  },
  {
    id: "event-2",
    missionId: "mission-demo-1",
    type: "SELECTION_PROPOSED",
    label: "Coordinator proposed 5 registry agents for the mission",
    proposalId: selectionProposal.id,
    agentIds: selectionProposal.recommendedAgentIds,
    createdAt: new Date(Date.now() - 182_000).toISOString(),
  },
  {
    id: "event-3",
    missionId: "mission-demo-1",
    type: "SELECTION_APPROVED",
    label: "Human approved the selected agents",
    proposalId: selectionProposal.id,
    agentIds: selectionProposal.chosenAgentIds,
    createdAt: new Date(Date.now() - 170_000).toISOString(),
  },
  {
    id: "event-4",
    missionId: "mission-demo-1",
    type: "SPEND_APPROVAL_REQUIRED",
    label: "Trump News Agent requested 0.22 USDC for headline-feed.ai",
    agentId: "trump-news-1",
    amount: 0.22,
    service: "headline-feed.ai",
    approvalId: "approval-1",
    createdAt: new Date(Date.now() - 125_000).toISOString(),
  },
  {
    id: "event-5",
    missionId: "mission-demo-1",
    type: "SPEND_APPROVED",
    label: "Human approved 0.22 USDC → headline-feed.ai",
    agentId: "trump-news-1",
    amount: 0.22,
    service: "headline-feed.ai",
    txSignature: "2aQw...Qr8m",
    approvalId: "approval-1",
    createdAt: new Date(Date.now() - 122_000).toISOString(),
  },
  {
    id: "event-6",
    missionId: "mission-demo-1",
    type: "TASK_COMPLETE",
    label: "Trump News Agent delivered the news timeline",
    taskId: "task-news",
    agentId: "trump-news-1",
    outputRef: "artifact://mission/news-dossier",
    createdAt: new Date(Date.now() - 108_000).toISOString(),
  },
  {
    id: "event-6b",
    missionId: "mission-demo-1",
    type: "AGENT_PHASE_COMPLETED",
    label: "Trump News Agent finished synthesizing the news signal",
    agentId: "trump-news-1",
    phaseId: "synthesize_signal",
    detail: "News timeline memo packaged for the next agent",
    attempt: 1,
    createdAt: new Date(Date.now() - 108_000).toISOString(),
  },
  {
    id: "event-7",
    missionId: "mission-demo-1",
    type: "SPEND_APPROVAL_REQUIRED",
    label: "Polymarket Agent requested 0.32 USDC for polymarket-scan.ai",
    agentId: "polymarket-1",
    amount: 0.32,
    service: "polymarket-scan.ai",
    approvalId: "approval-2",
    createdAt: new Date(Date.now() - 91_000).toISOString(),
  },
  {
    id: "event-8",
    missionId: "mission-demo-1",
    type: "SPEND_APPROVED",
    label: "Human approved 0.32 USDC → polymarket-scan.ai",
    agentId: "polymarket-1",
    amount: 0.32,
    service: "polymarket-scan.ai",
    txSignature: "7kLm...2Qa1",
    approvalId: "approval-2",
    createdAt: new Date(Date.now() - 88_000).toISOString(),
  },
  {
    id: "event-9",
    missionId: "mission-demo-1",
    type: "TASK_COMPLETE",
    label: "Polymarket Agent ranked the current Trump markets",
    taskId: "task-market",
    agentId: "polymarket-1",
    outputRef: "artifact://mission/market-scan",
    createdAt: new Date(Date.now() - 73_000).toISOString(),
  },
  {
    id: "event-9b",
    missionId: "mission-demo-1",
    type: "AGENT_PHASE_COMPLETED",
    label: "Polymarket Agent ranked the strongest live contracts",
    agentId: "polymarket-1",
    phaseId: "rank_markets",
    detail: "Markets ranked for downstream challenge and execution",
    attempt: 1,
    createdAt: new Date(Date.now() - 73_000).toISOString(),
  },
  {
    id: "event-10",
    missionId: "mission-demo-1",
    type: "SPEND_APPROVAL_REQUIRED",
    label: "Skeptic Agent is waiting for payment approval to replay the timing signal",
    agentId: "skeptic-1",
    amount: 0.08,
    service: "signal-replay.ai",
    approvalId: "approval-3",
    createdAt: new Date(Date.now() - 16_000).toISOString(),
  },
  {
    id: "event-11",
    missionId: "mission-demo-1",
    type: "AGENT_PHASE_STARTED",
    label: "Skeptic Agent is paused in its timing replay phase",
    agentId: "skeptic-1",
    phaseId: "wait_for_payment",
    detail: "Waiting for payment approval to replay timing data",
    attempt: 1,
    createdAt: new Date(Date.now() - 16_000).toISOString(),
  },
];

export const demoMissionRecord: MissionRecord = {
  id: "mission-demo-1",
  input: demoMissionInput,
  status: "awaiting_spend_approval",
  elapsedLabel: "3m 08s",
  budget: {
    totalBudget: 2,
    maxPerCall: 0.6,
    humanApprovalAbove: 0,
    reserved: 0.08,
    spent: 0.54,
    remaining: 1.38,
  },
  registry: demoRegistry,
  agents: demoAgents,
  selectedAgentIds: selectionProposal.chosenAgentIds,
  selectionProposal,
  pendingSpendApprovals: demoSpendApprovals.filter((approval) => approval.status === "pending"),
  tasks: demoTasks,
  events: demoEvents,
  verificationChecks: demoVerificationChecks,
  verificationReport: {
    approved: false,
    score: 0.68,
    confidence: 0.72,
    passedChecks: demoVerificationChecks.filter((check) => check.status === "passed"),
    failedChecks: [],
    missingEvidence: ["skeptic timing replay", "final verifier proof"],
    proofHash: "proof_pending_0x47cc1a94",
    summary:
      "Verifier is waiting for the skeptic replay before approving settlement.",
  },
  receipts: demoReceipts,
  deliverables: {},
  humanCheckpoints: [],
  finalResult: {
    verdict: "too_sus",
    headline: "The move looks early, thin, and hard to trust without clearer public catalysts.",
    summary:
      "The news and market agents found a sharp move in a thin Trump-linked market, but the skeptic agent still needs its replay pass before the final verdict is locked.",
    confidence: 0.71,
    keyPoints: [
      "The current best setup still depends on a timing replay.",
      "Two payments have been approved and executed.",
      "One further payment is waiting on explicit human approval.",
    ],
  },
  proof: {
    missionId: "mission-demo-1",
    outputSummary:
      "Awaiting skeptic replay approval before locking the final trade recommendation.",
    artifactLinks: [
      "artifact://mission/news-dossier",
      "artifact://mission/market-scan",
    ],
    resultHash: "proof_0x47cc1a94",
    apiReceiptHashes: ["receipt-1", "receipt-2"],
    txHashes: ["5pQw...Rz1m", "2aQw...Qr8m", "7kLm...2Qa1"],
    completionConfidence: 0.71,
  },
  settlement: {
    state: "awaiting_spend_approval",
    settledAmount: 0,
    refundedAmount: 0,
    protocolFee: 0,
  },
  reputationDeltas: [],
  agentWork: [],
  trustProfiles: demoAgents.map((agent) => ({
    agentId: agent.id,
    globalTrustScore: agent.trustScore,
    categoryScores: {
      [agent.role]: agent.trustScore,
      "mission-fit": Math.min(99, agent.trustScore + 2),
    },
    completedMissions: agent.totalMissions,
    failedMissions: Math.max(0, Math.floor(agent.totalMissions * 0.03)),
    disputedMissions: Math.max(0, Math.floor(agent.totalMissions * 0.01)),
    verifierPassRate: Math.min(0.99, agent.trustScore / 100 + 0.04),
    humanOverrideRate: 0.08,
    spendDiscipline: Math.min(0.99, agent.trustScore / 100 + 0.03),
    latencyScore: 0.9,
    proofQualityScore: Math.min(0.99, agent.trustScore / 100 + 0.02),
    lastUpdated: "2026-05-05T00:00:00.000Z",
  })),
  chain: {
    programId: "Bifrost11111111111111111111111111111111111",
    missionPda: "mission_demo_1_pda",
    verificationPda: "verification_demo_1_pda",
    vaultAta: "vault_demo_1_ata",
    rpcProvider: "rpcfast-ready",
    rpcHttpUrl: "Configured at runtime",
    rpcWsUrl: "Configured at runtime",
    rpcStreamingEnabled: true,
  },
};

export const demoWalletAuditMissionInput: MissionInput = {
  title: "Wallet Hygiene Check",
  template: "wallet-audit-v1",
  description:
    "Audit the connected wallet for stale token approvals, suspicious recurring spends, and unsafe contracts before authorizing AI agents to act on its behalf.",
  objective:
    "Audit the connected wallet for stale token approvals, suspicious recurring spends, and unsafe contracts before authorizing AI agents to act on its behalf.",
  successCriteria:
    "A wallet hygiene report is produced listing stale approvals, suspicious recurring spends, and any unsafe contracts with explicit revocation guidance. All paid scans are explicitly approved by the wallet owner.",
  authorityWallet: "11111111111111111111111111111111",
  urgency: "high",
  executionMode: "guarded_autonomy",
  verificationMode: "hybrid",
  maxBudget: 5,
  maxPerCall: 1.5,
  humanApprovalAbove: 0,
  challengeWindowHours: 24,
};

const WALLET_AUDIT_BASE = new Date(Date.now() - 90_000).toISOString();
const t = (offsetMs: number) => new Date(new Date(WALLET_AUDIT_BASE).getTime() + offsetMs).toISOString();

export const demoAgentMessages: import("./types").AgentMessage[] = [
  {
    id: "msg-wa-1",
    missionId: "mission-wallet-audit-1",
    threadId: "mission-wallet-audit-1",
    fromAgentId: "wallet-intel-1",
    toAgentId: "skeptic-1",
    type: "evidence_request",
    content:
      "Identified 3 stale token approvals from 2024 that still grant unlimited spend to contracts 0xDEFI...a1b2, 0xSWAP...c3d4, and 0xBRIDGE...e5f6. All three were granted over 14 months ago and have not been revoked. Requesting skeptic challenge before we recommend revocation.",
    artifactRefs: [],
    status: "answered",
    createdAt: t(0),
  },
  {
    id: "msg-wa-2",
    missionId: "mission-wallet-audit-1",
    threadId: "mission-wallet-audit-1",
    fromAgentId: "skeptic-1",
    toAgentId: "wallet-intel-1",
    type: "challenge",
    content:
      "Are these approvals actually still active on-chain, or have they been silently revoked since your last index? Need fresh proof from the current block height — a stale index could flag already-revoked approvals as live.",
    artifactRefs: [],
    status: "answered",
    createdAt: t(12_000),
  },
  {
    id: "msg-wa-3",
    missionId: "mission-wallet-audit-1",
    threadId: "mission-wallet-audit-1",
    fromAgentId: "wallet-intel-1",
    toAgentId: "skeptic-1",
    type: "answer",
    content:
      "Confirmed live at block #289,441,002. All 3 approvals show allowance > 0 via on-chain RPC call made 47 seconds ago. Attached raw RPC response as artifact://wallet-audit/approval-proof. Skeptic concern addressed — these are not stale index entries.",
    artifactRefs: ["artifact://wallet-audit/approval-proof"],
    status: "resolved",
    createdAt: t(28_000),
  },
  {
    id: "msg-wa-4",
    missionId: "mission-wallet-audit-1",
    threadId: "mission-wallet-audit-1",
    fromAgentId: "execution-1",
    toAgentId: "verifier-1",
    type: "decision",
    content:
      "Proceeding to full wallet scan via wallet-scan.ai service. Scope: all ERC-20/SPL approval records, recurring spend patterns over 90 days, and contract risk scoring. Expected runtime: ~40 seconds. Payment request submitted for human approval.",
    artifactRefs: [],
    status: "open",
    createdAt: t(42_000),
  },
  {
    id: "msg-wa-5",
    missionId: "mission-wallet-audit-1",
    threadId: "mission-wallet-audit-1",
    fromAgentId: "verifier-1",
    toAgentId: "human",
    type: "decision",
    content:
      "Wallet hygiene audit complete. Found 3 high-risk unlimited approvals (recommended for immediate revocation), 2 recurring spend patterns flagged as anomalous, and 1 contract interaction with a recently-flagged protocol. All paid scans were explicitly approved. Verification passed — settlement ready.",
    artifactRefs: ["artifact://wallet-audit/hygiene-report", "artifact://wallet-audit/approval-proof"],
    status: "resolved",
    createdAt: t(75_000),
  },
];

export const demoAnalytics: AnalyticsOverview = {
  completionRate: "93.1%",
  averageDuration: "5m 12s",
  averageBudgetUsed: "1.18",
  verificationPassRate: "99.0%",
  totalValueSettled: "$2,840",
};

// ─── Fixture missions (history list seed) ──────────────────────────────────
// These power /missions list + clicking a row resolves the chat at /missions/<id>
// with a settled/failed/running synthetic record. Real missions created via
// createMission take precedence and use full reducer flow.

interface FixtureSpec {
  id: string;
  title: string;
  template: string;
  templateLabel: string;
  status: MissionStatus;
  agentIds: string[];
  spent: number;
  budget: number;
  durationLabel: string;
  startedIso: string;
  failureReason?: string;
}

const FIXTURE_SPECS: FixtureSpec[] = [
  {
    id: "msn-7a4f",
    title: "Q3 Outbound Launch — RecallReady AI",
    template: "launch-site-v1",
    templateLabel: "Launch Mission",
    status: "active",
    agentIds: ["launch-strategist-1", "cold-email-sdr-1", "lead-enrichment-1", "verifier-1"],
    spent: 4.82,
    budget: 12,
    durationLabel: "running…",
    startedIso: isoAgo(2 * 60_000),
  },
  {
    id: "msn-6b1c",
    title: "Lead Enrichment Sweep · ICP Cohort 12",
    template: "lead-enrichment-v1",
    templateLabel: "Sales Ops",
    status: "settled",
    agentIds: ["lead-enrichment-1", "verifier-1"],
    spent: 8.14,
    budget: 10,
    durationLabel: "27m 04s",
    startedIso: isoAgo(3 * 60 * 60_000),
  },
  {
    id: "msn-5a0d",
    title: "Vendor Invoice Batch Audit · 18 invoices",
    template: "invoice-audit-v1",
    templateLabel: "Finance Ops",
    status: "settled",
    agentIds: ["invoice-auditor-1", "expense-reviewer-1", "verifier-1"],
    spent: 14.92,
    budget: 20,
    durationLabel: "1h 12m",
    startedIso: isoAgo(6 * 60 * 60_000),
  },
  {
    id: "msn-4c2e",
    title: "API Docs Refresh · payments-service",
    template: "docs-refresh-v1",
    templateLabel: "Engineering",
    status: "settled",
    agentIds: ["docs-generator-1", "verifier-1"],
    spent: 2.30,
    budget: 4,
    durationLabel: "4h 22m",
    startedIso: isoAgo(24 * 60 * 60_000),
  },
  {
    id: "msn-3e9a",
    title: "PR Review Sprint · billing-service v2.4",
    template: "pr-review-v1",
    templateLabel: "Engineering",
    status: "failed",
    agentIds: ["pr-reviewer-1", "deploy-gatekeeper-1"],
    spent: 5.04,
    budget: 6,
    durationLabel: "52m 18s",
    startedIso: isoAgo(2 * 24 * 60 * 60_000),
    failureReason: "Reviewer signal-to-noise below 0.6 — operator rejected and rolled back.",
  },
  {
    id: "msn-2f8b",
    title: "SOC 2 Quarterly Evidence Sweep",
    template: "soc2-sweep-v1",
    templateLabel: "Compliance",
    status: "settled",
    agentIds: ["compliance-auditor-1", "contract-redliner-1", "verifier-1"],
    spent: 11.40,
    budget: 15,
    durationLabel: "1h 48m",
    startedIso: isoAgo(3 * 24 * 60 * 60_000),
  },
];

function buildFixtureMission(spec: FixtureSpec): MissionRecord {
  const agentStatus: AgentProfile["status"] =
    spec.status === "settled" ? "complete" : spec.status === "failed" ? "idle" : "working";
  const agents: AgentProfile[] = spec.agentIds
    .map((id) => demoRegistry.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined)
    .map((agent) => ({
      ...agent,
      status: agentStatus,
      currentPhase: undefined,
      capabilityClaim: agent.capabilities[0] ?? "general",
    }));
  const events: MissionEvent[] = [];
  let evtIdx = 0;
  const pushEvt = (payload: Omit<MissionEvent, "id" | "missionId" | "createdAt">) => {
    evtIdx += 1;
    events.push({
      ...(payload as MissionEvent),
      id: `${spec.id}-evt-${evtIdx}`,
      missionId: spec.id,
      createdAt: spec.startedIso,
    });
  };
  pushEvt({ type: "MISSION_CREATED", label: "Mission anchored", txSignature: `mission_create_${spec.id}` } as MissionEvent);
  pushEvt({
    type: "SELECTION_PROPOSED",
    label: `${spec.agentIds.length} agents matched`,
    proposalId: `prop-${spec.id}`,
    agentIds: spec.agentIds,
  } as MissionEvent);
  for (const agentId of spec.agentIds) {
    const role = demoRegistry.find((a) => a.id === agentId)?.role ?? "execution";
    pushEvt({ type: "AGENT_SELECTED", label: `Selected ${agentId}`, agentId, role } as MissionEvent);
  }
  if (spec.status === "settled") {
    pushEvt({
      type: "SELECTION_APPROVED",
      label: "Team launched",
      proposalId: `prop-${spec.id}`,
      agentIds: spec.agentIds,
    } as MissionEvent);
    pushEvt({
      type: "SETTLEMENT_RELEASED",
      label: "Settled",
      amount: spec.spent,
      txSignature: `mission_settle_${spec.id}`,
    } as MissionEvent);
  } else if (spec.status === "failed") {
    pushEvt({
      type: "MISSION_FAILED",
      label: "Mission failed",
      reason: spec.failureReason ?? "verifier rejected and operator chose not to rebuild",
    } as MissionEvent);
  } else {
    pushEvt({
      type: "AGENT_PHASE_STARTED",
      label: "First agent running",
      agentId: spec.agentIds[0]!,
      phaseId: "collect_context",
      attempt: 1,
    } as MissionEvent);
  }

  const input: MissionInput = {
    title: spec.title,
    template: spec.template,
    description: `${spec.templateLabel} · pre-seeded mission for the history list.`,
    objective: spec.title,
    successCriteria: "Demo fixture for the mission history view.",
    authorityWallet: "5QQtfoFuTFqGhUWoDh9RTqrn4V5joK9ExK4BZ4WuqH4r",
    urgency: "medium",
    executionMode: "guarded_autonomy",
    verificationMode: "hybrid",
    maxBudget: spec.budget,
    maxPerCall: 2,
    humanApprovalAbove: 1,
    challengeWindowHours: 24,
    templateConfig: { templateLabel: spec.templateLabel },
  };

  return {
    id: spec.id,
    input,
    status: spec.status,
    elapsedLabel: spec.durationLabel,
    budget: {
      totalBudget: spec.budget,
      maxPerCall: 2,
      humanApprovalAbove: 1,
      reserved: 0,
      spent: spec.spent,
      remaining: Math.max(0, spec.budget - spec.spent),
    },
    registry: demoRegistry,
    agents,
    selectedAgentIds: spec.agentIds,
    pendingSpendApprovals: [],
    tasks: [],
    events,
    verificationChecks: [],
    receipts: [],
    humanCheckpoints: [],
    agentWork: [],
    trustProfiles: agents.map((agent) => ({
      agentId: agent.id,
      globalTrustScore: agent.trustScore,
      categoryScores: { [agent.role]: agent.trustScore },
      completedMissions: agent.totalMissions,
      failedMissions: 0,
      disputedMissions: 0,
      verifierPassRate: 0.95,
      humanOverrideRate: 0.05,
      spendDiscipline: 0.95,
      latencyScore: 0.9,
      proofQualityScore: 0.92,
      lastUpdated: spec.startedIso,
    })),
    settlement: {
      state: spec.status,
      settledAmount: spec.status === "settled" ? spec.spent : 0,
      refundedAmount: spec.status === "settled" ? Math.max(0, spec.budget - spec.spent) : spec.budget - spec.spent,
      protocolFee: 0,
    },
    reputationDeltas: [],
    failureReason: spec.failureReason,
  };
}

export const demoFixtureMissions: MissionRecord[] = FIXTURE_SPECS.map(buildFixtureMission);
