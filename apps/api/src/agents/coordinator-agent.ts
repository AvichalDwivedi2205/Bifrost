import type { MissionInput, MissionTask } from "@bifrost/shared";

import { BaseAgent } from "./base-agent";

export class CoordinatorAgent extends BaseAgent {
  async planMission(input: MissionInput): Promise<MissionTask[]> {
    const result = await this.askJson<{ tasks: MissionTask[] }>(
      "plan_mission",
      "You are the Bifrost coordinator. Break missions into deterministic execution steps with explicit dependencies and budgets.",
      `Mission title: ${input.title}
Mission template: ${input.template}
Objective: ${input.objective}
Success criteria: ${input.successCriteria}
Execution mode: ${input.executionMode}
Verification mode: ${input.verificationMode}
Max budget: ${input.maxBudget}
Max per call: ${input.maxPerCall}
Human approval above: ${input.humanApprovalAbove}`,
      `Schema:
{
  "tasks": MissionTask[]
}`,
    );

    return result.tasks;
  }
}

