export type MissionStatus =
  | "draft"
  | "selection_pending"
  | "created"
  | "active"
  | "awaiting_spend_approval"
  | "verifying"
  | "settled"
  | "failed"
  | "cancelled"
  | "paused";

export type ExecutionMode =
  | "manual_assist"
  | "guarded_autonomy"
  | "full_autonomy";

export type VerificationMode = "rules" | "agent" | "proof" | "human" | "hybrid";

export type MissionUrgency = "low" | "medium" | "high" | "critical";

export type AgentRole =
  | "coordinator"
  | "planner"
  | "news"
  | "market"
  | "skeptic"
  | "research"
  | "wallet_intelligence"
  | "risk"
  | "execution"
  | "verifier"
  | "compliance"
  | "custom";

export type TaskStatus =
  | "pending"
  | "active"
  | "complete"
  | "failed"
  | "waiting"
  | "blocked";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type AgentPhaseStatus = "pending" | "active" | "complete" | "failed";

export type RegistryApplicationStatus =
  | "submitted"
  | "protocol_check"
  | "sandbox_eval"
  | "certified"
  | "active"
  | "probation"
  | "suspended"
  | "rejected";

export type CapabilityCertificationStatus =
  | "uncertified"
  | "sandbox_passed"
  | "live_certified"
  | "needs_review"
  | "suspended"
  | "rejected";

export type EvaluationCheckStatus = "pending" | "running" | "passed" | "failed";

export interface BudgetPolicy {
  totalBudget: number;
  maxPerCall: number;
  humanApprovalAbove: number;
  reserved: number;
  spent: number;
  remaining: number;
}

export interface AgentSpendPolicy {
  role: AgentRole;
  budgetCap: number;
  spent: number;
  whitelistedServices: string[];
  maxPerCall: number;
  requiresHumanAbove: number;
}

export interface MissionTask {
  id: string;
  title: string;
  objective: string;
  assignedAgent: AgentRole;
  assignedAgentId?: string;
  dependencies: string[];
  budgetAllocation: number;
  approvedServices: string[];
  verificationExpectation: string;
  outputArtifactRef?: string;
  status: TaskStatus;
}

export interface MissionInput {
  title: string;
  template: string;
  description: string;
  objective: string;
  successCriteria: string;
  authorityWallet: string;
  urgency: MissionUrgency;
  executionMode: ExecutionMode;
  verificationMode: VerificationMode;
  maxBudget: number;
  maxPerCall: number;
  humanApprovalAbove: number;
  challengeWindowHours: number;
}

export interface AgentPhaseDefinition {
  id: string;
  label: string;
  description: string;
  streams: boolean;
  allowsParallel?: boolean;
}

export interface AgentPhaseRun {
  phaseId: string;
  status: AgentPhaseStatus;
  detail: string;
  attempt: number;
  startedAt: string;
  completedAt?: string;
}

export interface AgentCapabilityClaim {
  id: string;
  label: string;
  description: string;
  version: string;
  inputSchema: string;
  outputSchema: string;
  requiredTools: string[];
  allowedServices: string[];
  evaluationSuiteId: string;
}

export interface AgentManifest {
  agentId: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  ownerWallet: string;
  payoutWallet: string;
  verifierWallet: string;
  endpointUrl: string;
  role: AgentRole;
  executionMode: "builtin" | "callback";
  capabilities: AgentCapabilityClaim[];
  phaseSchema: AgentPhaseDefinition[];
  supportedServices: string[];
  spendPolicy: {
    maxPerCall: number;
    budgetCap: number;
    requiresHumanAbove: number;
  };
  priceModel: string;
  metadataUri?: string;
  privacyPolicyUri?: string;
  requestedEvaluationSuites: string[];
  signedAt: string;
}

export interface CertifiedCapability {
  capabilityId: string;
  label: string;
  version: string;
  inputSchemaHash: string;
  outputSchemaHash: string;
  evaluationSuiteId: string;
  latestScore: number;
  status: CapabilityCertificationStatus;
  latestReportId?: string;
  latestReportHash?: string;
  expiresAt?: string;
}

