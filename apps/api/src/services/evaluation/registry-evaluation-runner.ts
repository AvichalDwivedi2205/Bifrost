import type {
  CertifiedCapability,
  DeterministicEvalResult,
  EvaluationReport,
  RegistryApplication,
} from "@bifrost/shared";
import { nanoid } from "nanoid";

import { hashJson } from "../registry-application-store";
import { BifrostSolanaClient } from "../solana/bifrost-client";

export class RegistryEvaluationRunner {
  private readonly solana = new BifrostSolanaClient();

  async run(application: RegistryApplication): Promise<{
    report: EvaluationReport;
    certifiedCapabilities: CertifiedCapability[];
    anchor: { txSignature?: string; agentRegistryPda?: string };
  }> {
    const now = new Date().toISOString();
    const deterministicResults = buildDeterministicResults(application);
    const hardFailed = deterministicResults.some(
      (result) => result.hardFail && result.status === "failed",
    );
    const aiResults = buildAiResults(application);
    const aiNeedsReview = aiResults.some((result) => result.verdict === "needs_review");
    const claimsRejected = [
      ...new Set(aiResults.flatMap((result) => result.rejectedClaims)),
    ];
    const claimsVerified = hardFailed
      ? []
      : application.manifest.capabilities
          .map((capability) => capability.id)
          .filter((claim) => !claimsRejected.includes(claim));
    const deterministicScore =
      deterministicResults.reduce((total, result) => total + result.score, 0) /
      deterministicResults.length;
    const aiScore =
      aiResults.reduce((total, result) => total + result.score, 0) / aiResults.length;
    const overallScore = hardFailed
      ? Math.min(0.49, deterministicScore)
      : Number((deterministicScore * 0.45 + aiScore * 0.55).toFixed(2));
    const status: EvaluationReport["status"] = hardFailed
      ? "failed"
      : aiNeedsReview
        ? "needs_review"
        : overallScore >= 0.74
          ? "passed"
          : "failed";

    const certifiedCapabilities =
      status === "passed"
        ? application.manifest.capabilities
            .filter((capability) => claimsVerified.includes(capability.id))
            .map<CertifiedCapability>((capability) => ({
              capabilityId: capability.id,
              label: capability.label,
              version: capability.version,
              inputSchemaHash: hashJson(capability.inputSchema),
              outputSchemaHash: hashJson(capability.outputSchema),
              evaluationSuiteId: capability.evaluationSuiteId,
              latestScore: overallScore,
              status: "sandbox_passed",
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }))
        : [];

    const reportBase = {
      id: `eval_${nanoid(10)}`,
      agentId: application.manifest.agentId,
      applicationId: application.id,
      manifestHash: application.manifestHash,
      suiteId: application.manifest.requestedEvaluationSuites[0] ?? "generic-capability-v1",
      runId: `run_${nanoid(8)}`,
      status,
      startedAt: now,
      completedAt: new Date().toISOString(),
      phaseResults: application.manifest.phaseSchema.map((phase, index) => ({
        phaseId: phase.id,
        label: phase.label,
        status: hardFailed ? ("failed" as const) : ("passed" as const),
        score: hardFailed ? 0.45 : Number((0.86 - index * 0.02).toFixed(2)),
        detail: hardFailed
          ? "Phase blocked by hard deterministic failure."
          : `Mock sandbox completed ${phase.label}.`,
        evidenceRef: `artifact://${application.id}/${phase.id}`,
      })),
      deterministicResults,
      aiResults,
      claimsVerified,
      claimsRejected,
      overallScore,
      evaluatorWallet: application.manifest.verifierWallet,
    };
    const reportHash = hashJson(reportBase);
    const report: EvaluationReport = {
      ...reportBase,
      reportHash,
      signature: `mock_sig_${reportHash.slice(0, 16)}`,
    };

    const anchor: { txSignature?: string; agentRegistryPda?: string } =
      status === "passed"
        ? await this.solana.anchorAgentRegistry(application.manifest, {
            capabilityHash: hashJson(certifiedCapabilities),
            metadataHash: application.manifestHash,
            privacyPolicyHash: hashJson(application.manifest.privacyPolicyUri ?? ""),
          })
        : {};

    return {
      report: anchor.txSignature ? { ...report, anchorTxSignature: anchor.txSignature } : report,
      certifiedCapabilities: certifiedCapabilities.map((capability) => ({
        ...capability,
        latestReportId: report.id,
        latestReportHash: report.reportHash,
      })),
      anchor,
    };
  }
}

function buildDeterministicResults(application: RegistryApplication): DeterministicEvalResult[] {
  const protocolChecks = application.protocolChecks.length
    ? application.protocolChecks
    : [
        {
          id: "protocol-check-missing",
          label: "Protocol check completed",
          status: "failed" as const,
          score: 0,
          hardFail: true,
          detail: "Protocol check must run before sandbox evaluation.",
        },
      ];
  const schemaChecks = application.manifest.capabilities.map<DeterministicEvalResult>(
    (capability) => {
      const schemaValid =
        capability.inputSchema.trim().startsWith("{") &&
        capability.outputSchema.trim().startsWith("{");
      return {
        id: `schema-${capability.id}`,
        label: `${capability.label} schema`,
        status: schemaValid ? "passed" : "failed",
        score: schemaValid ? 1 : 0,
        hardFail: true,
        detail: schemaValid
          ? "Input and output schemas are JSON-shaped."
          : "Capability schemas must be JSON-shaped strings.",
      };
    },
  );

  return [...protocolChecks, ...schemaChecks];
}

function buildAiResults(application: RegistryApplication) {
  const manifest = application.manifest;
  const claimIds = manifest.capabilities.map((capability) => capability.id);
  const weakClaims = manifest.capabilities
    .filter(
      (capability) =>
        capability.description.length < 24 ||
        capability.id.toLowerCase().includes("fake") ||
        capability.id.toLowerCase().includes("unsafe"),
    )
    .map((capability) => capability.id);
  const needsReview =
    manifest.description.length < 32 || manifest.capabilities.length > 5 || weakClaims.length > 0;

  return [
    {
      judgeId: "strict-correctness",
      label: "Strict correctness judge",
      verdict: needsReview ? ("needs_review" as const) : ("pass" as const),
      score: needsReview ? 0.68 : 0.88,
      confidence: needsReview ? 0.62 : 0.82,
      summary: needsReview
        ? "Claims need human review because at least one description is too thin or risky."
        : "Claims are specific enough for sandbox certification.",
      acceptedClaims: claimIds.filter((claim) => !weakClaims.includes(claim)),
      rejectedClaims: weakClaims,
      evidenceRefs: [`artifact://${application.id}/strict-correctness`],
    },
    {
      judgeId: "adversarial-skeptic",
      label: "Adversarial skeptic judge",
      verdict: weakClaims.length > 0 ? ("needs_review" as const) : ("pass" as const),
      score: weakClaims.length > 0 ? 0.66 : 0.86,
      confidence: weakClaims.length > 0 ? 0.64 : 0.8,
      summary:
        weakClaims.length > 0
          ? "One or more claims looked overbroad, unsafe, or under-specified."
          : "No obvious overclaiming found in manifest or phase plan.",
      acceptedClaims: claimIds.filter((claim) => !weakClaims.includes(claim)),
      rejectedClaims: weakClaims,
      evidenceRefs: [`artifact://${application.id}/adversarial-skeptic`],
    },
  ];
}
