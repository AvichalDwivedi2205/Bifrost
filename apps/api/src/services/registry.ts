import type { AgentProfile, RegistryAgent } from "@bifrost/shared";
import { demoRegistry } from "@bifrost/shared";

import type { RegistryApplicationStore } from "./registry-application-store";

export class AgentRegistryService {
  constructor(private readonly applicationStore?: RegistryApplicationStore) {}

  list(): RegistryAgent[] {
    const registeredAgents = this.applicationStore?.listCertifiedAgents() ?? [];
    const registeredIds = new Set(registeredAgents.map((agent) => agent.id));
    return [
      ...structuredClone(demoRegistry).filter((agent) => !registeredIds.has(agent.id)),
      ...registeredAgents,
    ];
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
