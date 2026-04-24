import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { env } from "./env";
import { registerMissionRoutes } from "./routes/missions";
import { registerRegistryRoutes } from "./routes/registry";
import { MissionRunner } from "./services/mission-runner";
import { AgentRegistryService } from "./services/registry";
import { RegistryApplicationStore } from "./services/registry-application-store";
import { MissionStore } from "./services/store";
import { registerMissionStream } from "./ws/mission-stream";

export async function createApp(options: { seedDemo?: boolean } = {}) {
  const store = new MissionStore({ seedDemo: options.seedDemo });
  const registryApplications = new RegistryApplicationStore();
  const registry = new AgentRegistryService(registryApplications);
  const runner = new MissionRunner(store, registry);
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
  });
  await app.register(websocket);

  await registerRegistryRoutes(app, registry, registryApplications);
  await registerMissionRoutes(app, store, runner);
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