export interface EvaluationPhaseResult {
  phaseId: string;
  label: string;
  status: EvaluationCheckStatus;
  score: number;
  detail: string;
  evidenceRef?: string;
}

export interface DeterministicEvalResult {
  id: string;
  label: string;
  status: EvaluationCheckStatus;
  score: number;
  hardFail: boolean;
  detail: string;
}

export interface AiEvalResult {
  judgeId: string;
  label: string;
  verdict: "pass" | "fail" | "needs_review";
  score: number;
  confidence: number;
  summary: string;
  acceptedClaims: string[];
  rejectedClaims: string[];
  evidenceRefs: string[];
}

export interface EvaluationReport {
  id: string;
  agentId: string;
  applicationId: string;
  manifestHash: string;
  suiteId: string;
  runId: string;
  status: "running" | "passed" | "failed" | "needs_review";
  startedAt: string;
  completedAt?: string;
  phaseResults: EvaluationPhaseResult[];
  deterministicResults: DeterministicEvalResult[];
  aiResults: AiEvalResult[];
  claimsVerified: string[];
  claimsRejected: string[];
  overallScore: number;
  evaluatorWallet: string;
  reportHash: string;
  signature: string;
  anchorTxSignature?: string;
}

export interface RegistryApplication {
  id: string;
  status: RegistryApplicationStatus;
  submittedAt: string;
  updatedAt: string;
  ownerWallet: string;
  manifest: AgentManifest;
  manifestHash: string;
  protocolChecks: DeterministicEvalResult[];
  evaluationReports: EvaluationReport[];
  certifiedCapabilities: CertifiedCapability[];
  rejectedClaims: string[];
  anchorTxSignature?: string;
  agentRegistryPda?: string;
}

export interface RegistryAgent {
  id: string;
  slug: string;
  name: string;
  role: AgentRole;
  icon: string;
  description: string;
  trustScore: number;
  wallet: string;
  payoutWallet: string;
  verifierWallet: string;
  active: boolean;
  totalMissions: number;
  capabilities: string[];
  verifierCompatible: boolean;
  supportedServices: string[];
  executionMode: "builtin" | "callback";
  callbackUrl?: string;
  metadataUri?: string;
  priceModel?: string;
  phaseSchema: AgentPhaseDefinition[];
  registrationStatus?: RegistryApplicationStatus;
  certifiedCapabilities?: CertifiedCapability[];
  evaluationSummary?: {
    latestReportId: string;
    latestScore: number;
    deterministicPassed: number;
    aiJudges: number;
    claimsVerified: string[];
    claimsRejected: string[];
    updatedAt: string;
  };
}

export interface AgentProfile extends RegistryAgent {
  budgetCap?: number;
  costIncurred?: number;
  status?: "idle" | "working" | "complete" | "waiting";
  currentAction?: string;
  roleScores?: Partial<Record<AgentRole, number>>;
  selected?: boolean;
  currentPhaseId?: string;
  currentPhaseStatus?: AgentPhaseStatus;
  phaseHistory?: AgentPhaseRun[];
}

export interface SpendReceipt {
  receiptId: string;
  missionId: string;
  agentId: string;
  serviceWallet: string;
  amount: number;
  purpose: string;
  toolName: string;
  timestamp: string;
  txSignature: string;
}

export interface SpendApprovalRequest {
  id: string;
  missionId: string;
  agentId: string;
  status: ApprovalStatus;
  amount: number;
  service: string;
  purpose: string;
  justification: string;
  requestedAt: string;
  respondedAt?: string;
  requestRef?: string;
  txSignature?: string;
  rejectionReason?: string;
}

export interface AgentSelectionProposal {
  id: string;
  status: ApprovalStatus;
  recommendedAgentIds: string[];
  chosenAgentIds: string[];
  reason: string;
  createdAt: string;
  respondedAt?: string;
}

export interface VerificationCheck {
  id: string;
  label: string;
  status: "pending" | "running" | "passed" | "failed";
}

