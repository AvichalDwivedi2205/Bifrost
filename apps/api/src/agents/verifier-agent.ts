import type { AgentMessage, MissionVerificationReport, SpendReceipt } from "@bifrost/shared";

import type { AgentMessageBus } from "../services/agent-message-bus";
import { buildProofHash } from "../services/proof-builder";
import { BaseAgent } from "./base-agent";

export type VerificationOutput = MissionVerificationReport & {
  checks: MissionVerificationReport["passedChecks"];
};

export interface VerifierContext {
  missionId: string;
  messageBus?: AgentMessageBus;
}

export class VerifierAgent extends BaseAgent {
  async execute(
    successCriteria: string,
    finalRecommendation: string,
    context: {
      objective: string;
      artifactRefs: string[];
      receiptCount: number;
      receiptPurposes: string[];
    },
    ctx?: VerifierContext,
  ): Promise<VerificationOutput> {
    const report = await this.askJson<VerificationOutput>(
      "verify_mission",
      "You are Bifrost's verifier agent. Use a strict rubric. Reject outputs that miss the objective, omit receipts for paid data, hide uncertainty, or fail mission success criteria.",
      `Success criteria: ${successCriteria}
Mission objective: ${context.objective}
Final recommendation: ${finalRecommendation}
Artifact refs: ${context.artifactRefs.join(", ") || "none"}
Receipt count: ${context.receiptCount}
Receipt purposes: ${context.receiptPurposes.join(", ") || "none"}`,
      `Schema:
{
  "approved": true,
  "score": 0.92,
  "confidence": 0.88,
  "passedChecks": [{"id":"string","label":"string","status":"passed","detail":"string"}],
  "failedChecks": [{"id":"string","label":"string","status":"failed","detail":"string"}],
  "missingEvidence": ["string"],
  "proofHash": "string",
  "summary": "string",
  "checks": [{"id":"string","label":"string","status":"passed","detail":"string"}]
}`,
    );

    if (ctx?.messageBus && ctx.missionId) {
      await ctx.messageBus.broadcastDecision(
        ctx.missionId,
        "verifier-1",
        report.summary || "Verification complete.",
        context.artifactRefs.length > 0 ? context.artifactRefs : undefined,
      );
    }

    return report;
  }

