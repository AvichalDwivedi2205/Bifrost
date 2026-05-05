import { describe, expect, test } from "bun:test";
import {
  buildMissionAuthorizationMessage,
  buildHumanCheckpointAuthorizationMessage,
  buildRegistryApplicationAuthorizationMessage,
  buildSelectionAuthorizationMessage,
  buildSpendApprovalAuthorizationMessage,
  type AgentManifest,
  demoMissionInput,
} from "@bifrost/shared";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

import { createApp } from "./app";

const isLocalSolana =
  process.env.SOLANA_RPC_URL?.includes("127.0.0.1") ||
  process.env.SOLANA_RPC_URL?.includes("localhost");
const localAwareTestTimeoutMs = isLocalSolana ? 30_000 : 5_000;

function createSignedMissionPayload(overrides: Partial<typeof demoMissionInput> = {}) {
  const signer = Keypair.generate();
  const mission = {
    ...demoMissionInput,
    authorityWallet: signer.publicKey.toBase58(),
    ...overrides,
  };
  const issuedAt = new Date().toISOString();
  const message = buildMissionAuthorizationMessage(mission, issuedAt);
  const signature = Buffer.from(
    nacl.sign.detached(new TextEncoder().encode(message), signer.secretKey),
  ).toString("base64");

  return {
    signer,
    mission,
    auth: {
      issuedAt,
      signature,
    },
  };
}

function createSelectionApprovalPayload(
  signer: Keypair,
  missionId: string,
  authorityWallet: string,
  chosenAgentIds: string[],
) {
  const issuedAt = new Date().toISOString();
  const message = buildSelectionAuthorizationMessage(
    missionId,
    authorityWallet,
    chosenAgentIds,
    issuedAt,
  );

  return {
    chosenAgentIds,
    auth: {
      issuedAt,
      signature: Buffer.from(
        nacl.sign.detached(new TextEncoder().encode(message), signer.secretKey),
      ).toString("base64"),
    },
  };
}

function createSpendApprovalPayload(
  signer: Keypair,
  missionId: string,
  authorityWallet: string,
  approvalId: string,
  approve: boolean,
) {
  const issuedAt = new Date().toISOString();
  const message = buildSpendApprovalAuthorizationMessage(
    missionId,
    authorityWallet,
    approvalId,
    approve,
    issuedAt,
  );

  return {
    approve,
    auth: {
      issuedAt,
      signature: Buffer.from(
        nacl.sign.detached(new TextEncoder().encode(message), signer.secretKey),
      ).toString("base64"),
    },
  };
}

function createCheckpointAnswerPayload(
  signer: Keypair,
  missionId: string,
  authorityWallet: string,
  checkpointId: string,
  response: string,
) {
  const issuedAt = new Date().toISOString();
  const message = buildHumanCheckpointAuthorizationMessage(
    missionId,
    authorityWallet,
    checkpointId,
    response,
    issuedAt,
  );

  return {
    response,
    auth: {
      issuedAt,
      signature: Buffer.from(
        nacl.sign.detached(new TextEncoder().encode(message), signer.secretKey),
      ).toString("base64"),
    },
  };
}

