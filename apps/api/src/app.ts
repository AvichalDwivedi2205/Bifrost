import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { env } from "./env";
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

  await registerRegistryRoutes(app, registry, registryApplications);
  await registerMissionRoutes(app, store, runner, messageBus);
  await registerMissionStream(app, store);

  return { app, store, runner, registry, registryApplications };
}

export async function startServer() {
  const { app } = await createApp();
  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
  return app;
}
