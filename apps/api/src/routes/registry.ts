import type { FastifyInstance } from "fastify";
import {
  buildRegistryApplicationAuthorizationMessage,
  MISSION_AUTH_WINDOW_MS,
} from "@bifrost/shared";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { z } from "zod";

import { RegistryEvaluationRunner } from "../services/evaluation/registry-evaluation-runner";
import { AgentRegistryService } from "../services/registry";
import { RegistryApplicationStore } from "../services/registry-application-store";

const walletAddressSchema = z.string().refine((value) => {
  try {
    void new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid Solana wallet address");

const phaseSchema = z.object({
  id: z.string().min(2),
  label: z.string().min(2),
  description: z.string().min(3),
  streams: z.boolean(),
  allowsParallel: z.boolean().optional(),
});

const capabilitySchema = z.object({
  id: z.string().min(2),
  label: z.string().min(2),
  description: z.string().min(8),
  version: z.string().min(1),
  inputSchema: z.string().min(2),
  outputSchema: z.string().min(2),
  requiredTools: z.array(z.string()),
  allowedServices: z.array(z.string()),
  evaluationSuiteId: z.string().min(2),
});

const manifestSchema = z.object({
  agentId: z.string().min(3),
  slug: z.string().min(3),
  name: z.string().min(3),
  description: z.string().min(12),
  icon: z.string().min(1),
  ownerWallet: walletAddressSchema,
  payoutWallet: walletAddressSchema,
  verifierWallet: walletAddressSchema,
  endpointUrl: z.string().min(6),
  role: z.enum([
    "coordinator",
    "planner",
    "news",
    "market",
    "skeptic",
    "research",
    "wallet_intelligence",
    "risk",
    "execution",
    "verifier",
    "compliance",
    "custom",
  ]),
  executionMode: z.enum(["builtin", "callback"]),
  capabilities: z.array(capabilitySchema).min(1),
  phaseSchema: z.array(phaseSchema).min(1),
  supportedServices: z.array(z.string()),
  spendPolicy: z.object({
    maxPerCall: z.number().positive(),
    budgetCap: z.number().positive(),
    requiresHumanAbove: z.number().nonnegative(),
  }),
  priceModel: z.string().min(2),
  metadataUri: z.string().optional(),
  privacyPolicyUri: z.string().optional(),
  requestedEvaluationSuites: z.array(z.string()).min(1),
  signedAt: z.string().min(1),
});

const signedAuthSchema = z.object({
  issuedAt: z.string().min(1),
  signature: z.string().min(1),
});

const registryApplicationCreateSchema = z.object({
  manifest: manifestSchema,
  auth: signedAuthSchema,
});

export async function registerRegistryRoutes(
  app: FastifyInstance,
  registry: AgentRegistryService,
  applications: RegistryApplicationStore,
) {
  const evaluator = new RegistryEvaluationRunner();

  app.get("/api/registry", async () => ({
    agents: registry.list(),
  }));

  app.get("/api/registry/applications", async () => ({
    applications: applications.list(),
  }));

  app.post("/api/registry/applications", async (request, reply) => {
    const parsed = registryApplicationCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const authError = verifySignedAuthorization(
      parsed.data.manifest.ownerWallet,
      parsed.data.auth,
      buildRegistryApplicationAuthorizationMessage(
        parsed.data.manifest,
        parsed.data.auth.issuedAt,
      ),
    );
    if (authError) {
      return reply.code(401).send({ error: authError });
    }

    try {
      const application = applications.create(parsed.data.manifest);
      return reply.code(201).send({ application });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create registry application";
      return reply.code(409).send({ error: message });
    }
  });

  app.get("/api/registry/applications/:applicationId", async (request, reply) => {
    const params = request.params as { applicationId: string };
    const application = applications.get(params.applicationId);
    if (!application) {
      return reply.code(404).send({ error: "Registry application not found" });
    }
    return { application };
  });

  app.post(
    "/api/registry/applications/:applicationId/protocol-check",
    async (request, reply) => {
      const params = request.params as { applicationId: string };
      try {
        const application = applications.runProtocolCheck(params.applicationId);
        return { application };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to run protocol check";
        return reply.code(404).send({ error: message });
      }
    },
  );

  app.post("/api/registry/applications/:applicationId/evaluations", async (request, reply) => {
    const params = request.params as { applicationId: string };
    try {
      const started = applications.startEvaluation(params.applicationId);
      const result = await evaluator.run(started);
      const application = applications.completeEvaluation(
        params.applicationId,
        result.report,
        result.certifiedCapabilities,
        result.anchor,
      );
      return { application, report: result.report };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to run evaluation";
      const statusCode = message.includes("not found") ? 404 : 400;
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/api/registry/agents/:agentId/evaluations", async (request, reply) => {
    const params = request.params as { agentId: string };
    const application = applications
      .list()
      .find((item) => item.manifest.agentId === params.agentId);
    if (!application) {
      return reply.code(404).send({ error: "Registry agent not found" });
    }
    return { reports: application.evaluationReports };
  });

  app.get("/api/registry/capabilities", async () => ({
    capabilities: registry
      .list()
      .flatMap((agent) => agent.certifiedCapabilities ?? [])
      .sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

function verifySignedAuthorization(
  authorityWallet: string,
  auth: { issuedAt: string; signature: string },
  message: string,
): string | null {
  const issuedAt = new Date(auth.issuedAt);
  if (Number.isNaN(issuedAt.getTime())) {
    return "Registry authorization timestamp is invalid";
  }

  if (Math.abs(Date.now() - issuedAt.getTime()) > MISSION_AUTH_WINDOW_MS) {
    return "Registry authorization has expired";
  }

  const signatureBytes = Buffer.from(auth.signature, "base64");
  if (signatureBytes.length !== nacl.sign.signatureLength) {
    return "Registry authorization signature is invalid";
  }

  let publicKey: PublicKey;
  try {
    publicKey = new PublicKey(authorityWallet);
  } catch {
    return "Registry owner wallet is invalid";
  }

  try {
    const verified = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      signatureBytes,
      publicKey.toBytes(),
    );
    return verified ? null : "Registry authorization signature is invalid";
  } catch {
    return "Registry authorization signature is invalid";
  }
}
