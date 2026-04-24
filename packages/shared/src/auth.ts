import type { MissionInput } from "./types";

export interface MissionAuthEnvelope {
  issuedAt: string;
  signature: string;
}

export interface MissionCreateRequest {
  mission: MissionInput;
  auth: MissionAuthEnvelope;
}

export interface MissionSelectionApprovalRequest {
  chosenAgentIds?: string[];
  auth: MissionAuthEnvelope;
}

export interface MissionSpendApprovalDecisionRequest {
  approve: boolean;
  auth: MissionAuthEnvelope;
}

export const MISSION_AUTH_WINDOW_MS = 5 * 60 * 1000;

export function buildMissionAuthorizationMessage(
  mission: MissionInput,
  issuedAt: string,
): string {
  return [
    "MissionMesh Authorization",
    "Action: create_mission",
    `Authority: ${mission.authorityWallet}`,
    `Issued At: ${issuedAt}`,
    `Title: ${mission.title}`,
    `Template: ${mission.template}`,
    `Description: ${mission.description}`,
    `Objective: ${mission.objective}`,
    `Success Criteria: ${mission.successCriteria}`,
    `Urgency: ${mission.urgency}`,
    `Execution Mode: ${mission.executionMode}`,
    `Verification Mode: ${mission.verificationMode}`,
    `Max Budget: ${mission.maxBudget}`,
    `Max Per Call: ${mission.maxPerCall}`,
    `Human Approval Above: ${mission.humanApprovalAbove}`,
    `Challenge Window Hours: ${mission.challengeWindowHours}`,
  ].join("\n");
}

export function buildSelectionAuthorizationMessage(
  missionId: string,
  authorityWallet: string,
  chosenAgentIds: string[],
  issuedAt: string,
): string {
  return [
    "MissionMesh Authorization",
    "Action: approve_agent_selection",
    `Mission: ${missionId}`,
    `Authority: ${authorityWallet}`,
    `Issued At: ${issuedAt}`,
    `Chosen Agents: ${[...chosenAgentIds].sort().join(",")}`,
  ].join("\n");
}

export function buildSpendApprovalAuthorizationMessage(
  missionId: string,
  authorityWallet: string,
  approvalId: string,
  approve: boolean,
  issuedAt: string,
): string {
  return [
    "MissionMesh Authorization",
    "Action: resolve_spend_approval",
    `Mission: ${missionId}`,
    `Authority: ${authorityWallet}`,
    `Approval: ${approvalId}`,
    `Decision: ${approve ? "approve" : "reject"}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
