import type {
  AgentProfile,
  MissionEvent,
  MissionInput,
  MissionRecord,
  MissionTask,
  RegistryAgent,
} from "@bifrost/shared";
import { demoFixtureMissions, demoMissionRecord } from "@bifrost/shared";
import type { ConvexHttpClient } from "convex/browser";
import { nanoid } from "nanoid";

import { getConvexClient } from "./convex-client";

type Listener = (record: MissionRecord, event?: MissionEvent) => void;

interface MissionStoreOptions {
  seedDemo?: boolean;
}

export class MissionStore {
  private readonly records = new Map<string, MissionRecord>();
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(options: MissionStoreOptions = {}) {
    if (options.seedDemo !== false) {
      this.seedDemoRecord();
    }
  }

  private seedDemoRecord(): void {
    this.records.set(demoMissionRecord.id, structuredClone(demoMissionRecord));
    for (const fixture of demoFixtureMissions) {
      this.records.set(fixture.id, structuredClone(fixture));
    }
  }

  reset(options: MissionStoreOptions = {}): string | undefined {
    this.records.clear();
    this.listeners.clear();
    if (options.seedDemo !== false) {
      this.seedDemoRecord();
      return demoMissionRecord.id;
    }
    return undefined;
  }

  list(): MissionRecord[] {
    return Array.from(this.records.values(), (record) => structuredClone(record));
  }

  get(id: string): MissionRecord | undefined {
    const record = this.records.get(id);
    return record ? structuredClone(record) : undefined;
  }

  create(
    input: MissionInput,
    registry: RegistryAgent[],
    agents: AgentProfile[],
    tasks: MissionTask[],
  ): MissionRecord {
    const id = nanoid(12);
    const record: MissionRecord = {
      id,
      input: structuredClone(input),
      status: "created",
      elapsedLabel: "0m 00s",
      budget: {
        totalBudget: input.maxBudget,
        maxPerCall: input.maxPerCall,
        humanApprovalAbove: input.humanApprovalAbove,
        reserved: 0,
        spent: 0,
        remaining: input.maxBudget,
      },
      registry: structuredClone(registry),
      agents: structuredClone(agents),
      selectedAgentIds: [],
      pendingSpendApprovals: [],
      tasks: structuredClone(tasks),
      events: [],
      verificationChecks: [],
      receipts: [],
      humanCheckpoints: [],
      agentWork: [],
      trustProfiles: buildTrustProfiles(agents),
      settlement: {
        state: "created",
        settledAmount: 0,
        refundedAmount: 0,
        protocolFee: 0,
      },
      reputationDeltas: [],
    };

    this.records.set(id, record);
    return structuredClone(record);
  }

  mutate(id: string, mutator: (record: MissionRecord) => MissionRecord): MissionRecord {
    const current = this.records.get(id);
    if (!current) {
      throw new Error(`Mission ${id} not found`);
    }

    const next = mutator(structuredClone(current));
    this.records.set(id, next);
    this.notify(next);
    return structuredClone(next);
  }

  appendEvent(id: string, event: MissionEvent): void {
    const current = this.records.get(id);
    if (!current) {
      throw new Error(`Mission ${id} not found`);
    }

    const next = structuredClone(current);
    next.events.push(event);
    this.records.set(id, next);
    this.notify(next, event);
  }

  subscribe(id: string, listener: Listener): () => void {
    const listeners = this.listeners.get(id) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(id, listeners);

    const record = this.records.get(id);
    if (record) {
      listener(structuredClone(record));
    }

    return () => {
      const current = this.listeners.get(id);
      current?.delete(listener);
    };
  }

  private notify(record: MissionRecord, event?: MissionEvent): void {
    this.listeners
      .get(record.id)
      ?.forEach((listener) => listener(structuredClone(record), event ? structuredClone(event) : undefined));
  }
}

// ---------------------------------------------------------------------------
// ConvexMissionStore — same synchronous public interface as MissionStore,
// backed by Convex persistence (write-through cache pattern).
//
// Phase 1 limitation: pub/sub fires only for mutations on THIS server instance.
// The in-memory cache is populated from Convex on first access via `warmCache()`.
// ---------------------------------------------------------------------------

