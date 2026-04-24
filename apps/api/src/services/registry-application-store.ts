import { createHash } from "node:crypto";

import type {
  AgentManifest,
  CertifiedCapability,
  DeterministicEvalResult,
  EvaluationReport,
  RegistryAgent,
  RegistryApplication,
} from "@bifrost/shared";
import { nanoid } from "nanoid";

export class RegistryApplicationStore {
  private readonly applications = new Map<string, RegistryApplication>();

  create(manifest: AgentManifest): RegistryApplication {
    const duplicate = [...this.applications.values()].find(
      (application) => application.manifest.agentId === manifest.agentId,
    );
    if (duplicate) {
      throw new Error("Agent application already exists");
    }

    const now = new Date().toISOString();
    const manifestHash = hashJson(manifest);
    const application: RegistryApplication = {
      id: `app_${nanoid(10)}`,
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
      ownerWallet: manifest.ownerWallet,
      manifest,
      manifestHash,
      protocolChecks: [],
      evaluationReports: [],
      certifiedCapabilities: [],
      rejectedClaims: [],
    };

    this.applications.set(application.id, application);
    return structuredClone(application);
  }

  list(): RegistryApplication[] {
    return [...this.applications.values()].map((application) => structuredClone(application));
  }

  get(id: string): RegistryApplication | undefined {
    const application = this.applications.get(id);
    return application ? structuredClone(application) : undefined;
  }

  runProtocolCheck(id: string): RegistryApplication {
    return this.update(id, (application) => {
      const checks = buildProtocolChecks(application.manifest);
      const hasHardFailure = checks.some((check) => check.hardFail && check.status === "failed");
      application.protocolChecks = checks;
      application.status = hasHardFailure ? "rejected" : "protocol_check";
    });
  }

  startEvaluation(id: string): RegistryApplication {
    return this.update(id, (application) => {
      if (application.status === "submitted") {
        application.protocolChecks = buildProtocolChecks(application.manifest);
      }
      const hasHardFailure = application.protocolChecks.some(
        (check) => check.hardFail && check.status === "failed",
      );
      application.status = hasHardFailure ? "rejected" : "sandbox_eval";
    });
  }

  completeEvaluation(
    id: string,
    report: EvaluationReport,
    certifiedCapabilities: CertifiedCapability[],
    anchor?: { txSignature?: string; agentRegistryPda?: string },
  ): RegistryApplication {
    return this.update(id, (application) => {
      application.evaluationReports = [...application.evaluationReports, report];
      application.certifiedCapabilities = certifiedCapabilities;
      application.rejectedClaims = report.claimsRejected;
      application.anchorTxSignature = anchor?.txSignature;
      application.agentRegistryPda = anchor?.agentRegistryPda;
      application.status =
        report.status === "passed" && certifiedCapabilities.length > 0
          ? "active"
          : report.status === "needs_review"
            ? "probation"
            : "rejected";
    });
  }

  listCertifiedAgents(): RegistryAgent[] {
    return [...this.applications.values()]
      .filter(
        (application) =>
          ["certified", "active", "probation"].includes(application.status) &&
          application.certifiedCapabilities.length > 0,
      )
      .map((application) => applicationToRegistryAgent(application));
  }

  private update(
    id: string,
    apply: (application: RegistryApplication) => void,
  ): RegistryApplication {
    const application = this.applications.get(id);
    if (!application) {
      throw new Error("Registry application not found");
    }

    apply(application);
    application.updatedAt = new Date().toISOString();
    this.applications.set(id, application);
    return structuredClone(application);
  }
}

export function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildProtocolChecks(manifest: AgentManifest): DeterministicEvalResult[] {
  const endpointLooksValid =
    manifest.endpointUrl.startsWith("mock://") ||
    manifest.endpointUrl.startsWith("https://") ||
    manifest.endpointUrl.startsWith("http://");
  const hasCapabilities = manifest.capabilities.length > 0;
  const spendPolicyValid =
    manifest.spendPolicy.maxPerCall > 0 &&
    manifest.spendPolicy.budgetCap >= manifest.spendPolicy.maxPerCall &&
    manifest.spendPolicy.requiresHumanAbove >= 0;

  return [
    {
      id: "endpoint-discovery",
      label: "Runtime endpoint discovery",
      status: endpointLooksValid ? "passed" : "failed",
      score: endpointLooksValid ? 1 : 0,
      hardFail: true,
      detail: endpointLooksValid
        ? "Endpoint uses a supported scheme for mocked protocol discovery."
        : "Endpoint must be mock://, http://, or https://.",
    },
    {
      id: "capability-claims",
      label: "Capability claims present",
      status: hasCapabilities ? "passed" : "failed",
      score: hasCapabilities ? 1 : 0,
      hardFail: true,
      detail: hasCapabilities
        ? "Manifest includes at least one capability claim."
        : "Manifest must claim at least one capability.",
    },
    {
      id: "budget-policy",
      label: "Budget policy sanity",
      status: spendPolicyValid ? "passed" : "failed",
      score: spendPolicyValid ? 1 : 0,
      hardFail: true,
      detail: spendPolicyValid
        ? "Spend caps are internally consistent."
        : "Budget cap must cover max per call and thresholds must be non-negative.",
    },
    {
      id: "receipt-contract",
      label: "Receipt contract",
      status: "passed",
      score: 1,
      hardFail: true,
      detail: "Mocked receipt contract accepts quote-to-receipt consistency checks.",
    },
  ];
}

function applicationToRegistryAgent(application: RegistryApplication): RegistryAgent {
  const latestReport = application.evaluationReports.at(-1);
  const latestScore = latestReport?.overallScore ?? 0.75;
  const verifiedLabels = application.certifiedCapabilities.map((capability) => capability.label);
  const manifest = application.manifest;

  return {
    id: manifest.agentId,
    slug: manifest.slug,
    name: manifest.name,
    role: manifest.role,
    icon: manifest.icon,
    description: manifest.description,
    trustScore: Math.round(latestScore * 100),
    wallet: manifest.ownerWallet,
    payoutWallet: manifest.payoutWallet,
    verifierWallet: manifest.verifierWallet,
    active: application.status === "active" || application.status === "certified",
    totalMissions: 0,
    capabilities: verifiedLabels,
    verifierCompatible: manifest.role === "verifier",
    supportedServices: manifest.supportedServices,
    executionMode: manifest.executionMode,
    callbackUrl: manifest.endpointUrl,
    metadataUri: manifest.metadataUri,
    priceModel: manifest.priceModel,
    phaseSchema: manifest.phaseSchema,
    registrationStatus: application.status,
    certifiedCapabilities: application.certifiedCapabilities,
    evaluationSummary: latestReport
      ? {
          latestReportId: latestReport.id,
          latestScore,
          deterministicPassed: latestReport.deterministicResults.filter(
            (result) => result.status === "passed",
          ).length,
          aiJudges: latestReport.aiResults.length,
          claimsVerified: latestReport.claimsVerified,
          claimsRejected: latestReport.claimsRejected,
          updatedAt: application.updatedAt,
        }
      : undefined,
  };
}
