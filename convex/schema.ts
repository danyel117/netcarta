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
    articleLinks: v.optional(
      v.array(
        v.object({
          slug: v.string(),
          title: v.string(),
        }),
      ),
    ),
    fetchedAt: v.number(),
  }).index("by_slug", ["slug"]),
  raceRooms: defineTable({
    code: v.string(),
    hostPlayerToken: v.string(),
    startSlug: v.string(),
    startTitle: v.string(),
    targetSlug: v.string(),
    targetTitle: v.string(),
    status: v.union(
      v.literal("lobby"),
      v.literal("countdown"),
      v.literal("racing"),
      v.literal("finished"),
    ),
    countdownStartedAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    winnerParticipantId: v.optional(v.id("raceParticipants")),
    createdAt: v.number(),
  }).index("by_code", ["code"]),
  raceParticipants: defineTable({
    roomId: v.id("raceRooms"),
    playerToken: v.string(),
    displayName: v.string(),
    role: v.union(v.literal("player"), v.literal("spectator")),
    ready: v.boolean(),
    currentArticleSlug: v.string(),
    currentArticleTitle: v.string(),
    path: v.array(
      v.object({
        slug: v.string(),
        title: v.string(),
      }),
    ),
    clickCount: v.number(),
    joinedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_and_playerToken", ["roomId", "playerToken"]),
  raceResults: defineTable({
    roomId: v.id("raceRooms"),
    winnerName: v.string(),
    startSlug: v.string(),
    startTitle: v.string(),
    targetSlug: v.string(),
    targetTitle: v.string(),
    clickCount: v.number(),
    timeMs: v.number(),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),
});
