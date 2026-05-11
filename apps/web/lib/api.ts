import type {
  AgentManifest,
  AgentMessage,
  MissionAuthEnvelope,
  MissionHumanCheckpointAnswerRequest,
  MissionCreateRequest,
  MissionInput,
  MissionRecord,
  MissionSelectionApprovalRequest,
  MissionSpendApprovalDecisionRequest,
  MissionVerificationReport,
  RegistryAgent,
  RegistryApplication,
  RegistryApplicationCreateRequest,
} from "@bifrost/shared";
import { demoMissionRecord, demoRegistry } from "@bifrost/shared";

export interface MissionArtifacts {
  news?: {
    summary: string;
    artifactRef: string;
  };
  market?: {
    summary: string;
    artifactRef: string;
  };
  skeptic?: {
    summary: string;
    artifactRef: string;
  };
  execution?: {
    verdict: string;
    recommendation: string;
    headline: string;
    confidence: number;
    keyPoints: string[];
    artifactRef: string;
  };
  launch?: {
    research?: {
      summary: string;
      competitors: string[];
      messagingPatterns: string[];
      artifactRef: string;
    };
    positioning?: {
      options: string[];
      artifactRef: string;
    };
    selectedDirection?: string;
    copy?: {
      hero: string;
      subhead: string;
      sections: Array<{ heading: string; body: string }>;
      faq: Array<{ question: string; answer: string }>;
      cta: string;
      artifactRef: string;
    };
    site?: {
      files: Array<{ path: string; hash: string; bytes: number; kind: string }>;
      artifactRef: string;
    };
  };
}

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

export async function listMissions(): Promise<MissionRecord[]> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) return [];
  const response = await fetch(`${baseUrl}/api/missions`, { cache: "no-store" });
  if (!response.ok) throw new Error(`listMissions ${response.status}`);
  const json = (await response.json()) as { missions: MissionRecord[] };
  return json.missions ?? [];
}

export async function rebuildMission(missionId: string): Promise<MissionRecord> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) throw new Error("API base URL not configured");
  const response = await fetch(`${baseUrl}/api/missions/${missionId}/rebuild`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
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

export async function fetchMissionArtifacts(missionId: string): Promise<MissionArtifacts | null> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) return null;
  const res = await fetch(`${baseUrl}/api/missions/${missionId}/artifacts`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchMissionArtifacts ${res.status}`);
  const json = (await res.json()) as { artifacts: MissionArtifacts };
  return json.artifacts;
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

export async function fetchRegistryApplications(): Promise<RegistryApplication[]> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    return [];
  }

  const response = await fetch(`${baseUrl}/api/registry/applications`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch registry applications");
  }

  const json = (await response.json()) as { applications: RegistryApplication[] };
  return json.applications;
}

export async function createRegistryApplication(
  manifest: AgentManifest,
  auth: MissionAuthEnvelope,
): Promise<RegistryApplication> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    return createDemoRegistryApplication(manifest);
  }

  const payload: RegistryApplicationCreateRequest = {
    manifest,
    auth,
  };

  const response = await fetch(`${baseUrl}/api/registry/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to create registry application");
  }

  const json = (await response.json()) as { application: RegistryApplication };
  return json.application;
}

