import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    missionId: v.string(),
    news: v.optional(v.any()),
    market: v.optional(v.any()),
    skeptic: v.optional(v.any()),
    execution: v.optional(v.any()),
    launch: v.optional(v.any()),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("missionArtifacts")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .first();

    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: args.updatedAt };
      if (args.news !== undefined) patch.news = args.news;
      if (args.market !== undefined) patch.market = args.market;
      if (args.skeptic !== undefined) patch.skeptic = args.skeptic;
      if (args.execution !== undefined) patch.execution = args.execution;
      if (args.launch !== undefined) patch.launch = args.launch;
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    } else {
      return await ctx.db.insert("missionArtifacts", args);
    }
  },
});

export const getByMissionId = query({
  args: {
    missionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("missionArtifacts")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("missionArtifacts").collect();
  },
});
