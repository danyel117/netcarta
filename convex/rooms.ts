import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export const createRoom = mutation({
  args: {
    startArticle: v.string(),
    endArticle: v.string(),
    displayName: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    let code = makeRoomCode();
    let existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (query) => query.eq("code", code))
      .unique();

    while (existing) {
      code = makeRoomCode();
      existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (query) => query.eq("code", code))
        .unique();
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      hostUserId: args.userId,
      startArticle: args.startArticle,
      endArticle: args.endArticle,
      status: "lobby",
    });

    await ctx.db.insert("participants", {
      roomId,
      userId: args.userId,
      displayName: args.displayName,
      currentArticle: args.startArticle,
      path: [args.startArticle],
      clickCount: 0,
      finished: false,
    });

    return code;
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    userId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (query) => query.eq("code", args.code))
      .unique();

    if (!room) {
      throw new ConvexError("Room not found.");
    }

    const existingParticipant = await ctx.db
      .query("participants")
      .withIndex("by_room_and_user", (query) => query.eq("roomId", room._id).eq("userId", args.userId))
      .unique();

    if (existingParticipant) {
      return existingParticipant._id;
    }

    return await ctx.db.insert("participants", {
      roomId: room._id,
      userId: args.userId,
      displayName: args.displayName,
      currentArticle: room.startArticle,
      path: [room.startArticle],
      clickCount: 0,
      finished: false,
    });
  },
});

export const startRace = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (query) => query.eq("code", args.code))
      .unique();

    if (!room) {
      throw new ConvexError("Room not found.");
    }

    if (room.status !== "lobby") {
      return room._id;
    }

    const startedAt = Date.now();
    await ctx.db.patch(room._id, {
      status: "racing",
      startedAt,
      finishedAt: undefined,
      winnerId: undefined,
    });

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_room", (query) => query.eq("roomId", room._id))
      .collect();

    await Promise.all(
      participants.map((participant) =>
        ctx.db.patch(participant._id, {
          currentArticle: room.startArticle,
          path: [room.startArticle],
          clickCount: 0,
          finished: false,
          finishedAt: undefined,
        }),
      ),
    );

    return room._id;
  },
});

export const navigateParticipant = mutation({
  args: {
    code: v.string(),
    userId: v.string(),
    nextArticle: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (query) => query.eq("code", args.code))
      .unique();

    if (!room) {
      throw new ConvexError("Room not found.");
    }

    if (room.status !== "racing") {
      throw new ConvexError("Race has not started.");
    }

    const participant = await ctx.db
      .query("participants")
      .withIndex("by_room_and_user", (query) => query.eq("roomId", room._id).eq("userId", args.userId))
      .unique();

    if (!participant) {
      throw new ConvexError("Participant not found.");
    }

    if (participant.finished) {
      return participant._id;
    }

    const clickCount = participant.clickCount + 1;
    const path = [...participant.path, args.nextArticle];
    const finished = args.nextArticle === room.endArticle;
    const finishedAt = finished ? Date.now() : undefined;

    await ctx.db.patch(participant._id, {
      currentArticle: args.nextArticle,
      path,
      clickCount,
      finished,
      finishedAt,
    });

    if (finished && !room.winnerId && room.startedAt) {
      await ctx.db.patch(room._id, {
        status: "finished",
        winnerId: args.userId,
        finishedAt,
      });

      await ctx.db.insert("leaderboard", {
        roomId: room._id,
        winnerName: participant.displayName,
        startArticle: room.startArticle,
        endArticle: room.endArticle,
        clicks: clickCount,
        timeMs: finishedAt - room.startedAt,
        createdAt: finishedAt,
      });
    }

    return participant._id;
  },
});

export const getRoomState = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (query) => query.eq("code", args.code))
      .unique();

    if (!room) {
      return null;
    }

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_room", (query) => query.eq("roomId", room._id))
      .collect();

    const leaderboardEntry = room.winnerId
      ? await ctx.db
          .query("leaderboard")
          .filter((query) => query.eq(query.field("roomId"), room._id))
          .first()
      : null;

    return {
      room,
      participants: participants.sort((a, b) => Number(b.finished) - Number(a.finished) || a.clickCount - b.clickCount),
      leaderboardEntry: leaderboardEntry ?? undefined,
    };
  },
});