export interface MissionProof {
  missionId: string;
  outputSummary: string;
  artifactLinks: string[];
  resultHash: string;
  apiReceiptHashes: string[];
  txHashes: string[];
  completionConfidence: number;
}

export interface MissionResult {
  verdict: "good_trade" | "no_trade" | "too_late" | "too_sus";
  headline: string;
  summary: string;
  confidence: number;
  keyPoints: string[];
}

export interface ReputationDelta {
  agentId: string;
  before: number;
  after: number;
  delta: number;
  rationale: string;
}

export interface MissionEventBase {
  id: string;
  missionId: string;
  createdAt: string;
}

export type MissionEvent =
  | (MissionEventBase & {
      type: "MISSION_CREATED";
      label: string;
      txSignature?: string;
    })
  | (MissionEventBase & {
      type: "MISSION_FAILED";
      label: string;
      reason?: string;
    })
  | (MissionEventBase & {
      type: "SELECTION_PROPOSED" | "SELECTION_APPROVED" | "SELECTION_CHANGED";
      label: string;
      proposalId: string;
      agentIds: string[];
    })
  | (MissionEventBase & {
      type: "AGENT_SELECTED";
      label: string;
      agentId: string;
      role: AgentRole;
    })
  | (MissionEventBase & {
      type:
        | "AGENT_PHASE_STARTED"
        | "AGENT_PHASE_UPDATED"
        | "AGENT_PHASE_COMPLETED"
        | "AGENT_PHASE_FAILED";
      label: string;
      agentId: string;
      phaseId: string;
      detail?: string;
      attempt: number;
    })
  | (MissionEventBase & {
      type: "TASK_STARTED" | "TASK_COMPLETE";
      label: string;
      taskId: string;
      agentId: string;
      outputRef?: string;
    })
  | (MissionEventBase & {
      type:
        | "SPEND_REQUESTED"
        | "SPEND_APPROVED"
        | "SPEND_REJECTED"
        | "SPEND_APPROVAL_REQUIRED";
      label: string;
      agentId: string;
      amount?: number;
      service?: string;
      txSignature?: string;
      reason?: string;
      approvalId?: string;
    })
  | (MissionEventBase & {
      type: "VERIFICATION_RUNNING" | "VERIFICATION_APPROVED" | "VERIFICATION_REJECTED";
      label: string;
      proofHash?: string;
    })
  | (MissionEventBase & {
      type: "SETTLEMENT_RELEASED";
      label: string;
      amount: number;
      txSignature?: string;
    })
  | (MissionEventBase & {
      type: "REPUTATION_UPDATED";
      label: string;
      agentId: string;
      delta: number;
    });

export interface MissionChainState {
  programId?: string;
  missionPda?: string;
  verificationPda?: string;
  vaultAta?: string;
  rpcProvider?: string;
  rpcHttpUrl?: string;
  rpcWsUrl?: string;
  rpcStreamingEnabled?: boolean;
}

export interface MissionRecord {
  id: string;
  input: MissionInput;
  status: MissionStatus;
  elapsedLabel: string;
  budget: BudgetPolicy;
  registry: RegistryAgent[];
  agents: AgentProfile[];
  selectedAgentIds: string[];
  selectionProposal?: AgentSelectionProposal;
  pendingSpendApprovals: SpendApprovalRequest[];
  tasks: MissionTask[];
  events: MissionEvent[];
  verificationChecks: VerificationCheck[];
  receipts: SpendReceipt[];
  proof?: MissionProof;
  finalResult?: MissionResult;
  failureReason?: string;
  settlement: {
    state: MissionStatus;
    settledAmount: number;
    refundedAmount: number;
    protocolFee: number;
  };
  reputationDeltas: ReputationDelta[];
  chain?: MissionChainState;
}

export interface AnalyticsOverview {
  completionRate: string;
  averageDuration: string;
  averageBudgetUsed: string;
  verificationPassRate: string;
  totalValueSettled: string;
}
