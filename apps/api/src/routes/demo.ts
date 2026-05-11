import type { FastifyInstance } from "fastify";

import type { AgentMessageBus } from "../services/agent-message-bus";
import type { MissionRunner } from "../services/mission-runner";
import type { AgentRegistryService } from "../services/registry";
import type { RegistryApplicationStore } from "../services/registry-application-store";
import { MissionStore } from "../services/store";

export interface DemoRouteContext {
  store: MissionStore;
  runner: MissionRunner;
  registry: AgentRegistryService;
  registryApplications: RegistryApplicationStore;
  messageBus: AgentMessageBus;
}

export async function registerDemoRoutes(app: FastifyInstance, ctx: DemoRouteContext) {
  app.post("/api/demo/reset", async (_request, reply) => {
    try {
      const inMemory = ctx.store as unknown as MissionStore & { reset?: (opts?: { seedDemo?: boolean }) => string | undefined };
      let seededMissionId: string | undefined;
      if (typeof inMemory.reset === "function") {
        seededMissionId = inMemory.reset({ seedDemo: true });
      } else {
        for (const mission of ctx.store.list()) {
          ctx.store.mutate(mission.id, () => mission);
        }
      }

      const busAny = ctx.messageBus as unknown as { reset?: () => void };
      if (typeof busAny.reset === "function") busAny.reset();

      const appsAny = ctx.registryApplications as unknown as { reset?: () => void };
      if (typeof appsAny.reset === "function") appsAny.reset();

      // Clear runner artifacts (artifacts.launch.disputeRerun etc.) so the next
      // demo run can re-trigger DEMO_INJECT_REJECTION cleanly.
      const runnerAny = ctx.runner as unknown as { reset?: () => void };
      if (typeof runnerAny.reset === "function") runnerAny.reset();

      return reply.send({
        ok: true,
        seededMissionId,
        missions: ctx.store.list().length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "reset failed";
      return reply.code(500).send({ ok: false, error: message });
    }
  });

  app.get("/api/demo/health", async () => ({
    ok: true,
    missions: ctx.store.list().length,
    runtime: ctx.runner.getRuntimeStatus(),
    timestamp: new Date().toISOString(),
  }));
}