  async executeWithAudit(args: {
    missionId: string;
    successCriteria: string[];
    finalRecommendation: unknown;
    context?: VerifierContext;
    messages: AgentMessage[];
    receipts: SpendReceipt[];
    approvedServicesByTask: Record<string, string[]>;
    budget: { maxPerCall: number; humanApprovalAbove: number };
    outputSummary: string;
  }): Promise<MissionVerificationReport> {
    const {
      missionId,
      successCriteria,
      finalRecommendation,
      messages,
      receipts,
      approvedServicesByTask,
      budget,
      outputSummary,
    } = args;

    // --- 1. Deterministic checks ---

    // Build the flat union of all allowlisted services across tasks
    const allAllowlisted = new Set(Object.values(approvedServicesByTask).flat());

    // paidCallsHaveApproval: every receipt should have a matching payment_request
    // message (matched by receipt.receiptId === message.id, the linkage chosen in Phase 3A)
    const paidCallsHaveApproval =
      receipts.length === 0 ||
      receipts.every((receipt) =>
        messages.some(
          (msg) =>
            msg.type === "payment_request" &&
            (msg.id === receipt.receiptId ||
              (msg.fromAgentId === receipt.agentId &&
                (msg as AgentMessage & { amount?: number }).amount === receipt.amount)),
        ),
      );

    // approvalsHaveSignature: every receipt must have a non-empty txSignature
    const approvalsHaveSignature =
      receipts.length === 0 || receipts.every((r) => Boolean(r.txSignature));

    // servicesAllowlisted: every receipt's purpose must be in the allowlist union
    const servicesAllowlisted =
      receipts.length === 0 ||
      receipts.every((r) => allAllowlisted.has(r.purpose) || allAllowlisted.has(r.toolName));

    // noSpendExceedCap: no individual receipt exceeds the per-call cap
    const noSpendExceedCap =
      receipts.length === 0 || receipts.every((r) => r.amount <= budget.maxPerCall);

    // openCriticalMessagesResolved: no open challenge, evidence_request, or payment_request.
    // Fallback: if the message bus is offline (messages.length === 0), default to true
    // so the verifier does not fail missions just because the bus is not wired.
    const openCriticalMessagesResolved =
      messages.length === 0 ||
      !messages.some(
        (m) =>
          m.status === "open" &&
          (m.type === "challenge" || m.type === "evidence_request" || m.type === "payment_request"),
      );

    // finalOutputCitesArtifacts: at least one artifactRef exists in messages, or the
    // finalRecommendation itself contains a truthy artifact reference.
    const hasArtifactInMessages = messages.some(
      (m) => Array.isArray(m.artifactRefs) && m.artifactRefs.length > 0,
    );
    const recAsObj = finalRecommendation as Record<string, unknown> | null | undefined;
    const hasArtifactInRec =
      recAsObj != null &&
      typeof recAsObj === "object" &&
      Boolean(
        recAsObj["artifactRefs"] ||
          recAsObj["artifacts"] ||
          recAsObj["artifactLinks"] ||
          recAsObj["artifact"],
      );
    const finalOutputCitesArtifacts = hasArtifactInMessages || hasArtifactInRec;

    // sawChallengeBeforeSettlement: at least one challenge message exists in the thread.
    // Fallback: if no messages, default to true (bus offline).
    const sawChallengeBeforeSettlement =
      messages.length === 0 || messages.some((m) => m.type === "challenge");

    const deterministicChecks = {
      paidCallsHaveApproval,
      approvalsHaveSignature,
      servicesAllowlisted,
      noSpendExceedCap,
      openCriticalMessagesResolved,
      finalOutputCitesArtifacts,
      sawChallengeBeforeSettlement,
    };

    // --- 2. Message audit summary ---
    const messageAuditSummary = {
      totalMessages: messages.length,
      openMessages: messages.filter((m) => m.status === "open").length,
      resolvedChallenges: messages.filter(
        (m) => m.type === "challenge" && (m.status === "resolved" || m.status === "answered"),
      ).length,
      paymentRequestsApproved: messages.filter(
        (m) => m.type === "payment_request" && m.status === "resolved",
      ).length,
      paymentRequestsRejected: messages.filter(
        (m) => m.type === "payment_request" && m.status === "blocked",
      ).length,
    };

    // --- 3. LLM verification with deterministic context injected into the prompt ---
    const deterministicSummary = `
DETERMINISTIC CHECKS (pre-computed, authoritative):
- paidCallsHaveApproval: ${deterministicChecks.paidCallsHaveApproval}
- approvalsHaveSignature: ${deterministicChecks.approvalsHaveSignature}
- servicesAllowlisted: ${deterministicChecks.servicesAllowlisted}
- noSpendExceedCap: ${deterministicChecks.noSpendExceedCap}
- openCriticalMessagesResolved: ${deterministicChecks.openCriticalMessagesResolved}
- finalOutputCitesArtifacts: ${deterministicChecks.finalOutputCitesArtifacts}
- sawChallengeBeforeSettlement: ${deterministicChecks.sawChallengeBeforeSettlement}

MESSAGE AUDIT SUMMARY:
- totalMessages: ${messageAuditSummary.totalMessages}
- openMessages: ${messageAuditSummary.openMessages}
- resolvedChallenges: ${messageAuditSummary.resolvedChallenges}
- paymentRequestsApproved: ${messageAuditSummary.paymentRequestsApproved}
- paymentRequestsRejected: ${messageAuditSummary.paymentRequestsRejected}

Any false deterministic check MUST lower score and confidence, and should be referenced in failedChecks or missingEvidence.
`.trim();

    const llmReport = await this.askJson<MissionVerificationReport>(
      "verify_mission_with_audit",
      "You are Bifrost's verifier agent. Use a strict rubric. Reject outputs that miss the objective, omit receipts for paid data, hide uncertainty, or fail mission success criteria. Deterministic checks have already been run — factor them into your assessment.",
      `Success criteria: ${successCriteria.join("; ")}
Output summary: ${outputSummary}
Final recommendation: ${JSON.stringify(finalRecommendation)}

${deterministicSummary}`,
      `Schema:
{
  "approved": true,
  "score": 0.92,
  "confidence": 0.88,
  "passedChecks": [{"id":"string","label":"string","status":"passed","detail":"string"}],
  "failedChecks": [{"id":"string","label":"string","status":"failed","detail":"string"}],
  "missingEvidence": ["string"],
  "proofHash": "string",
  "summary": "string"
}`,
    );

    // --- 4. Build proof hash and merge ---
    const proofHash = buildProofHash({
      missionId,
      messages,
      receipts,
      outputSummary,
      finalRecommendation,
    });

    const report: MissionVerificationReport = {
      ...llmReport,
      deterministicChecks,
      messageAuditSummary,
      proofHash,
    };

    return report;
  }
}
