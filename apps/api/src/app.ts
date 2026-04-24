import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { env } from "./env";
import { registerMissionRoutes } from "./routes/missions";
import { MissionRunner } from "./services/mission-runner";
import { MissionStore } from "./services/store";
import { registerMissionStream } from "./ws/mission-stream";

export async function createApp(options: { seedDemo?: boolean } = {}) {
  const store = new MissionStore({ seedDemo: options.seedDemo });
  const runner = new MissionRunner(store);
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
  });
  await app.register(websocket);

  await registerMissionRoutes(app, store, runner);
  await registerMissionStream(app, store);

  return { app, store, runner };
}

export async function startServer() {
  const { app } = await createApp();
  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
  return app;
}