function recordToConvexArgs(record: MissionRecord) {
  const now = new Date().toISOString();
  // Use unknown cast to access optional fields not declared in MissionRecord type.
  const r = record as unknown as Record<string, unknown>;
  return {
    missionId: record.id,
    input: record.input,
    status: record.status,
    budget: record.budget,
    agents: record.agents,
    selectedAgentIds: record.selectedAgentIds,
    pendingSpendApprovals: record.pendingSpendApprovals,
    tasks: record.tasks,
    events: record.events,
    verificationChecks: record.verificationChecks,
    receipts: record.receipts,
    deliverables: r.deliverables ?? undefined,
    humanCheckpoints: r.humanCheckpoints ?? [],
    agentWork: r.agentWork ?? [],
    trustProfiles: r.trustProfiles ?? buildTrustProfiles(record.agents),
    proof: r.proof ?? undefined,
    finalResult: r.finalResult ?? undefined,
    failureReason: r.failureReason as string | undefined,
    settlement: record.settlement,
    reputationDeltas: record.reputationDeltas,
    chain: r.chain ?? undefined,
    elapsedLabel: record.elapsedLabel,
    registry: record.registry,
    createdAt: r.createdAt as string | undefined ?? now,
    updatedAt: now,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convexDocToRecord(doc: Record<string, any>): MissionRecord {
  // Strip Convex internal fields (_id, _creationTime)
  const { _id: _unused1, _creationTime: _unused2, missionId, createdAt: _ca, updatedAt: _ua, ...rest } = doc;
  return {
    id: missionId,
    humanCheckpoints: [],
    agentWork: [],
    trustProfiles: [],
    ...rest,
  } as unknown as MissionRecord;
}

export class ConvexMissionStore {
  private readonly convex: ConvexHttpClient;
  private readonly cache = new Map<string, MissionRecord>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private cacheWarmed = false;
  private warmingPromise: Promise<void> | null = null;

  constructor(convexClient?: ConvexHttpClient) {
    this.convex = convexClient ?? getConvexClient();
    // Kick off background warm asynchronously — cache will be populated soon.
    this.warmingPromise = this.warmCache();
  }

  /** Load all missions from Convex into the local cache. */
  private async warmCache(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docs = await (this.convex as any).query("missions:list", {}) as any[];
      for (const doc of docs) {
        const record = convexDocToRecord(doc);
        this.cache.set(record.id, record);
      }
    } catch {
      // Convex unavailable at startup — cache stays empty, proceed in degraded mode.
    } finally {
      this.cacheWarmed = true;
    }
  }

  /** Idempotent seed — writes to cache + fire-and-forget Convex upsert. */
  seed(record: MissionRecord): void {
    if (!this.cache.has(record.id)) {
      this.cache.set(record.id, structuredClone(record));
    }
    // Persist to Convex in background.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.convex as any)
      .mutation("missions:upsert", recordToConvexArgs(record))
      .catch(() => {/* ignore — cache remains authoritative */});
  }

  list(): MissionRecord[] {
    return Array.from(this.cache.values(), (r) => structuredClone(r));
  }

  get(id: string): MissionRecord | undefined {
    const record = this.cache.get(id);
    return record ? structuredClone(record) : undefined;
  }

  create(
    input: MissionInput,
    registry: RegistryAgent[],
    agents: AgentProfile[],
    tasks: MissionTask[],
  ): MissionRecord {
    const id = nanoid(12);
    const record: MissionRecord = {
      id,
      input: structuredClone(input),
      status: "created",
      elapsedLabel: "0m 00s",
      budget: {
        totalBudget: input.maxBudget,
        maxPerCall: input.maxPerCall,
        humanApprovalAbove: input.humanApprovalAbove,
        reserved: 0,
        spent: 0,
        remaining: input.maxBudget,
      },
      registry: structuredClone(registry),
      agents: structuredClone(agents),
      selectedAgentIds: [],
      pendingSpendApprovals: [],
      tasks: structuredClone(tasks),
      events: [],
      verificationChecks: [],
      receipts: [],
      humanCheckpoints: [],
      agentWork: [],
      trustProfiles: buildTrustProfiles(agents),
      settlement: {
        state: "created",
        settledAmount: 0,
        refundedAmount: 0,
        protocolFee: 0,
      },
      reputationDeltas: [],
    };

    this.cache.set(id, record);
    this.notify(record);
    // Persist to Convex in background.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.convex as any)
      .mutation("missions:upsert", recordToConvexArgs(record))
      .catch(() => {/* ignore */});
    return structuredClone(record);
  }

  mutate(id: string, mutator: (record: MissionRecord) => MissionRecord): MissionRecord {
    const current = this.cache.get(id);
    if (!current) {
      throw new Error(`Mission ${id} not found`);
    }
    const next = mutator(structuredClone(current));
    this.cache.set(id, next);
    this.notify(next);
    // Persist to Convex in background.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.convex as any)
      .mutation("missions:upsert", recordToConvexArgs(next))
      .catch(() => {/* ignore */});
    return structuredClone(next);
  }

  appendEvent(id: string, event: MissionEvent): void {
    const current = this.cache.get(id);
    if (!current) {
      throw new Error(`Mission ${id} not found`);
    }
    const next = structuredClone(current);
    next.events.push(event);
    this.cache.set(id, next);
    this.notify(next, event);
    // Use Convex atomic appendEvent mutation in background.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.convex as any)
      .mutation("missions:appendEvent", { missionId: id, event })
      .catch(() => {/* fallback already applied to cache */});
  }

  subscribe(id: string, listener: Listener): () => void {
    const listeners = this.listeners.get(id) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(id, listeners);

    const record = this.cache.get(id);
    if (record) {
      listener(structuredClone(record));
    }

    return () => {
      const current = this.listeners.get(id);
      current?.delete(listener);
    };
  }

  /** Expose warming promise for callers that want to await full hydration. */
  ready(): Promise<void> {
    return this.warmingPromise ?? Promise.resolve();
  }

  private notify(record: MissionRecord, event?: MissionEvent): void {
    this.listeners
      .get(record.id)
      ?.forEach((listener) =>
        listener(structuredClone(record), event ? structuredClone(event) : undefined),
      );
  }
}

function buildTrustProfiles(agents: AgentProfile[]) {
  const now = new Date().toISOString();
  return agents.map((agent) => ({
    agentId: agent.id,
    globalTrustScore: agent.trustScore,
    categoryScores: {
      [agent.role]: agent.trustScore,
      "mission-fit": Math.min(99, agent.trustScore + 2),
    },
    completedMissions: agent.totalMissions,
    failedMissions: Math.max(0, Math.floor(agent.totalMissions * 0.025)),
    disputedMissions: Math.max(0, Math.floor(agent.totalMissions * 0.008)),
    verifierPassRate: clamp01(agent.trustScore / 100 + 0.04),
    humanOverrideRate: Math.max(0.02, 1 - agent.trustScore / 100),
    spendDiscipline: clamp01(agent.trustScore / 100 + 0.03),
    latencyScore: clamp01(agent.trustScore / 100),
    proofQualityScore: clamp01(agent.trustScore / 100 + 0.02),
    lastUpdated: now,
  }));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
}
