import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const join = mutation({
  args: {
    email: v.string(),
    practiceName: v.optional(v.string()),
    role: v.optional(v.string()),
    source: v.string(),
    missionId: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    duplicate: v.boolean(),
    id: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { ok: false, duplicate: false };
    }
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) {
      return { ok: true, duplicate: true, id: existing._id };
    }
    const id = await ctx.db.insert("waitlist", {
      email,
      practiceName: args.practiceName,
      role: args.role,
      source: args.source,
      missionId: args.missionId,
      createdAt: Date.now(),
    });
    return { ok: true, duplicate: false, id };
  },
});

export const count = query({
  args: { source: v.optional(v.string()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    if (args.source) {
      const rows = await ctx.db
        .query("waitlist")
        .withIndex("by_source", (q) => q.eq("source", args.source!))
        .collect();
      return rows.length;
    }
    const all = await ctx.db.query("waitlist").collect();
    return all.length;
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("waitlist"),
      email: v.string(),
      practiceName: v.optional(v.string()),
      role: v.optional(v.string()),
      source: v.string(),
      missionId: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const rows = await ctx.db
      .query("waitlist")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
    return rows.map((row) => ({
      _id: row._id,
      email: row.email,
      practiceName: row.practiceName,
      role: row.role,
      source: row.source,
      missionId: row.missionId,
      createdAt: row.createdAt,
    }));
  },
});
