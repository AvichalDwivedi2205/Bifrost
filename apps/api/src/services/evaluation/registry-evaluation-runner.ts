import type {
  AiEvalResult,
  CertifiedCapability,
  DeterministicEvalResult,
  EvaluationReport,
  RegistryApplication,
} from "@bifrost/shared";
import { nanoid } from "nanoid";

import { LLMRouter } from "../../providers/llm/router";
import { hashJson } from "../registry-application-store";
import { BifrostSolanaClient } from "../solana/bifrost-client";

export class RegistryEvaluationRunner {
  private readonly solana = new BifrostSolanaClient();
  private readonly llm = new LLMRouter();

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
    const aiResults = await runAiJudges(this.llm, application);
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

    const isAnchorable = status === "passed" || status === "needs_review";
    const certifiedCapabilities = isAnchorable
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
            status: status === "passed" ? "sandbox_passed" : "needs_review",
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
      isAnchorable
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

interface JudgeOutput {
  verdict: "pass" | "fail" | "needs_review";
  score: number;
  confidence: number;
  summary: string;
  acceptedClaims: string[];
  rejectedClaims: string[];
  reasoning: string;
}

async function runAiJudges(llm: LLMRouter, application: RegistryApplication): Promise<AiEvalResult[]> {
  const manifest = application.manifest;
  const claimIds = manifest.capabilities.map((c) => c.id);
  const manifestSummary = JSON.stringify(
    {
      agentId: manifest.agentId,
      role: manifest.role,
      executionMode: manifest.executionMode,
      description: manifest.description,
      capabilities: manifest.capabilities.map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description,
        version: c.version,
        inputSchema: c.inputSchema.slice(0, 280),
        outputSchema: c.outputSchema.slice(0, 280),
        requiredTools: c.requiredTools,
        allowedServices: c.allowedServices,
      })),
      supportedServices: manifest.supportedServices,
      spendPolicy: manifest.spendPolicy,
      phaseSchema: manifest.phaseSchema.map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
      })),
    },
    null,
    2,
  );

  const schemaHint = `Schema:
{
  "verdict": "pass" | "fail" | "needs_review",
  "score": 0.0,                 // 0..1
  "confidence": 0.0,            // 0..1
  "summary": "string (1-2 sentences, plain text, judge's overall finding)",
  "acceptedClaims": ["capabilityId"],
  "rejectedClaims": ["capabilityId"],
  "reasoning": "string (concrete reasoning quoting fields from the manifest)"
}`;

  const judges: Array<{
    judgeId: string;
    label: string;
    system: string;
    prompt: string;
    fallback: () => JudgeOutput;
  }> = [
    {
      judgeId: "strict-correctness",
      label: "Strict correctness judge",
      system:
        "You are a strict registry-correctness judge for an autonomous-agent platform. Reject capabilities whose schemas are too generic, descriptions too thin, role/capability mismatched, or whose declared services don't fit the role. Reasoning must quote specific manifest fields.",
      prompt: `Evaluate this agent registry application. List capability ids in acceptedClaims and rejectedClaims separately.\n\nMANIFEST:\n${manifestSummary}`,
      fallback: () => buildHeuristicJudge(application, "strict"),
    },
    {
      judgeId: "adversarial-skeptic",
      label: "Adversarial skeptic judge",
      system:
        "You are an adversarial skeptic judge. Hunt for overclaiming, missing safety constraints, unsafe service requests, vague spend policy, schema gaps, and role drift. Default to 'needs_review' if any concern is plausible. Reasoning must quote fields you found suspect.",
      prompt: `Attack this manifest. What would a malicious or careless agent slip past? Place suspect capability ids in rejectedClaims.\n\nMANIFEST:\n${manifestSummary}`,
      fallback: () => buildHeuristicJudge(application, "skeptic"),
    },
  ];

  const results = await Promise.all(
    judges.map(async ({ judgeId, label, system, prompt, fallback }) => {
      let output: JudgeOutput;
      try {
        output = await llm.generateObject<JudgeOutput>({
          task: `registry_judge_${judgeId}`,
          system,
          prompt,
          schemaHint,
          temperature: 0.1,
        });
        // Sanitize claim ids — accept only ids actually in the manifest.
        const validIds = new Set(claimIds);
        output.acceptedClaims = (output.acceptedClaims ?? []).filter((id) => validIds.has(id));
        output.rejectedClaims = (output.rejectedClaims ?? []).filter((id) => validIds.has(id));
        output.score = clamp01(Number(output.score) || 0);
        output.confidence = clamp01(Number(output.confidence) || 0);
      } catch (err) {
        console.warn(
          `[registry-judge:${judgeId}] LLM call failed, falling back to heuristic: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        output = fallback();
      }
      const result: AiEvalResult = {
        judgeId,
        label,
        verdict: output.verdict,
        score: output.score,
        confidence: output.confidence,
        summary: output.summary,
        acceptedClaims: output.acceptedClaims,
        rejectedClaims: output.rejectedClaims,
        evidenceRefs: [`artifact://${application.id}/${judgeId}`],
        reasoningTrace: output.reasoning,
      };
      return result;
    }),
  );

  return results;
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, Number(v.toFixed(2))));
}

/** Heuristic fallback used only when the LLM call fails (offline / bad JSON / rate-limit). */
function buildHeuristicJudge(application: RegistryApplication, mode: "strict" | "skeptic"): JudgeOutput {
  const manifest = application.manifest;
  const claimIds = manifest.capabilities.map((c) => c.id);
  const rubricFailures = manifest.capabilities
    .filter((capability) => {
      const text = `${capability.id} ${capability.label} ${capability.description}`.toLowerCase();
      const role = manifest.role.replace("_", " ");
      const roleAligned =
        manifest.role === "custom" ||
        text.includes(manifest.role) ||
        text.includes(role) ||
        capability.requiredTools.length > 0 ||
        capability.allowedServices.length > 0;
      const outputLooksSpecific =
        capability.outputSchema.includes("{") &&
        /summary|verdict|score|artifact|proof|risk|confidence|sources/i.test(
          capability.outputSchema,
        );
      return !roleAligned || !outputLooksSpecific;
    })
    .map((capability) => capability.id);
  const weakClaims = manifest.capabilities
    .filter(
      (capability) =>
        capability.description.length < 24 ||
        capability.id.toLowerCase().includes("fake") ||
        capability.id.toLowerCase().includes("unsafe") ||
        rubricFailures.includes(capability.id),
    )
    .map((capability) => capability.id);
  const needsReview =
    mode === "skeptic"
      ? weakClaims.length > 0
      : manifest.description.length < 32 || manifest.capabilities.length > 5 || weakClaims.length > 0;
  return {
    verdict: needsReview ? "needs_review" : "pass",
    score: needsReview ? (mode === "strict" ? 0.68 : 0.66) : mode === "strict" ? 0.88 : 0.86,
    confidence: needsReview ? 0.62 : 0.82,
    summary: needsReview
      ? mode === "strict"
        ? "Claims need human review because at least one description, schema, or role mapping is too thin or risky."
        : "One or more claims looked overbroad, unsafe, under-specified, or poorly matched to the declared role."
      : mode === "strict"
        ? "Claims are specific enough and role-aligned for sandbox certification."
        : "No obvious overclaiming found in manifest, schemas, or phase plan.",
    acceptedClaims: claimIds.filter((id) => !weakClaims.includes(id)),
    rejectedClaims: weakClaims,
    reasoning:
      "[heuristic-fallback] LLM unavailable; used deterministic rubric on description length, role alignment, and schema specificity.",
  };
}
