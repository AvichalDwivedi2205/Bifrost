import type { AgentRole, MissionTask } from "./types";

export const LAUNCH_SITE_TEMPLATE = "launch-site-v1";
export const WALLET_AUDIT_TEMPLATE = "wallet-audit-v1";

export interface MissionBlueprintAgentRule {
  agentId: string;
  role: AgentRole;
  name: string;
  capabilityTags: string[];
  budgetCap: number;
}

export interface MissionBlueprintTaskRule {
  id: string;
  title: string;
  objective: string;
  assignedAgentId: string;
  assignedAgent: AgentRole;
  dependencies: string[];
  budgetAllocation: number;
  approvedServices: string[];
  verificationExpectation: string;
  checkpointKind?: "positioning" | "domain" | "ship";
  spendRequired?: boolean;
}

export interface MissionBlueprint {
  id: string;
  label: string;
  lineup: MissionBlueprintAgentRule[];
  allowedTools: string[];
  tasks: MissionBlueprintTaskRule[];
  checkpointMoments: string[];
  deliverables: string[];
  verificationRules: string[];
}

export const launchSiteBlueprint: MissionBlueprint = {
  id: LAUNCH_SITE_TEMPLATE,
  label: "Launch Mission v1",
  lineup: [
    {
      agentId: "launch-strategist-1",
      role: "planner",
      name: "Strategist",
      capabilityTags: ["positioning", "launch-plan", "decision-framing"],
      budgetCap: 0,
    },
    {
      agentId: "competitor-map-1",
      role: "research",
      name: "Competitor Scout",
      capabilityTags: ["competitor-research", "messaging-patterns"],
      budgetCap: 0.25,
    },
    {
      agentId: "launch-copywriter-1",
      role: "custom",
      name: "Copywriter",
      capabilityTags: ["landing-copy", "social-copy", "faq"],
      budgetCap: 0,
    },
    {
      agentId: "launch-builder-1",
      role: "execution",
      name: "Builder",
      capabilityTags: ["site-generation", "waitlist-form", "artifact-packaging"],
      budgetCap: 0,
    },
    {
      agentId: "launch-deployer-1",
      role: "execution",
      name: "Deployer",
      capabilityTags: ["preview-deploy", "live-deploy", "domain-search"],
      budgetCap: 1.5,
    },
    {
      agentId: "verifier-1",
      role: "verifier",
      name: "Verifier",
      capabilityTags: ["preview-verification", "receipt-audit", "settlement"],
      budgetCap: 0,
    },
  ],
  allowedTools: [
    "web-research",
    "site-copy-synthesis",
    "site-generator",
    "preview-deploy",
    "live-deploy",
    "waitlist-form",
    "social-post-generator",
    "domain-search",
  ],
  tasks: [
    {
      id: "task-plan",
      title: "Review the proposed launch team",
      objective: "Bifrost proposes a launch-specific agent team and waits for human approval.",
      assignedAgentId: "launch-strategist-1",
      assignedAgent: "planner",
      dependencies: [],
      budgetAllocation: 0,
      approvedServices: [],
      verificationExpectation: "Human approval recorded for launch team",
    },
    {
      id: "task-research",
      title: "Map competitors and messaging",
      objective: "Find competitor patterns, screenshots, and claims for the dental AI SDR market.",
      assignedAgentId: "competitor-map-1",
      assignedAgent: "research",
      dependencies: ["task-plan"],
      budgetAllocation: 0,
      approvedServices: ["web-search", "browser-snapshot.local"],
      verificationExpectation: "Research dossier with competitor messaging patterns",
    },
    {
      id: "task-positioning",
      title: "Create three positioning directions",
      objective: "Turn research into three launch angles the human can choose from.",
      assignedAgentId: "launch-strategist-1",
      assignedAgent: "planner",
      dependencies: ["task-research"],
      budgetAllocation: 0,
      approvedServices: [],
      verificationExpectation: "Three clear positioning options",
    },
    {
      id: "task-human-direction",
      title: "Pick positioning direction",
      objective: "Human chooses one positioning direction before copy and build proceed.",
      assignedAgentId: "launch-strategist-1",
      assignedAgent: "planner",
      dependencies: ["task-positioning"],
      budgetAllocation: 0,
      approvedServices: [],
      verificationExpectation: "Signed human answer is recorded",
      checkpointKind: "positioning",
    },
    {
      id: "task-copy",
      title: "Draft page copy",
      objective: "Write hero, sections, CTA, FAQ, and waitlist copy from selected positioning.",
      assignedAgentId: "launch-copywriter-1",
      assignedAgent: "custom",
      dependencies: ["task-human-direction"],
      budgetAllocation: 0,
      approvedServices: [],
      verificationExpectation: "Landing page copy matches selected positioning",
    },
    {
      id: "task-build",
      title: "Generate landing page files",
      objective: "Generate a responsive landing page with waitlist hook and file manifest.",
      assignedAgentId: "launch-builder-1",
      assignedAgent: "execution",
      dependencies: ["task-copy"],
      budgetAllocation: 0,
      approvedServices: [],
      verificationExpectation: "HTML, CSS, metadata, and waitlist endpoint are present",
    },
    {
      id: "task-preview",
      title: "Deploy preview",
      objective: "Create a preview URL and capture preview artifacts.",
      assignedAgentId: "launch-deployer-1",
      assignedAgent: "execution",
      dependencies: ["task-build"],
      budgetAllocation: 0.75,
      approvedServices: ["preview-deploy.local"],
      verificationExpectation: "Preview URL exists and spend approval is recorded",
      spendRequired: true,
    },
    {
      id: "task-verify-preview",
      title: "Verify preview",
      objective: "Check page load, links, mobile layout, CTA, and waitlist submission.",
      assignedAgentId: "verifier-1",
      assignedAgent: "verifier",
      dependencies: ["task-preview"],
      budgetAllocation: 0,
      approvedServices: [],
      verificationExpectation: "Preview verification checklist passes",
    },
    {
      id: "task-domain",
      title: "Confirm domain candidate",
      objective: "Search domain options and ask human before any purchase decision.",
      assignedAgentId: "launch-deployer-1",
      assignedAgent: "execution",
      dependencies: ["task-verify-preview"],
      budgetAllocation: 0,
      approvedServices: ["domain-search.local"],
      verificationExpectation: "Domain options and signed human decision are recorded",
      checkpointKind: "domain",
    },
    {
      id: "task-deploy-live",
      title: "Deploy live",
      objective: "Promote the preview into a live deployment URL.",
      assignedAgentId: "launch-deployer-1",
      assignedAgent: "execution",
      dependencies: ["task-domain"],
      budgetAllocation: 0,
      approvedServices: ["live-deploy.local"],
      verificationExpectation: "Live URL and deploy receipt exist",
    },
    {
      id: "task-launch-assets",
      title: "Generate launch posts",
      objective: "Generate three launch posts for selected channels.",
      assignedAgentId: "launch-copywriter-1",
      assignedAgent: "custom",
      dependencies: ["task-deploy-live"],
      budgetAllocation: 0,
      approvedServices: [],
      verificationExpectation: "Three social posts are generated",
    },
    {
      id: "task-verify",
      title: "Verify proof and settle",
      objective: "Verify deliverables, approvals, and mission brief before settlement.",
      assignedAgentId: "verifier-1",
      assignedAgent: "verifier",
      dependencies: ["task-launch-assets"],
      budgetAllocation: 0,
      approvedServices: [],
      verificationExpectation: "Proof hash and settlement receipt",
    },
  ],
  checkpointMoments: [
    "choose-positioning",
    "confirm-domain-candidate",
    "approve-paid-preview-deploy",
  ],
  deliverables: [
    "previewUrl",
    "liveUrl",
    "waitlistEndpoint",
    "socialPosts",
    "fileManifest",
    "screenshots",
  ],
  verificationRules: [
    "page exists",
    "required sections exist",
    "CTA exists",
    "form works",
    "links not broken",
    "mobile screenshot captured",
    "chosen positioning matches final copy",
    "all paid actions approved",
    "final deliverables match mission brief",
  ],
};

export const missionBlueprints: Record<string, MissionBlueprint> = {
  [launchSiteBlueprint.id]: launchSiteBlueprint,
};

export function getMissionBlueprint(template: string): MissionBlueprint | undefined {
  return missionBlueprints[template];
}

export function tasksFromBlueprint(
  blueprint: MissionBlueprint,
  approved: boolean,
): MissionTask[] {
  return blueprint.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    objective: task.objective,
    assignedAgent: task.assignedAgent,
    assignedAgentId: task.assignedAgentId,
    dependencies: task.dependencies,
    budgetAllocation: task.budgetAllocation,
    approvedServices: task.approvedServices,
    verificationExpectation: task.verificationExpectation,
    status:
      task.id === "task-plan"
        ? approved
          ? "complete"
          : "waiting"
        : approved && task.dependencies.length === 1 && task.dependencies[0] === "task-plan"
          ? "pending"
          : "waiting",
  }));
}
