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
    articleLinks: v.optional(
      v.array(
        v.object({
          slug: v.string(),
          title: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("articles")
      .withIndex("by_slug", (query) => query.eq("slug", args.slug))
      .unique();

    const payload = {
      slug: args.slug,
      title: args.title,
      summary: args.summary,
      seeAlso: args.seeAlso,
      fetchedAt: Date.now(),
      ...(args.thumbnail ? { thumbnail: args.thumbnail } : {}),
      ...(args.image ? { image: args.image } : {}),
      ...(args.articleLinks ? { articleLinks: args.articleLinks } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("articles", payload);
  },
});
