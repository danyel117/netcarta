import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("articles")
      .withIndex("by_slug", (query) => query.eq("slug", args.slug))
      .unique();
  },
});

export const upsertArticle = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    summary: v.string(),
    thumbnail: v.optional(v.string()),
    image: v.optional(v.string()),
    seeAlso: v.array(
      v.object({
        slug: v.string(),
        title: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("articles")
      .withIndex("by_slug", (query) => query.eq("slug", args.slug))
      .unique();

    const payload = {
      ...args,
      fetchedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("articles", payload);
  },
});
