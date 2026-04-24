import type {
  AgentProfile,
  MissionEvent,
  MissionInput,
  MissionRecord,
  MissionTask,
  RegistryAgent,
} from "@bifrost/shared";
import { demoMissionRecord } from "@bifrost/shared";
import { nanoid } from "nanoid";

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
