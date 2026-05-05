import { createHash } from "node:crypto";

import type {
  AgentManifest,
  CertifiedCapability,
  DeterministicEvalResult,
  EvaluationReport,
  RegistryAgent,
  RegistryApplication,
} from "@bifrost/shared";
import type { ConvexHttpClient } from "convex/browser";
import { nanoid } from "nanoid";

import { getConvexClient } from "./convex-client";

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
  const endpointIsDryRunnable =
    manifest.endpointUrl.startsWith("mock://") || manifest.endpointUrl.startsWith("https://");
  const hasCapabilities = manifest.capabilities.length > 0;
  const identityLooksStable =
    /^[a-z0-9][a-z0-9-_]{2,48}$/.test(manifest.agentId) &&
    /^[a-z0-9][a-z0-9-]{2,64}$/.test(manifest.slug);
  const walletSeparation =
    manifest.ownerWallet !== manifest.payoutWallet ||
    manifest.executionMode === "builtin";
  const hasPhasePlan =
    manifest.phaseSchema.length >= 2 &&
    manifest.phaseSchema.every((phase) => phase.id && phase.label && phase.description);
  const schemasAreJson = manifest.capabilities.every(
    (capability) =>
      capability.inputSchema.trim().startsWith("{") &&
      capability.outputSchema.trim().startsWith("{"),
  );
  const serviceWhitelistValid = manifest.capabilities.every((capability) =>
    capability.allowedServices.every((service) => manifest.supportedServices.includes(service)),
  );
  const verifierClaimValid =
    manifest.role !== "verifier" ||
    manifest.capabilities.some((capability) =>
      capability.id.toLowerCase().includes("verify") ||
      capability.label.toLowerCase().includes("verif"),
    );
  const spendPolicyValid =
    manifest.spendPolicy.maxPerCall > 0 &&
    manifest.spendPolicy.budgetCap >= manifest.spendPolicy.maxPerCall &&
    manifest.spendPolicy.requiresHumanAbove >= 0 &&
    manifest.spendPolicy.requiresHumanAbove <= manifest.spendPolicy.budgetCap;

  return [
    {
      id: "identity-stability",
      label: "Identity stability",
      status: identityLooksStable ? "passed" : "failed",
      score: identityLooksStable ? 1 : 0,
      hardFail: true,
      detail: identityLooksStable
        ? "Agent id and slug are stable protocol-safe identifiers."
        : "Agent id and slug must be lowercase protocol-safe identifiers.",
    },
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
      id: "callback-dry-run",
      label: "Callback dry run",
      status: endpointIsDryRunnable ? "passed" : "failed",
      score: endpointIsDryRunnable ? 1 : 0.45,
      hardFail: manifest.executionMode === "callback",
      detail: endpointIsDryRunnable
        ? "Runtime endpoint can be dry-run in the demo sandbox."
        : "Callback agents must expose mock:// or https:// runtime endpoints for sandbox execution.",
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
      id: "capability-schemas",
      label: "Capability schema shape",
      status: schemasAreJson ? "passed" : "failed",
      score: schemasAreJson ? 1 : 0,
      hardFail: true,
      detail: schemasAreJson
        ? "Capability input and output schemas are JSON-shaped."
        : "Every capability must declare JSON-shaped input and output schemas.",
    },
    {
      id: "service-whitelist",
      label: "Declared service whitelist",
      status: serviceWhitelistValid ? "passed" : "failed",
      score: serviceWhitelistValid ? 1 : 0.35,
      hardFail: true,
      detail: serviceWhitelistValid
        ? "Capability service claims are covered by the manifest service whitelist."
        : "Capability allowed services must be included in supportedServices.",
    },
    {
      id: "budget-policy",
      label: "Budget policy sanity",
      status: spendPolicyValid ? "passed" : "failed",
      score: spendPolicyValid ? 1 : 0,
      hardFail: true,
      detail: spendPolicyValid
        ? "Spend caps are internally consistent."
        : "Budget cap must cover max per call and human threshold must fit inside the budget cap.",
    },
    {
      id: "wallet-separation",
      label: "Wallet separation",
      status: walletSeparation ? "passed" : "failed",
      score: walletSeparation ? 1 : 0.65,
      hardFail: false,
      detail: walletSeparation
        ? "Owner and payout wallets are separated, or builtin mode keeps custody internal."
        : "Callback agents should separate owner and payout wallets for cleaner accounting.",
    },
    {
      id: "phase-schema",
      label: "Phase schema completeness",
      status: hasPhasePlan ? "passed" : "failed",
      score: hasPhasePlan ? 1 : 0,
      hardFail: true,
      detail: hasPhasePlan
        ? "Phase schema exposes enough runtime steps for live monitoring."
        : "Agents must declare at least two complete phases.",
    },
    {
      id: "verifier-compatibility",
      label: "Verifier compatibility",
      status: verifierClaimValid ? "passed" : "failed",
      score: verifierClaimValid ? 1 : 0,
      hardFail: manifest.role === "verifier",
      detail: verifierClaimValid
        ? "Verifier role claims include a verification capability."
        : "Verifier agents must declare a verification capability.",
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

// ---------------------------------------------------------------------------
// ConvexRegistryApplicationStore — same synchronous public interface as
// RegistryApplicationStore, backed by Convex (write-through cache pattern).
// ---------------------------------------------------------------------------

export class ConvexRegistryApplicationStore {
  private readonly convex: ConvexHttpClient;
  private readonly applications = new Map<string, RegistryApplication>();
  private warmingPromise: Promise<void> | null = null;

  constructor(convexClient?: ConvexHttpClient) {
    this.convex = convexClient ?? getConvexClient();
    this.warmingPromise = this.warmCache();
  }

  private async warmCache(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docs = await (this.convex as any).query("registryApplications:list", {}) as any[];
      for (const doc of docs) {
        const app = doc.application as RegistryApplication;
        this.applications.set(app.id, app);
      }
    } catch {
      // Convex unavailable — proceed with empty cache.
    }
  }

  private persist(application: RegistryApplication): void {
    const now = new Date().toISOString();
    const a = application as unknown as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.convex as any)
      .mutation("registryApplications:create", {
        applicationId: application.id,
        application,
        status: application.status,
        createdAt: a.createdAt as string | undefined ?? now,
        updatedAt: now,
      })
      .catch(() => {/* cache remains authoritative */});
  }

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
    this.persist(application);
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

  /** Expose warming promise for callers that want to await full hydration. */
  ready(): Promise<void> {
    return this.warmingPromise ?? Promise.resolve();
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
    this.persist(application);
    return structuredClone(application);
  }
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
    trustProfile: {
      agentId: manifest.agentId,
      globalTrustScore: Math.round(latestScore * 100),
      categoryScores: Object.fromEntries(
        application.certifiedCapabilities.map((capability) => [
          capability.capabilityId,
          Math.round((capability.latestScore ?? latestScore) * 100),
        ]),
      ),
      completedMissions: 0,
      failedMissions: 0,
      disputedMissions: 0,
      verifierPassRate: Number(Math.min(0.99, latestScore + 0.05).toFixed(2)),
      humanOverrideRate: 0.06,
      spendDiscipline: Number(Math.min(0.99, latestScore + 0.04).toFixed(2)),
      latencyScore: Number(Math.min(0.99, latestScore + 0.02).toFixed(2)),
      proofQualityScore: Number(Math.min(0.99, latestScore + 0.03).toFixed(2)),
      lastUpdated: application.updatedAt,
      latestProofHash: latestReport?.reportHash,
      latestReputationTx: application.anchorTxSignature,
    },
  };
}
