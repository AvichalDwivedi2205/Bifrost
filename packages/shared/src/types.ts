export type MissionStatus =
  | "draft"
  | "selection_pending"
  | "created"
  | "active"
  | "awaiting_human_input"
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

export interface LaunchMissionConfig {
  productName: string;
  oneLineIdea: string;
  targetAudience: string;
  primaryCTA: string;
  brandTone: string;
  mustHaveSections: string[];
  domainBudgetCap: number;
  allowDomainPurchase: boolean;
  launchChannels: string[];
  referenceSites: string[];
  assetsProvided: string[];
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
  templateConfig?: Record<string, unknown>;
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
  trustProfile?: AgentTrustProfile;
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

export interface PolicyCheckResult {
  underMaxPerCall: boolean;
  serviceAllowlisted: boolean;
  humanApprovalRequired: boolean;
  missionBudgetRemaining: number;
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
  detail?: string;
}

export interface MissionVerificationReport {
  approved: boolean;
  score: number;
  confidence: number;
  passedChecks: VerificationCheck[];
  failedChecks: VerificationCheck[];
  missingEvidence: string[];
  proofHash: string;
  summary: string;
  /** Alias for passedChecks; populated by the LLM path in execute() and used by mission-runner for verificationChecks storage. */
  checks?: VerificationCheck[];
  deterministicChecks?: {
    paidCallsHaveApproval: boolean;
    approvalsHaveSignature: boolean;
    servicesAllowlisted: boolean;
    noSpendExceedCap: boolean;
    openCriticalMessagesResolved: boolean;
    finalOutputCitesArtifacts: boolean;
    sawChallengeBeforeSettlement: boolean;
  };
  messageAuditSummary?: {
    totalMessages: number;
    openMessages: number;
    resolvedChallenges: number;
    paymentRequestsApproved: number;
    paymentRequestsRejected: number;
  };
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

export interface MissionFileManifestEntry {
  path: string;
  hash: string;
  bytes: number;
  kind: "html" | "css" | "json" | "markdown" | "image" | "text";
}

export interface MissionDeliverables {
  previewUrl?: string;
  liveUrl?: string;
  waitlistEndpoint?: string;
  socialPosts?: string[];
  fileManifest?: MissionFileManifestEntry[];
  screenshots?: string[];
  deployReceipt?: {
    provider: string;
    deploymentId: string;
    url: string;
    createdAt: string;
  };
  domainOptions?: Array<{
    domain: string;
    priceUsd: number;
    available: boolean;
  }>;
  selectedDomain?: string;
  formTestResult?: {
    passed: boolean;
    detail: string;
    submittedAt: string;
  };
}

export type HumanCheckpointKind =
  | "question"
  | "clarification"
  | "decision"
  | "payment_request"
  | "ship_confirmation";

export type HumanCheckpointStatus = "open" | "answered" | "cancelled";

export interface HumanCheckpoint {
  id: string;
  missionId: string;
  kind: HumanCheckpointKind;
  title: string;
  prompt: string;
  options: string[];
  freeformAllowed: boolean;
  requestedByAgentId: string;
  blockingTaskId: string;
  status: HumanCheckpointStatus;
  response?: string;
  requestedAt: string;
  respondedAt?: string;
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
  category?: string;
  proofHash?: string;
  txSignature?: string;
}

export interface AgentTrustProfile {
  agentId: string;
  globalTrustScore: number;
  categoryScores: Record<string, number>;
  completedMissions: number;
  failedMissions: number;
  disputedMissions: number;
  verifierPassRate: number;
  humanOverrideRate: number;
  spendDiscipline: number;
  latencyScore: number;
  proofQualityScore: number;
  lastUpdated: string;
  latestProofHash?: string;
  latestReputationTx?: string;
}

export type AgentWorkEvidenceKind =
  | "thought"
  | "tool_call"
  | "artifact"
  | "verification"
  | "handoff"
  | "onchain";

export interface AgentWorkEvidence {
  id: string;
  missionId: string;
  agentId: string;
  taskId?: string;
  phaseId?: string;
  kind: AgentWorkEvidenceKind;
  title: string;
  detail: string;
  toolName?: string;
  inputSummary?: string;
  outputSummary?: string;
  artifactRefs: string[];
  receiptRefs: string[];
  txSignature?: string;
  proofHash?: string;
  confidence?: number;
  status: "running" | "complete" | "failed";
  startedAt: string;
  completedAt?: string;
}

export type AgentMessageType =
  | "question"
  | "answer"
  | "challenge"
  | "evidence_request"
  | "clarification"
  | "decision"
  | "payment_request";

export type AgentMessageStatus = "open" | "answered" | "resolved" | "blocked";

export interface AgentMessage {
  id: string;
  missionId: string;
  threadId: string;
  fromAgentId: string;
  toAgentId: string;
  type: AgentMessageType;
  content: string;
  artifactRefs: string[];
  status: AgentMessageStatus;
  createdAt: string;
}

export interface PaymentRequestMessage extends AgentMessage {
  type: "payment_request";
  amount: number;
  service: string;
  toolName: string;
  payoutWallet: string;
  justification: string;
  policyChecks: PolicyCheckResult;
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
      type:
        | "HUMAN_CHECKPOINT_REQUESTED"
        | "HUMAN_CHECKPOINT_ANSWERED"
        | "DELIVERABLE_CREATED";
      label: string;
      checkpointId?: string;
      taskId?: string;
      agentId?: string;
      outputRef?: string;
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
    })
  | (MissionEventBase & {
      type: "AGENT_MESSAGE_SENT";
      label: string;
      missionId: string;
      messageId: string;
      fromAgentId: string;
      toAgentId: string;
      messageType: AgentMessageType;
      preview: string;
      createdAt: string;
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
  verificationReport?: MissionVerificationReport;
  receipts: SpendReceipt[];
  proof?: MissionProof;
  finalResult?: MissionResult;
  deliverables?: MissionDeliverables;
  humanCheckpoints: HumanCheckpoint[];
  agentWork: AgentWorkEvidence[];
  trustProfiles: AgentTrustProfile[];
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
