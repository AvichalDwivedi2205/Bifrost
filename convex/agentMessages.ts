import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agentMessages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        threadId: args.threadId,
        fromAgentId: args.fromAgentId,
        toAgentId: args.toAgentId,
        type: args.type,
        content: args.content,
        artifactRefs: args.artifactRefs,
        status: args.status,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("agentMessages", args);
    }
  },
});

export const updateStatus = mutation({
  args: {
    messageId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agentMessages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();

    if (!existing) {
      throw new Error(`AgentMessage not found: ${args.messageId}`);
    }

    await ctx.db.patch(existing._id, { status: args.status });
  },
});

export const getByMissionId = query({
  args: {
    missionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentMessages")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .collect();
  },
});

export const getByMessageId = query({
  args: {
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentMessages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agentMessages").collect();
  },
});