function createSignedRegistryApplicationPayload(
  overrides: Partial<AgentManifest> = {},
) {
  const signer = Keypair.generate();
  const wallet = signer.publicKey.toBase58();
  const manifest: AgentManifest = {
    agentId: `test-agent-${Date.now()}`,
    slug: "test-agent",
    name: "Test Capability Agent",
    description: "Agent used to verify Bifrost registry certification behavior.",
    icon: "AI",
    ownerWallet: wallet,
    payoutWallet: wallet,
    verifierWallet: wallet,
    endpointUrl: "mock://test-agent",
    role: "custom",
    executionMode: "callback",
    capabilities: [
      {
        id: "source-backed-research",
        label: "Source Backed Research",
        description: "Completes source-backed research with structured evidence.",
        version: "1.0.0",
        inputSchema: '{ "type": "object" }',
        outputSchema:
          '{ "type": "object", "properties": { "summary": { "type": "string" }, "evidenceRefs": { "type": "array" }, "confidence": { "type": "number" } } }',
        requiredTools: ["bifrost-runtime"],
        allowedServices: ["mock-sandbox"],
        evaluationSuiteId: "generic-capability-v1",
      },
    ],
    phaseSchema: [
      {
        id: "plan",
        label: "Plan",
        description: "Plan the bounded task.",
        streams: true,
      },
      {
        id: "produce",
        label: "Produce",
        description: "Produce structured output.",
        streams: true,
      },
    ],
    supportedServices: ["mock-sandbox"],
    spendPolicy: {
      maxPerCall: 0.1,
      budgetCap: 0.5,
      requiresHumanAbove: 0,
    },
    priceModel: "Mock sandbox pricing",
    metadataUri: "mock://test-agent/metadata.json",
    privacyPolicyUri: "mock://test-agent/privacy.json",
    requestedEvaluationSuites: ["generic-capability-v1"],
    signedAt: new Date().toISOString(),
    ...overrides,
  };
  const issuedAt = new Date().toISOString();
  const message = buildRegistryApplicationAuthorizationMessage(manifest, issuedAt);

  return {
    manifest,
    auth: {
      issuedAt,
      signature: Buffer.from(
        nacl.sign.detached(new TextEncoder().encode(message), signer.secretKey),
      ).toString("base64"),
    },
  };
}

async function fetchMission(app: Awaited<ReturnType<typeof createApp>>["app"], missionId: string) {
  const response = await app.inject({
    method: "GET",
    url: `/api/missions/${missionId}`,
  });
  expect(response.statusCode).toBe(200);
  return response.json() as {
    mission: {
      id: string;
      status: string;
      pendingSpendApprovals: Array<{ id: string }>;
      receipts: unknown[];
      finalResult?: { verdict: string };
      budget: { spent: number; remaining: number };
      proof?: { resultHash: string; txHashes: string[] };
      agentWork: Array<{
        kind: string;
        title: string;
        artifactRefs: string[];
      }>;
      trustProfiles: Array<{
        agentId: string;
        globalTrustScore: number;
        latestProofHash?: string;
      }>;
      reputationDeltas: Array<{ agentId: string; before: number; after: number; txSignature?: string }>;
      humanCheckpoints: Array<{
        id: string;
        status: string;
        options: string[];
      }>;
      deliverables?: {
        previewUrl?: string;
        liveUrl?: string;
        waitlistEndpoint?: string;
        socialPosts?: string[];
        fileManifest?: unknown[];
      };
    };
  };
}

