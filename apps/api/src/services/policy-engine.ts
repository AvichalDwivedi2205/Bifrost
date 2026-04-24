import type { AgentProfile, MissionRecord } from "@bifrost/shared";

export interface SpendAuthorization {
  approved: boolean;
  requiresHumanApproval: boolean;
  reason?: string;
}

export class PolicyEngine {
  authorize(
    record: MissionRecord,
    agent: AgentProfile,
    amount: number,
    service: string,
  ): SpendAuthorization {
    if (record.status !== "active" && record.status !== "awaiting_spend_approval") {
      return {
        approved: false,
        requiresHumanApproval: false,
        reason: "Mission is not active",
      };
    }

    if (amount > record.budget.maxPerCall) {
      return {
        approved: false,
        requiresHumanApproval: false,
        reason: "Amount exceeds per-call cap",
      };
    }

    if (
      agent.budgetCap !== undefined &&
      amount + (agent.costIncurred ?? 0) > agent.budgetCap
    ) {
      return {
        approved: false,
        requiresHumanApproval: false,
        reason: "Agent budget cap exceeded",
      };
    }

    if (amount > record.budget.remaining) {
      return {
        approved: false,
        requiresHumanApproval: false,
        reason: "Mission budget exhausted",
      };
    }

    const task = record.tasks.find(
      (item) =>
        item.assignedAgentId === agent.id ||
        (item.assignedAgentId === undefined && item.assignedAgent === agent.role),
    );
    if (task && task.approvedServices.length > 0 && !task.approvedServices.includes(service)) {
      return {
        approved: false,
        requiresHumanApproval: false,
        reason: "Service is not whitelisted for this task",
      };
    }

    return {
      approved: true,
      requiresHumanApproval: true,
    };
  }
}