export async function fetchRegistryApplication(
  applicationId: string,
): Promise<RegistryApplication> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Registry application fetch requires an API server");
  }

  const response = await fetch(
    `${baseUrl}/api/registry/applications/${applicationId}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to fetch registry application");
  }

  const json = (await response.json()) as { application: RegistryApplication };
  return json.application;
}

export async function runRegistryProtocolCheck(
  applicationId: string,
): Promise<RegistryApplication> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Registry protocol checks require an API server");
  }

  const response = await fetch(
    `${baseUrl}/api/registry/applications/${applicationId}/protocol-check`,
    { method: "POST" },
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to run protocol check");
  }

  const json = (await response.json()) as { application: RegistryApplication };
  return json.application;
}

export async function submitRegistryEvaluations(applicationId: string): Promise<{
  application: RegistryApplication;
}> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Registry evaluations require an API server");
  }

  const response = await fetch(
    `${baseUrl}/api/registry/applications/${applicationId}/evaluations`,
    { method: "POST" },
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to submit registry evaluations");
  }

  return (await response.json()) as { application: RegistryApplication };
}

export async function runRegistryEvaluation(applicationId: string): Promise<{
  application: RegistryApplication;
}> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Registry evaluations require an API server");
  }

  const response = await fetch(
    `${baseUrl}/api/registry/applications/${applicationId}/evaluations`,
    { method: "POST" },
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to run registry evaluation");
  }

  return (await response.json()) as { application: RegistryApplication };
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
  txSignature?: string,
): Promise<MissionRecord> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    return demoMissionRecord;
  }

  const payload: MissionSpendApprovalDecisionRequest & { txSignature?: string } = {
    approve,
    auth: auth ?? { issuedAt: "", signature: "" },
    ...(txSignature && { txSignature }),
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

export async function answerHumanCheckpoint(
  missionId: string,
  checkpointId: string,
  responseText: string,
  auth: MissionAuthEnvelope,
): Promise<MissionRecord> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    return demoMissionRecord;
  }

  const payload: MissionHumanCheckpointAnswerRequest = {
    response: responseText,
    auth,
  };

  const response = await fetch(
    `${baseUrl}/api/missions/${missionId}/checkpoints/${checkpointId}`,
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

export interface SubscribeMissionCallbacks {
  onMission: (mission: MissionRecord) => void;
  onMessages?: (messages: AgentMessage[]) => void;
}

export function subscribeToMission(
  missionId: string,
  callbacksOrOnMessage: SubscribeMissionCallbacks | ((mission: MissionRecord) => void),
): (() => void) | undefined {
  const wsUrl = createMissionWebSocketUrl(missionId);
  if (!wsUrl) {
    return undefined;
  }

  const callbacks: SubscribeMissionCallbacks =
    typeof callbacksOrOnMessage === 'function'
      ? { onMission: callbacksOrOnMessage }
      : callbacksOrOnMessage;

  let socket: WebSocket | null = null;
  let destroyed = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  function clearTimers() {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function connect() {
    if (destroyed) return;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      attempt = 0; // reset backoff on success
      heartbeatTimer = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: 'ping' }));
          } catch {
            // ignore send failures — close handler will reconnect
          }
        }
      }, 25_000);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          mission?: MissionRecord;
          messages?: AgentMessage[];
        };
        if (payload.mission) {
          callbacks.onMission(payload.mission);
        }
        if (payload.messages && callbacks.onMessages) {
          callbacks.onMessages(payload.messages);
        }
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      clearTimers();
      if (destroyed) return;
      // exponential backoff: 1s, 2s, 4s, 8s … capped at 30s
      const delay = Math.min(1_000 * Math.pow(2, attempt), 30_000);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      // let onclose handle the reconnect
      socket?.close();
    };
  }

  connect();

  return () => {
    destroyed = true;
    clearTimers();
    socket?.close();
    socket = null;
  };
}

export async function fetchMissionMessages(missionId: string): Promise<AgentMessage[]> {
  const base = resolveApiBaseUrl();
  if (!base) return [];
  const res = await fetch(`${base}/api/missions/${missionId}/messages`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`fetchMissionMessages ${res.status}`);
  const json = (await res.json()) as { messages: AgentMessage[] };
  return json.messages;
}

export async function resolveAgentMessage(args: {
  missionId: string;
  messageId: string;
  content: string;
  wallet?: any;
}): Promise<AgentMessage> {
  const base = resolveApiBaseUrl();
  if (!base) throw new Error("API not configured");
  const issuedAt = new Date().toISOString();
  const res = await fetch(
    `${base}/api/missions/${args.missionId}/messages/${args.messageId}/resolve`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ auth: { issuedAt, signature: "" }, content: args.content }),
    },
  );
  if (!res.ok) throw new Error(`resolveAgentMessage ${res.status}`);
  return res.json();
}

export async function fetchMissionVerification(
  missionId: string,
): Promise<MissionVerificationReport | null> {
  const base = resolveApiBaseUrl();
  if (!base) return null;
  const res = await fetch(`${base}/api/missions/${missionId}/verification`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchMissionVerification ${res.status}`);
  const json = (await res.json()) as { report: MissionVerificationReport };
  return json.report;
}

function createDemoRegistryApplication(manifest: AgentManifest): RegistryApplication {
  const now = new Date().toISOString();
  return {
    id: "demo-registry-application",
    status: "submitted",
    submittedAt: now,
    updatedAt: now,
    ownerWallet: manifest.ownerWallet,
    manifest,
    manifestHash: "demo_manifest_hash",
    protocolChecks: [],
    evaluationReports: [],
    certifiedCapabilities: [],
    rejectedClaims: [],
  };
}