describe("Bifrost API", () => {
  test("rejects mission creation with an invalid wallet", async () => {
    const { app } = await createApp({ seedDemo: false });

    try {
      const signedPayload = createSignedMissionPayload({
        authorityWallet: "not-a-wallet",
      });
      const response = await app.inject({
        method: "POST",
        url: "/api/missions",
        payload: {
          mission: signedPayload.mission,
          auth: signedPayload.auth,
        },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  test("rejects mission creation with an invalid signature", async () => {
    const { app } = await createApp({ seedDemo: false });

    try {
      const signedPayload = createSignedMissionPayload();
      const response = await app.inject({
        method: "POST",
        url: "/api/missions",
        payload: {
          mission: signedPayload.mission,
          auth: {
            ...signedPayload.auth,
            signature: Buffer.from("bad-signature").toString("base64"),
          },
        },
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  test("rejects mission creation with an expired authorization", async () => {
    const { app } = await createApp({ seedDemo: false });

    try {
      const signedPayload = createSignedMissionPayload();
      const response = await app.inject({
        method: "POST",
        url: "/api/missions",
        payload: {
          mission: signedPayload.mission,
          auth: {
            ...signedPayload.auth,
            issuedAt: "2020-01-01T00:00:00.000Z",
          },
        },
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  test("creates a mission and waits for human agent approval", async () => {
    const { app } = await createApp({ seedDemo: false });

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/missions",
        payload: (() => {
          const signedPayload = createSignedMissionPayload();
          return {
            mission: signedPayload.mission,
            auth: signedPayload.auth,
          };
        })(),
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json() as {
        mission: {
          id: string;
          status: string;
          selectionProposal?: { recommendedAgentIds: string[] };
        };
      };

      expect(created.mission.status).toBe("selection_pending");
      expect(created.mission.selectionProposal?.recommendedAgentIds.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  }, localAwareTestTimeoutMs);

  test("runs a mission end-to-end with human approval before every spend", async () => {
    const { app } = await createApp({ seedDemo: false });

    try {
      const signedPayload = createSignedMissionPayload();
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/missions",
        payload: {
          mission: signedPayload.mission,
          auth: signedPayload.auth,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json() as {
        mission: {
          id: string;
          selectionProposal?: { recommendedAgentIds: string[] };
        };
      };
      const missionId = created.mission.id;

      const selectionResponse = await app.inject({
        method: "POST",
        url: `/api/missions/${missionId}/selection`,
        payload: createSelectionApprovalPayload(
          signedPayload.signer,
          missionId,
          signedPayload.mission.authorityWallet,
          created.mission.selectionProposal?.recommendedAgentIds ?? [],
        ),
      });
      expect(selectionResponse.statusCode).toBe(200);

      const deadline = Date.now() + localAwareTestTimeoutMs;
      while (Date.now() < deadline) {
        const current = await fetchMission(app, missionId);
        if (current.mission.status === "settled") {
          expect(current.mission.receipts.length).toBe(3);
          expect(current.mission.budget.spent).toBe(0.62);
          expect(current.mission.budget.remaining).toBe(1.38);
          expect(current.mission.finalResult?.verdict).toBe("too_sus");
          expect(current.mission.proof?.resultHash).toBeString();
          expect(current.mission.proof?.txHashes.length).toBeGreaterThan(1);
          return;
        }

        const pending = current.mission.pendingSpendApprovals[0];
        if (pending) {
          const approvalResponse = await app.inject({
            method: "POST",
            url: `/api/missions/${missionId}/spend-approvals/${pending.id}`,
            payload: createSpendApprovalPayload(
              signedPayload.signer,
              missionId,
              signedPayload.mission.authorityWallet,
              pending.id,
              true,
            ),
          });
          expect(approvalResponse.statusCode).toBe(200);
          continue;
        }

        await Bun.sleep(30);
      }

      throw new Error("Mission did not settle before the deadline");
    } finally {
      await app.close();
    }
  }, localAwareTestTimeoutMs);

  test("runs launch mission with checkpoints, preview, live URL, posts, proof, and settlement", async () => {
    const { app } = await createApp({ seedDemo: false });

    try {
      const signedPayload = createSignedMissionPayload({
        title: "Launch Mission v1",
        template: "launch-site-v1",
        description:
          "Launch a landing page for my AI SDR tool for dentists. Budget $120. Buy a domain if it is under $15. Ask me before any spend.",
        objective:
          "Create a live landing page, waitlist form, launch posts, proof, and settlement for a dental AI SDR.",
        successCriteria:
          "Preview, live URL, waitlist endpoint, three launch posts, human checkpoints, spend approval, proof, and settlement all exist.",
        maxBudget: 120,
        maxPerCall: 1.5,
        templateConfig: {
          productName: "RecallReady AI",
          oneLineIdea:
            "An AI SDR that helps dentists convert missed calls and stale leads into booked appointments.",
          targetAudience: "independent dental practices",
          primaryCTA: "Join the waitlist",
          brandTone: "confident, clinical, helpful",
          mustHaveSections: ["hero", "problem", "workflow", "benefits", "faq", "waitlist"],
          domainBudgetCap: 15,
          allowDomainPurchase: true,
          launchChannels: ["LinkedIn", "X", "Founder community"],
          referenceSites: [],
          assetsProvided: [],
        },
      });
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/missions",
        payload: {
          mission: signedPayload.mission,
          auth: signedPayload.auth,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json() as {
        mission: {
          id: string;
          selectionProposal?: { recommendedAgentIds: string[] };
        };
      };
      const missionId = created.mission.id;

      const selectionResponse = await app.inject({
        method: "POST",
        url: `/api/missions/${missionId}/selection`,
        payload: createSelectionApprovalPayload(
          signedPayload.signer,
          missionId,
          signedPayload.mission.authorityWallet,
          created.mission.selectionProposal?.recommendedAgentIds ?? [],
        ),
      });
      expect(selectionResponse.statusCode).toBe(200);

      const deadline = Date.now() + localAwareTestTimeoutMs;
      while (Date.now() < deadline) {
        const current = await fetchMission(app, missionId);
        if (current.mission.status === "settled") {
          expect(current.mission.receipts.length).toBe(1);
          expect(current.mission.deliverables?.previewUrl).toInclude(`/api/missions/${missionId}/preview`);
          expect(current.mission.deliverables?.liveUrl).toInclude(`/api/missions/${missionId}/live`);
          expect(current.mission.deliverables?.waitlistEndpoint).toInclude(`/api/missions/${missionId}/waitlist`);
          expect(current.mission.deliverables?.socialPosts?.length).toBe(3);
          expect(current.mission.deliverables?.fileManifest?.length).toBeGreaterThan(0);
          expect(current.mission.humanCheckpoints.filter((checkpoint) => checkpoint.status === "answered").length).toBeGreaterThanOrEqual(2);
          expect(current.mission.proof?.resultHash).toStartWith("launch_");
          expect(current.mission.agentWork.length).toBeGreaterThanOrEqual(7);
          expect(current.mission.agentWork.some((work) => work.kind === "tool_call")).toBe(true);
          expect(current.mission.agentWork.some((work) => work.kind === "onchain")).toBe(true);
          expect(current.mission.reputationDeltas.length).toBeGreaterThan(0);
          expect(current.mission.trustProfiles.some((profile) => profile.latestProofHash?.startsWith("launch_"))).toBe(true);

          const previewResponse = await app.inject({
            method: "GET",
            url: `/api/missions/${missionId}/preview`,
          });
          expect(previewResponse.statusCode).toBe(200);
          expect(previewResponse.body).toContain("RecallReady AI");
          return;
        }

        const pendingCheckpoint = current.mission.humanCheckpoints.find(
          (checkpoint) => checkpoint.status === "open",
        );
        if (pendingCheckpoint) {
          const response =
            pendingCheckpoint.options[0] ??
            "Skip domain purchase";
          const checkpointResponse = await app.inject({
            method: "POST",
            url: `/api/missions/${missionId}/checkpoints/${pendingCheckpoint.id}`,
            payload: createCheckpointAnswerPayload(
              signedPayload.signer,
              missionId,
              signedPayload.mission.authorityWallet,
              pendingCheckpoint.id,
              response,
            ),
          });
          expect(checkpointResponse.statusCode).toBe(200);
          continue;
        }

        const pending = current.mission.pendingSpendApprovals[0];
        if (pending) {
          const approvalResponse = await app.inject({
            method: "POST",
            url: `/api/missions/${missionId}/spend-approvals/${pending.id}`,
            payload: createSpendApprovalPayload(
              signedPayload.signer,
              missionId,
              signedPayload.mission.authorityWallet,
              pending.id,
              true,
            ),
          });
          expect(approvalResponse.statusCode).toBe(200);
          continue;
        }

        await Bun.sleep(30);
      }

      throw new Error("Launch mission did not settle before the deadline");
    } finally {
      await app.close();
    }
  }, localAwareTestTimeoutMs);

  test("rejects unsigned spend approvals for demo safety", async () => {
    const { app } = await createApp({ seedDemo: false });

    try {
      const signedPayload = createSignedMissionPayload();
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/missions",
        payload: {
          mission: signedPayload.mission,
          auth: signedPayload.auth,
        },
      });
      expect(createResponse.statusCode).toBe(201);

      const created = createResponse.json() as {
        mission: {
          id: string;
          selectionProposal?: { recommendedAgentIds: string[] };
        };
      };
      const missionId = created.mission.id;

      const selectionResponse = await app.inject({
        method: "POST",
        url: `/api/missions/${missionId}/selection`,
        payload: createSelectionApprovalPayload(
          signedPayload.signer,
          missionId,
          signedPayload.mission.authorityWallet,
          created.mission.selectionProposal?.recommendedAgentIds ?? [],
        ),
      });
      expect(selectionResponse.statusCode).toBe(200);

      const deadline = Date.now() + localAwareTestTimeoutMs;
      while (Date.now() < deadline) {
        const current = await fetchMission(app, missionId);
        const pending = current.mission.pendingSpendApprovals[0];
        if (!pending) {
          await Bun.sleep(30);
          continue;
        }

        const approvalResponse = await app.inject({
          method: "POST",
          url: `/api/missions/${missionId}/spend-approvals/${pending.id}`,
          payload: { approve: true },
        });
        expect(approvalResponse.statusCode).toBe(400);
        return;
      }

      throw new Error("Spend approval request was never created");
    } finally {
      await app.close();
    }
  }, localAwareTestTimeoutMs);

  test("registers and certifies a callback agent capability", async () => {
    const { app } = await createApp({ seedDemo: false });

    try {
      const payload = createSignedRegistryApplicationPayload();
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/registry/applications",
        payload,
      });
      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json() as {
        application: { id: string; status: string };
      };
      expect(created.application.status).toBe("submitted");

      const protocolResponse = await app.inject({
        method: "POST",
        url: `/api/registry/applications/${created.application.id}/protocol-check`,
      });
      expect(protocolResponse.statusCode).toBe(200);
      expect(protocolResponse.json().application.status).toBe("protocol_check");

      const evaluationResponse = await app.inject({
        method: "POST",
        url: `/api/registry/applications/${created.application.id}/evaluations`,
      });
      expect(evaluationResponse.statusCode).toBe(200);
      const evaluated = evaluationResponse.json() as {
        application: {
          status: string;
          certifiedCapabilities: Array<{ capabilityId: string }>;
          anchorTxSignature?: string;
        };
        report: { status: string; overallScore: number; claimsVerified: string[] };
      };
      expect(evaluated.application.status).toBe("active");
      expect(evaluated.application.certifiedCapabilities[0]?.capabilityId).toBe(
        "source-backed-research",
      );
      expect(evaluated.report.status).toBe("passed");
      expect(evaluated.report.overallScore).toBeGreaterThan(0.7);

      const registryResponse = await app.inject({
        method: "GET",
        url: "/api/registry",
      });
      expect(registryResponse.statusCode).toBe(200);
      const registry = registryResponse.json() as {
        agents: Array<{ id: string; certifiedCapabilities?: unknown[] }>;
      };
      const registeredAgent = registry.agents.find(
        (agent) => agent.id === payload.manifest.agentId,
      );
      expect(registeredAgent?.certifiedCapabilities?.length).toBe(1);
    } finally {
      await app.close();
    }
  });

  test("rejects registry applications with invalid owner signatures", async () => {
    const { app } = await createApp({ seedDemo: false });

    try {
      const payload = createSignedRegistryApplicationPayload();
      const response = await app.inject({
        method: "POST",
        url: "/api/registry/applications",
        payload: {
          ...payload,
          auth: {
            ...payload.auth,
            signature: Buffer.from("bad-signature").toString("base64"),
          },
        },
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
