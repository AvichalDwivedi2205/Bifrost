import { createHash } from "node:crypto";
import type { AgentMessage, SpendReceipt } from "@bifrost/shared";

export function buildProofHash(input: {
  missionId: string;
  messages: AgentMessage[];
  receipts: SpendReceipt[];
  outputSummary: string;
  finalRecommendation?: unknown;
}): string {
  const sortedMessages = [...input.messages].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const sortedReceipts = [...input.receipts].sort((a, b) =>
    a.receiptId.localeCompare(b.receiptId),
  );
  const payload = JSON.stringify({
    missionId: input.missionId,
    messages: sortedMessages.map((m) => ({
      id: m.id,
      type: m.type,
      fromAgentId: m.fromAgentId,
      toAgentId: m.toAgentId,
      content: m.content,
      status: m.status,
      createdAt: m.createdAt,
      artifactRefs: m.artifactRefs,
    })),
    receipts: sortedReceipts.map((r) => ({
      receiptId: r.receiptId,
      agentId: r.agentId,
      amount: r.amount,
      service: r.purpose,
      toolName: r.toolName,
      txSignature: r.txSignature,
    })),
    outputSummary: input.outputSummary,
    finalRecommendation: input.finalRecommendation ?? null,
  });
  return createHash("sha256").update(payload).digest("hex");
}
