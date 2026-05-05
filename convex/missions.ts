import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("missions")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        input: args.input,
        status: args.status,
        budget: args.budget,
        agents: args.agents,
        selectedAgentIds: args.selectedAgentIds,
        pendingSpendApprovals: args.pendingSpendApprovals,
        tasks: args.tasks,
        events: args.events,
        verificationChecks: args.verificationChecks,
        receipts: args.receipts,
        deliverables: args.deliverables,
        humanCheckpoints: args.humanCheckpoints,
        agentWork: args.agentWork,
        trustProfiles: args.trustProfiles,
        proof: args.proof,
        finalResult: args.finalResult,
        failureReason: args.failureReason,
        settlement: args.settlement,
        reputationDeltas: args.reputationDeltas,
        chain: args.chain,
        elapsedLabel: args.elapsedLabel,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("missions", args);
    }
  },
});

export const appendEvent = mutation({
  args: {
    missionId: v.string(),
    event: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("missions")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .first();

    if (!existing) {
      throw new Error(`Mission not found: ${args.missionId}`);
    }

    const currentEvents: unknown[] = Array.isArray(existing.events)
      ? existing.events
      : [];

    await ctx.db.patch(existing._id, {
      events: [...currentEvents, args.event],
      updatedAt: new Date().toISOString(),
    });
  },
});

export const getByMissionId = query({
  args: {
    missionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("missions")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("missions").order("desc").collect();
  },
});
