import { randomUUID } from "node:crypto";
import type { AgentMessage, AgentMessageType, AgentMessageStatus } from "@bifrost/shared";

export function defaultStatusForType(type: AgentMessageType): AgentMessageStatus {
  switch (type) {
    case "decision":
    case "answer":
      return "resolved";
    case "question":
    case "challenge":
    case "evidence_request":
    case "payment_request":
    case "clarification":
    default:
      return "open";
  }
}

export function buildAgentMessage(args: {
  missionId: string;
  fromAgentId: string;
  toAgentId: string;
  type: AgentMessageType;
  content: string;
  artifactRefs?: string[];
  threadId?: string;
  status?: AgentMessageStatus;
  id?: string;
  createdAt?: string;
}): AgentMessage {
  return {
    id: args.id ?? randomUUID(),
    missionId: args.missionId,
    threadId: args.threadId ?? args.missionId,
    fromAgentId: args.fromAgentId,
    toAgentId: args.toAgentId,
    type: args.type,
    content: args.content,
    artifactRefs: args.artifactRefs ?? [],
    status: args.status ?? defaultStatusForType(args.type),
    createdAt: args.createdAt ?? new Date().toISOString(),
  };
}

export function buildChallengeMessage(
  missionId: string,
  fromAgentId: string,
  targetAgentId: string,
  claim: string,
  evidenceRefs?: string[]
): AgentMessage {
  return buildAgentMessage({
    missionId,
    fromAgentId,
    toAgentId: targetAgentId,
    type: "challenge",
    content: claim,
    artifactRefs: evidenceRefs,
  });
}

export function buildEvidenceRequest(
  missionId: string,
  fromAgentId: string,
  targetAgentId: string,
  artifactRef: string,
  question: string
): AgentMessage {
  return buildAgentMessage({
    missionId,
    fromAgentId,
    toAgentId: targetAgentId,
    type: "evidence_request",
    content: question,
    artifactRefs: [artifactRef],
  });
}
