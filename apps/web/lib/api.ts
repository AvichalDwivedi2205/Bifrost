import type {
  MissionAuthEnvelope,
  MissionCreateRequest,
  MissionInput,
  MissionRecord,
  MissionSelectionApprovalRequest,
  MissionSpendApprovalDecisionRequest,
  RegistryAgent,
} from "@missionmesh/shared";
import { demoMissionRecord, demoRegistry } from "@missionmesh/shared";

function inferLocalApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8787";
  }

  return "";
}

export function resolveApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? inferLocalApiBaseUrl();
}

export function createMissionWebSocketUrl(missionId: string): string {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    return "";
  }
  const wsProtocol = baseUrl.startsWith("https") ? "wss" : "ws";
  return `${baseUrl.replace(/^https?/, wsProtocol)}/ws/missions/${missionId}`;
}

async function parseMissionResponse(response: Response): Promise<MissionRecord> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Mission request failed");
  }

  const json = (await response.json()) as { mission: MissionRecord };
  return json.mission;
}

export async function createMission(
  input: MissionInput,
  auth: MissionAuthEnvelope,
): Promise<MissionRecord> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    return demoMissionRecord;
  }

  const payload: MissionCreateRequest = {
    mission: input,
    auth,
  };

  const response = await fetch(`${baseUrl}/api/missions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseMissionResponse(response);
}

export async function fetchMission(missionId: string): Promise<MissionRecord> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    return demoMissionRecord;
  }

  const response = await fetch(`${baseUrl}/api/missions/${missionId}`, {
    cache: "no-store",
  });

  return parseMissionResponse(response);
}

export async function fetchRegistry(): Promise<RegistryAgent[]> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    return demoRegistry;
  }

  const response = await fetch(`${baseUrl}/api/registry`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch the registry");
  }

  const json = (await response.json()) as { agents: RegistryAgent[] };
  return json.agents;
}

export async function approveMissionSelection(
  missionId: string,
  chosenAgentIds?: string[],
  auth?: MissionAuthEnvelope,
): Promise<MissionRecord> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    return demoMissionRecord;
  }

  const payload: MissionSelectionApprovalRequest = {
    chosenAgentIds,
    auth: auth ?? { issuedAt: "", signature: "" },
  };

  const response = await fetch(`${baseUrl}/api/missions/${missionId}/selection`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseMissionResponse(response);
}

export async function resolveSpendApproval(
  missionId: string,
  approvalId: string,
  approve: boolean,
  auth?: MissionAuthEnvelope,
): Promise<MissionRecord> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    return demoMissionRecord;
  }

  const payload: MissionSpendApprovalDecisionRequest = {
    approve,
    auth: auth ?? { issuedAt: "", signature: "" },
  };

  const response = await fetch(
    `${baseUrl}/api/missions/${missionId}/spend-approvals/${approvalId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return parseMissionResponse(response);
}

export function subscribeToMission(
  missionId: string,
  onMessage: (mission: MissionRecord) => void,
): (() => void) | undefined {
  const wsUrl = createMissionWebSocketUrl(missionId);
  if (!wsUrl) {
    return undefined;
  }

  const socket = new WebSocket(wsUrl);
  socket.onmessage = (message) => {
    const payload = JSON.parse(message.data) as { mission?: MissionRecord };
    if (payload.mission) {
      onMessage(payload.mission);
    }
  };

  return () => {
    socket.close();
  };
}
