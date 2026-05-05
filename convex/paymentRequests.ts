import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paymentRequests")
      .withIndex("by_agentMessageId", (q) =>
        q.eq("agentMessageId", args.agentMessageId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        missionId: args.missionId,
        amount: args.amount,
        service: args.service,
        toolName: args.toolName,
        payoutWallet: args.payoutWallet,
        justification: args.justification,
        policyChecks: args.policyChecks,
        approvalSignature: args.approvalSignature,
        approvedAt: args.approvedAt,
        txSignature: args.txSignature,
        status: args.status,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("paymentRequests", args);
    }
  },
});

export const markApproved = mutation({
  args: {
    agentMessageId: v.string(),
    txSignature: v.string(),
    approvalSignature: v.string(),
    approvedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paymentRequests")
      .withIndex("by_agentMessageId", (q) =>
        q.eq("agentMessageId", args.agentMessageId)
      )
      .first();

    if (!existing) {
      throw new Error(`PaymentRequest not found: ${args.agentMessageId}`);
    }

    await ctx.db.patch(existing._id, {
      status: "approved",
      txSignature: args.txSignature,
      approvalSignature: args.approvalSignature,
      approvedAt: args.approvedAt,
    });
  },
});

export const markRejected = mutation({
  args: {
    agentMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paymentRequests")
      .withIndex("by_agentMessageId", (q) =>
        q.eq("agentMessageId", args.agentMessageId)
      )
      .first();

    if (!existing) {
      throw new Error(`PaymentRequest not found: ${args.agentMessageId}`);
    }

    await ctx.db.patch(existing._id, {
      status: "rejected",
    });
  },
});

export const getByAgentMessageId = query({
  args: {
    agentMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentRequests")
      .withIndex("by_agentMessageId", (q) =>
        q.eq("agentMessageId", args.agentMessageId)
      )
      .first();
  },
});

export const getByMissionId = query({
  args: {
    missionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentRequests")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .collect();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("paymentRequests").collect();
  },
});
