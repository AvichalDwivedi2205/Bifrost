import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    applicationId: v.string(),
    application: v.any(),
    status: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("registryApplications")
      .withIndex("by_applicationId", (q) =>
        q.eq("applicationId", args.applicationId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        application: args.application,
        status: args.status,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("registryApplications", args);
    }
  },
});

export const getByApplicationId = query({
  args: {
    applicationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("registryApplications")
      .withIndex("by_applicationId", (q) =>
        q.eq("applicationId", args.applicationId)
      )
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("registryApplications").collect();
  },
});

export const listByStatus = query({
  args: {
    status: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("registryApplications")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});
