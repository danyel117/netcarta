import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("messages").withIndex("by_createdAt").order("desc").take(10);
  },
});

export const create = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      body: args.body,
      createdAt: Date.now(),
    });
  },
});
