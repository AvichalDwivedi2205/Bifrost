import type { FastifyInstance } from "fastify";
import {
  buildMissionAuthorizationMessage,
  buildSelectionAuthorizationMessage,
  buildSpendApprovalAuthorizationMessage,
  MISSION_AUTH_WINDOW_MS,
} from "@missionmesh/shared";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { z } from "zod";

import type { MissionRunner } from "../services/mission-runner";
import type { MissionStore } from "../services/store";

const walletAddressSchema = z.string().refine((value) => {
  try {
    void new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid Solana wallet address");

const missionInputSchema = z
  .object({
    title: z.string().min(3),
    template: z.string().min(2),
    description: z.string().min(3),
    objective: z.string().min(10),
    successCriteria: z.string().min(3),
    authorityWallet: walletAddressSchema,
    urgency: z.enum(["low", "medium", "high", "critical"]),
    executionMode: z.enum(["manual_assist", "guarded_autonomy", "full_autonomy"]),
    verificationMode: z.enum(["rules", "agent", "proof", "human", "hybrid"]),
    maxBudget: z.number().positive(),
    maxPerCall: z.number().positive(),
    humanApprovalAbove: z.number().nonnegative(),
    challengeWindowHours: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (value.maxPerCall > value.maxBudget) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Max per call cannot exceed the total budget",
        path: ["maxPerCall"],
      });
    }

    if (value.humanApprovalAbove > value.maxBudget) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Human approval threshold cannot exceed the total budget",
        path: ["humanApprovalAbove"],
      });
    }
  });

const signedAuthSchema = z.object({
  issuedAt: z.string().min(1),
  signature: z.string().min(1),
});

const missionCreateRequestSchema = z.object({
  mission: missionInputSchema,
  auth: signedAuthSchema,
});

const selectionApprovalSchema = z.object({
  chosenAgentIds: z.array(z.string()).optional(),
  auth: signedAuthSchema,
});

const spendApprovalSchema = z.object({
  approve: z.boolean(),
  auth: signedAuthSchema,
});

export async function registerMissionRoutes(
  app: FastifyInstance,
  store: MissionStore,
  runner: MissionRunner,
) {
  app.get("/health", async () => ({
    ok: true,
    service: "missionmesh-api",
    missions: store.list().length,
    runtime: runner.getRuntimeStatus(),
  }));

  app.get("/api/demo/dashboard", async () => ({
    missions: store.list(),
  }));

  app.get("/api/registry", async () => ({
    agents: runner.getRegistry(),
  }));

  app.get("/api/missions", async () => ({
    missions: store.list(),
  }));

  app.get("/api/missions/:missionId", async (request, reply) => {
    const params = request.params as { missionId: string };
    const mission = store.get(params.missionId);
    if (!mission) {
      return reply.code(404).send({ error: "Mission not found" });
    }
    return { mission };
  });

  app.post("/api/missions", async (request, reply) => {
    const parsed = missionCreateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const message = buildMissionAuthorizationMessage(
      parsed.data.mission,
      parsed.data.auth.issuedAt,
    );
    const authError = verifySignedAuthorization(
      parsed.data.mission.authorityWallet,
      parsed.data.auth,
      message,
    );
    if (authError) {
      return reply.code(401).send({ error: authError });
    }

    const mission = await runner.createMission(parsed.data.mission);
    return reply.code(201).send({ mission });
  });

  app.post("/api/missions/:missionId/selection", async (request, reply) => {
    const params = request.params as { missionId: string };
    const parsed = selectionApprovalSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const existingMission = store.get(params.missionId);
    if (!existingMission) {
      return reply.code(404).send({ error: "Mission not found" });
    }

    const chosenAgentIds =
      parsed.data.chosenAgentIds && parsed.data.chosenAgentIds.length > 0
        ? parsed.data.chosenAgentIds
        : existingMission.selectionProposal?.recommendedAgentIds ?? [];
    const authError = verifySignedAuthorization(
      existingMission.input.authorityWallet,
      parsed.data.auth,
      buildSelectionAuthorizationMessage(
        params.missionId,
        existingMission.input.authorityWallet,
        chosenAgentIds,
        parsed.data.auth.issuedAt,
      ),
    );
    if (authError) {
      return reply.code(401).send({ error: authError });
    }

    try {
      const mission = await runner.approveAgentSelection(
        params.missionId,
        chosenAgentIds,
      );
      return { mission };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to approve agent selection";
      const statusCode = message.includes("not found") ? 404 : 400;
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post(
    "/api/missions/:missionId/spend-approvals/:approvalId",
    async (request, reply) => {
      const params = request.params as { missionId: string; approvalId: string };
      const parsed = spendApprovalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const existingMission = store.get(params.missionId);
      if (!existingMission) {
        return reply.code(404).send({ error: "Mission not found" });
      }

      const authError = verifySignedAuthorization(
        existingMission.input.authorityWallet,
        parsed.data.auth,
        buildSpendApprovalAuthorizationMessage(
          params.missionId,
          existingMission.input.authorityWallet,
          params.approvalId,
          parsed.data.approve,
          parsed.data.auth.issuedAt,
        ),
      );
      if (authError) {
        return reply.code(401).send({ error: authError });
      }

      try {
        const mission = await runner.resolveSpendApproval(
          params.missionId,
          params.approvalId,
          parsed.data.approve,
        );
        return { mission };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to resolve spend approval";
        const statusCode = message.includes("not found") ? 404 : 400;
        return reply.code(statusCode).send({ error: message });
      }
    },
  );
}

function verifySignedAuthorization(
  authorityWallet: string,
  auth: { issuedAt: string; signature: string },
  message: string,
): string | null {
  const issuedAt = new Date(auth.issuedAt);
  if (Number.isNaN(issuedAt.getTime())) {
    return "Invalid authorization timestamp";
  }

  if (Math.abs(Date.now() - issuedAt.getTime()) > MISSION_AUTH_WINDOW_MS) {
    return "Mission authorization has expired";
  }

  const signatureBytes = Buffer.from(auth.signature, "base64");
  if (signatureBytes.length !== nacl.sign.signatureLength) {
    return "Mission authorization signature is invalid";
  }

  let publicKey: PublicKey;
  try {
    publicKey = new PublicKey(authorityWallet);
  } catch {
    return "Mission authority wallet is invalid";
  }

  try {
    const verified = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      signatureBytes,
      publicKey.toBytes(),
    );
    return verified ? null : "Mission authorization signature is invalid";
  } catch {
    return "Mission authorization signature is invalid";
  }
}
