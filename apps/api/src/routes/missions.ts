import type { FastifyInstance } from "fastify";
import {
  buildAgentMessageResolveAuthorizationMessage,
  buildHumanCheckpointAuthorizationMessage,
  buildMissionAuthorizationMessage,
  buildSelectionAuthorizationMessage,
  buildSpendApprovalAuthorizationMessage,
  MISSION_AUTH_WINDOW_MS,
} from "@bifrost/shared";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { z } from "zod";

import type { AgentMessageBus } from "../services/agent-message-bus";
import type { MissionRunner } from "../services/mission-runner";
import type { MissionStore } from "../services/store";
import { MissionWorkspace } from "../services/workspace/mission-workspace";

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
    templateConfig: z.record(z.string(), z.unknown()).optional(),
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
  txSignature: z.string().optional(),
});

const checkpointAnswerSchema = z.object({
  response: z.string().min(1),
  auth: signedAuthSchema,
});

const messageResolveSchema = z.object({
  auth: signedAuthSchema,
  content: z.string().min(1),
});

export async function registerMissionRoutes(
  app: FastifyInstance,
  store: MissionStore,
  runner: MissionRunner,
  messageBus?: AgentMessageBus,
) {
  app.get("/health", async () => ({
    ok: true,
    service: "bifrost-api",
    missions: store.list().length,
    runtime: runner.getRuntimeStatus(),
  }));

  app.get("/api/demo/dashboard", async () => ({
    missions: store.list(),
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

  app.get("/api/missions/:missionId/artifacts", async (request, reply) => {
    const params = request.params as { missionId: string };
    const artifacts = runner.getArtifacts(params.missionId);
    if (!artifacts) {
      return reply.code(404).send({ error: "Artifacts not found" });
    }
    return { artifacts };
  });

  app.get("/api/missions/:missionId/preview", async (request, reply) => {
    const params = request.params as { missionId: string };
    if (!store.get(params.missionId)) {
      return reply.code(404).send({ error: "Mission not found" });
    }
    try {
      const workspace = new MissionWorkspace(params.missionId);
      const html = await workspace.readText("site/index.html");
      return reply.type("text/html").send(html);
    } catch {
      return reply.code(404).send({ error: "Preview not generated yet" });
    }
  });

  app.get("/api/missions/:missionId/live", async (request, reply) => {
    const params = request.params as { missionId: string };
    const mission = store.get(params.missionId);
    if (!mission) {
      return reply.code(404).send({ error: "Mission not found" });
    }
    if (!mission.deliverables?.liveUrl) {
      return reply.code(404).send({ error: "Live deploy not generated yet" });
    }
    try {
      const workspace = new MissionWorkspace(params.missionId);
      const html = await workspace.readText("site/index.html");
      return reply.type("text/html").send(html);
    } catch {
      return reply.code(404).send({ error: "Live artifact not found" });
    }
  });

  app.get("/api/missions/:missionId/asset/:fileName", async (request, reply) => {
    const params = request.params as { missionId: string; fileName: string };
    if (!store.get(params.missionId)) {
      return reply.code(404).send({ error: "Mission not found" });
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(params.fileName)) {
      return reply.code(400).send({ error: "Invalid asset name" });
    }
    try {
      const workspace = new MissionWorkspace(params.missionId);
      const asset = await workspace.readText(`site/${params.fileName}`);
      const contentType = params.fileName.endsWith(".css")
        ? "text/css"
        : params.fileName.endsWith(".json")
          ? "application/json"
          : "text/plain";
      return reply.type(contentType).send(asset);
    } catch {
      return reply.code(404).send({ error: "Asset not found" });
    }
  });

  app.get("/api/missions/:missionId/waitlist", async (request, reply) => {
    const params = request.params as { missionId: string };
    const query = request.query as { email?: string };
    if (!store.get(params.missionId)) {
      return reply.code(404).send({ error: "Mission not found" });
    }
    const email = query.email?.trim();
    if (email) {
      const workspace = new MissionWorkspace(params.missionId);
      await workspace.writeText(
        `waitlist/${Date.now()}.json`,
        JSON.stringify({ email, createdAt: new Date().toISOString() }, null, 2),
      );
    }
    return reply.type("text/html").send(`
      <!doctype html>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <body style="font-family: system-ui; background:#06110f; color:#effcf7; display:grid; min-height:100vh; place-items:center;">
        <main style="max-width:520px; padding:24px;">
          <h1>Waitlist received</h1>
          <p>${email ? "You are on the launch list." : "Email missing. Return to the launch page and try again."}</p>
          <a style="color:#58f2bd" href="/api/missions/${params.missionId}/live">Back to site</a>
        </main>
      </body>
    `);
  });

  app.get("/api/missions/:missionId/verification", async (request, reply) => {
    const params = request.params as { missionId: string };
    let report = null;

    // Try Convex first if enabled
    if (process.env.USE_CONVEX) {
      try {
        const convex = await import("../services/convex-client").then((m) =>
          m.getConvexClient(),
        );
        const result = await convex.query(
          "verificationReports:getByMissionId" as any,
          { missionId: params.missionId },
        );
        if (result) {
          report = result.report;
        }
      } catch (err) {
        // Silently fall through to in-memory store
      }
    }

    // Fall back to store
    if (!report) {
      const mission = store.get(params.missionId);
      if (mission?.verificationReport) {
        report = mission.verificationReport;
      }
    }

    if (!report) {
      return reply.code(404).send({ error: "Verification report not found" });
    }

    return { report };
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

  app.get("/api/missions/:missionId/messages", async (request, reply) => {
    const params = request.params as { missionId: string };
    const bus = messageBus ?? runner.messageBus;
    const messages = bus.getThread(params.missionId);
    return { messages };
  });

  app.post(
    "/api/missions/:missionId/checkpoints/:checkpointId",
    async (request, reply) => {
      const params = request.params as { missionId: string; checkpointId: string };
      const parsed = checkpointAnswerSchema.safeParse(request.body);
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
        buildHumanCheckpointAuthorizationMessage(
          params.missionId,
          existingMission.input.authorityWallet,
          params.checkpointId,
          parsed.data.response,
          parsed.data.auth.issuedAt,
        ),
      );
      if (authError) {
        return reply.code(401).send({ error: authError });
      }

      try {
        const mission = await runner.answerHumanCheckpoint(
          params.missionId,
          params.checkpointId,
          parsed.data.response,
        );
        return { mission };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to answer checkpoint";
        const statusCode = message.includes("not found") ? 404 : 400;
        return reply.code(statusCode).send({ error: message });
      }
    },
  );

  app.post(
    "/api/missions/:missionId/messages/:messageId/resolve",
    async (request, reply) => {
      const params = request.params as { missionId: string; messageId: string };
      const parsed = messageResolveSchema.safeParse(request.body);
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
        buildAgentMessageResolveAuthorizationMessage(
          params.missionId,
          params.messageId,
          parsed.data.auth.issuedAt,
        ),
      );
      if (authError) {
        return reply.code(401).send({ error: authError });
      }

      const bus = messageBus ?? runner.messageBus;
      try {
        const message = await bus.answerQuestion(
          params.messageId,
          parsed.data.content,
          "human",
        );
        return { message };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unable to resolve message";
        return reply.code(400).send({ error: errorMessage });
      }
    },
  );

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
          { txSignature: parsed.data.txSignature },
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
