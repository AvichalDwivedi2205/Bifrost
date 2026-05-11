import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { env } from "./env";
import { LLMRouter } from "./providers/llm/router";
import { registerDemoRoutes } from "./routes/demo";
import { registerMissionRoutes } from "./routes/missions";
import { registerRegistryRoutes } from "./routes/registry";
import { AgentMessageBus } from "./services/agent-message-bus";
import { MissionRunner } from "./services/mission-runner";
import { AgentRegistryService } from "./services/registry";
import {
  ConvexRegistryApplicationStore,
  RegistryApplicationStore,
} from "./services/registry-application-store";
import { ConvexMissionStore, MissionStore } from "./services/store";
import { registerMissionStream } from "./ws/mission-stream";

export async function createApp(options: { seedDemo?: boolean } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = (
    env.USE_CONVEX
      ? new ConvexMissionStore()
      : new MissionStore({ seedDemo: options.seedDemo })
  ) as MissionStore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registryApplications = (
    env.USE_CONVEX
      ? new ConvexRegistryApplicationStore()
      : new RegistryApplicationStore()
  ) as RegistryApplicationStore;
  const registry = new AgentRegistryService(registryApplications);
  const messageBus = new AgentMessageBus();
  const runner = new MissionRunner(store, registry, messageBus);
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
  });
  await app.register(websocket);

  app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

  await registerRegistryRoutes(app, registry, registryApplications);
  await registerMissionRoutes(app, store, runner, messageBus);
  await registerDemoRoutes(app, { store, runner, registry, registryApplications, messageBus });
  await registerMissionStream(app, store);

  return { app, store, runner, registry, registryApplications };
}

export async function startServer() {
  const { app } = await createApp();
  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
  // Fire-and-forget LLM warm-up so the first agent call in a demo doesn't pay
  // OpenRouter cold-start latency. Skipped when no API key is configured (mock-only).
  if (env.OPENROUTER_API_KEY) {
    void new LLMRouter()
      .generateText({
        task: "verify_mission",
        system: "ping",
        prompt: "ping",
        schemaHint: "{}",
        temperature: 0.1,
      })
      .then(() => app.log.info("[llm] warm-up complete"))
      .catch((err: unknown) => {
        app.log.warn(`[llm] warm-up skipped: ${err instanceof Error ? err.message : String(err)}`);
      });
  }
  return app;
}
