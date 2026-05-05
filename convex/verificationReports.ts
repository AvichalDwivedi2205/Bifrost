import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    missionId: v.string(),
    deterministicChecks: v.any(),
    aiChecks: v.optional(v.any()),
    proofHash: v.string(),
    messageCount: v.number(),
    receiptCount: v.number(),
    createdAt: v.string(),
    report: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("verificationReports")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        deterministicChecks: args.deterministicChecks,
        aiChecks: args.aiChecks,
        proofHash: args.proofHash,
        messageCount: args.messageCount,
        receiptCount: args.receiptCount,
        report: args.report,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("verificationReports", args);
    }
  },
});

export const getByMissionId = query({
  args: {
    missionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("verificationReports")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("verificationReports").collect();
  },
});
