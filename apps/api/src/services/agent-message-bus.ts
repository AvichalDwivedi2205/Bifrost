import type { AgentMessage, AgentMessageStatus, AgentMessageType } from "@bifrost/shared";
import { buildAgentMessage } from "./agent-message-helpers";

/**
 * Phase 2B: In-memory AgentMessageBus.
 * Sonnet A owns this file — this is a local stub that satisfies the interface
 * until Sonnet A's implementation lands. Persist messages in-process only.
 */
export class AgentMessageBus {
  private readonly threads = new Map<string, AgentMessage[]>();
  private readonly byId = new Map<string, AgentMessage>();

  private store(message: AgentMessage): AgentMessage {
    this.byId.set(message.id, message);
    const thread = this.threads.get(message.missionId) ?? [];
    thread.push(message);
    this.threads.set(message.missionId, thread);
    return message;
  }

  send(args: {
    missionId: string;
    fromAgentId: string;
    toAgentId: string;
    type: AgentMessageType;
    content: string;
    artifactRefs?: string[];
    threadId?: string;
    status?: AgentMessageStatus;
  }): Promise<AgentMessage> {
    const message = buildAgentMessage(args);
    return Promise.resolve(this.store(message));
  }

  openQuestion(
    missionId: string,
    fromAgentId: string,
    toAgentId: string,
    content: string,
    artifactRefs?: string[],
  ): Promise<AgentMessage> {
    return this.send({ missionId, fromAgentId, toAgentId, type: "question", content, artifactRefs });
  }

  answerQuestion(
    messageId: string,
    content: string,
    fromAgentId: string,
  ): Promise<AgentMessage> {
    const original = this.byId.get(messageId);
    const missionId = original?.missionId ?? messageId;
    const toAgentId = original?.fromAgentId ?? "broadcast";
    const answer = buildAgentMessage({
      missionId,
      fromAgentId,
      toAgentId,
      type: "answer",
      content,
      threadId: original?.threadId ?? missionId,
    });
    if (original) {
      const updated: AgentMessage = { ...original, status: "answered" };
      this.byId.set(messageId, updated);
      const thread = this.threads.get(missionId) ?? [];
      const idx = thread.findIndex((m) => m.id === messageId);
      if (idx !== -1) thread[idx] = updated;
    }
    return Promise.resolve(this.store(answer));
  }

  challengeClaim(
    missionId: string,
    fromAgentId: string,
    targetAgentId: string,
    claim: string,
    evidenceRefs?: string[],
  ): Promise<AgentMessage> {
    return this.send({
      missionId,
      fromAgentId,
      toAgentId: targetAgentId,
      type: "challenge",
      content: claim,
      artifactRefs: evidenceRefs,
    });
  }

  requestEvidence(
    missionId: string,
    fromAgentId: string,
    targetAgentId: string,
    artifactRef: string,
    question: string,
  ): Promise<AgentMessage> {
    return this.send({
      missionId,
      fromAgentId,
      toAgentId: targetAgentId,
      type: "evidence_request",
      content: question,
      artifactRefs: [artifactRef],
    });
  }

  escalateToHuman(
    missionId: string,
    fromAgentId: string,
    content: string,
    artifactRefs?: string[],
  ): Promise<AgentMessage> {
    return this.send({
      missionId,
      fromAgentId,
      toAgentId: "human",
      type: "clarification",
      content,
      artifactRefs,
    });
  }

  broadcastDecision(
    missionId: string,
    fromAgentId: string,
    content: string,
    artifactRefs?: string[],
  ): Promise<AgentMessage> {
    return this.send({
      missionId,
      fromAgentId,
      toAgentId: "broadcast",
      type: "decision",
      content,
      artifactRefs,
    });
  }

  getThread(missionId: string): AgentMessage[] {
    return [...(this.threads.get(missionId) ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  updateStatus(messageId: string, status: AgentMessageStatus): Promise<AgentMessage | null> {
    const message = this.byId.get(messageId);
    if (!message) return Promise.resolve(null);
    const updated: AgentMessage = { ...message, status };
    this.byId.set(messageId, updated);
    const thread = this.threads.get(message.missionId) ?? [];
    const idx = thread.findIndex((m) => m.id === messageId);
    if (idx !== -1) thread[idx] = updated;
    return Promise.resolve(updated);
  }

  getById(messageId: string): AgentMessage | undefined {
    return this.byId.get(messageId);
  }

  reset(): void {
    this.threads.clear();
    this.byId.clear();
  }
}
