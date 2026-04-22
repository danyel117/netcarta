import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  articles: defineTable({
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
    fetchedAt: v.number(),
  }).index("by_slug", ["slug"]),
});
