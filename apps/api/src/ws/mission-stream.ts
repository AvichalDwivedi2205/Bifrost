import type { FastifyInstance } from "fastify";

import type { MissionStore } from "../services/store";

export async function registerMissionStream(app: FastifyInstance, store: MissionStore) {
  app.get(
    "/ws/missions/:missionId",
    { websocket: true },
    (connection, request) => {
      const params = request.params as { missionId: string };
      const record = store.get(params.missionId);
      if (!record) {
        connection.send(JSON.stringify({ error: "Mission not found" }));
        connection.close(1008, "Mission not found");
        return;
      }

      const unsubscribe = store.subscribe(params.missionId, (record, event) => {
        connection.send(
          JSON.stringify({
            mission: record,
            event,
          }),
        );
      });

      connection.on("close", () => {
        unsubscribe();
      });
    },
  );
}
