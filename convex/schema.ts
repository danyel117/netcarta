import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    hostUserId: v.string(),
    startArticle: v.string(),
    endArticle: v.string(),
    status: v.union(v.literal("lobby"), v.literal("racing"), v.literal("finished")),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    winnerId: v.optional(v.string()),
  }).index("by_code", ["code"]),
  participants: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    displayName: v.string(),
    currentArticle: v.string(),
    path: v.array(v.string()),
    clickCount: v.number(),
    finished: v.boolean(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_user", ["roomId", "userId"]),
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
  leaderboard: defineTable({
    roomId: v.id("rooms"),
    winnerName: v.string(),
    startArticle: v.string(),
    endArticle: v.string(),
    clicks: v.number(),
    timeMs: v.number(),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),
});
