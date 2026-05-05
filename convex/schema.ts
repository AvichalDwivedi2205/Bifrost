import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  missions: defineTable({
    missionId: v.string(),
    input: v.any(),
    status: v.string(),
    budget: v.any(),
    agents: v.any(),
    selectedAgentIds: v.array(v.string()),
    pendingSpendApprovals: v.any(),
    tasks: v.any(),
    events: v.any(),
    verificationChecks: v.any(),
    receipts: v.any(),
    deliverables: v.optional(v.any()),
    humanCheckpoints: v.optional(v.any()),
    agentWork: v.optional(v.any()),
    trustProfiles: v.optional(v.any()),
    proof: v.optional(v.any()),
    finalResult: v.optional(v.any()),
    failureReason: v.optional(v.string()),
    settlement: v.any(),
    reputationDeltas: v.any(),
    chain: v.optional(v.any()),
    elapsedLabel: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  missionArtifacts: defineTable({
    missionId: v.string(),
    news: v.optional(v.any()),
    market: v.optional(v.any()),
    skeptic: v.optional(v.any()),
    execution: v.optional(v.any()),
    launch: v.optional(v.any()),
    updatedAt: v.string(),
  }).index("by_missionId", ["missionId"]),

  agentMessages: defineTable({
    messageId: v.string(),
    missionId: v.string(),
    threadId: v.string(),
    fromAgentId: v.string(),
    toAgentId: v.string(),
    type: v.string(),
    content: v.string(),
    artifactRefs: v.array(v.string()),
    status: v.string(),
    createdAt: v.string(),
  })
    .index("by_missionId", ["missionId", "createdAt"])
    .index("by_messageId", ["messageId"])
    .index("by_status", ["status"]),

  paymentRequests: defineTable({
    agentMessageId: v.string(),
    missionId: v.string(),
    amount: v.number(),
    service: v.string(),
    toolName: v.string(),
    payoutWallet: v.string(),
    justification: v.string(),
    policyChecks: v.any(),
    approvalSignature: v.optional(v.string()),
    approvedAt: v.optional(v.string()),
    txSignature: v.optional(v.string()),
    status: v.string(),
  })
    .index("by_agentMessageId", ["agentMessageId"])
    .index("by_missionId", ["missionId"]),

  verificationReports: defineTable({
    missionId: v.string(),
    deterministicChecks: v.any(),
    aiChecks: v.optional(v.any()),
    proofHash: v.string(),
    messageCount: v.number(),
    receiptCount: v.number(),
    createdAt: v.string(),
    report: v.any(),
  }).index("by_missionId", ["missionId"]),

  registryApplications: defineTable({
    applicationId: v.string(),
    application: v.any(),
    status: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_status", ["status"]),
});
