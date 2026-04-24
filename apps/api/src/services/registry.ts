import type { AgentProfile, RegistryAgent } from "@missionmesh/shared";
import { demoRegistry } from "@missionmesh/shared";

export class AgentRegistryService {
  list(): RegistryAgent[] {
    return structuredClone(demoRegistry);
  }

  getById(id: string): RegistryAgent | undefined {
    return this.list().find((agent) => agent.id === id);
  }

  getMany(ids: string[]): RegistryAgent[] {
    const wanted = new Set(ids);
    return this.list().filter((agent) => wanted.has(agent.id));
  }

  toProfile(agent: RegistryAgent, budgetCap = 0): AgentProfile {
    return {
      ...structuredClone(agent),
      budgetCap,
      costIncurred: 0,
      status: "idle",
      currentAction: "Queued",
      currentPhaseStatus: "pending",
      phaseHistory: [],
      selected: true,
    };
  }
}
