import { v } from "convex/values";

import type { ArticlePreview } from "../lib/types";
import { fetchFullArticlePayload } from "../lib/wikipedia-full";
import { fetchWikipediaArticle } from "../lib/wikipedia";
import { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const COUNTDOWN_MS = 5_000;
const LIVE_PRESENCE_STALE_MS = 15_000;
const LIVE_SUGGESTION_WINDOW_MS = 10_000;
const MAX_FOLLOWER_PRESENCES = 32;
const MAX_RECENT_SUGGESTIONS = 16;
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type RaceRoom = Doc<"raceRooms">;
type RaceParticipant = Doc<"raceParticipants">;
type RaceParticipantPresence = Doc<"raceParticipantPresence">;

function clampRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

function isFreshPresence(presence: RaceParticipantPresence, now: number) {
  return now - presence.updatedAt <= LIVE_PRESENCE_STALE_MS;
}

function generateRoomCode() {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => {
    const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    return ROOM_CODE_ALPHABET[index];
  }).join("");
}

async function getRoomByCode(ctx: QueryCtx | MutationCtx, code: string) {
  return await ctx.db
    .query("raceRooms")
    .withIndex("by_code", (query) => query.eq("code", code.toUpperCase()))
    .unique();
}

async function getParticipant(
  ctx: QueryCtx | MutationCtx,
  roomId: RaceRoom["_id"],
  playerToken: string,
) {
  return await ctx.db
    .query("raceParticipants")
    .withIndex("by_roomId_and_playerToken", (query) =>
      query.eq("roomId", roomId).eq("playerToken", playerToken),
    )
    .unique();
}

async function listRoomParticipants(
  ctx: QueryCtx | MutationCtx,
  roomId: RaceRoom["_id"],
) {
  const participants = await ctx.db
    .query("raceParticipants")
    .withIndex("by_roomId", (query) => query.eq("roomId", roomId))
    .take(64);

  return participants.sort((left, right) => left.joinedAt - right.joinedAt);
}

async function getPresenceByParticipantId(
  ctx: QueryCtx | MutationCtx,
  roomId: RaceRoom["_id"],
  participantId: Id<"raceParticipants">,
) {
  return await ctx.db
    .query("raceParticipantPresence")
    .withIndex("by_roomId_and_participantId", (query) =>
      query.eq("roomId", roomId).eq("participantId", participantId),
    )
    .unique();
}

async function getPresenceByPlayerToken(
  ctx: QueryCtx | MutationCtx,
  roomId: RaceRoom["_id"],
  playerToken: string,
) {
  return await ctx.db
    .query("raceParticipantPresence")
    .withIndex("by_roomId_and_playerToken", (query) =>
      query.eq("roomId", roomId).eq("playerToken", playerToken),
    )
    .unique();
}

async function upsertPresenceRecord(
  ctx: MutationCtx,
  room: RaceRoom,
  participant: RaceParticipant,
  values: {
    currentArticleSlug: string;
    followingParticipantId?: Id<"raceParticipants">;
    cursorXRatio: number;
    cursorYRatio: number;
    scrollRatio: number;
  },
) {
  const existing = await getPresenceByParticipantId(ctx, room._id, participant._id);
  const payload = {
    playerToken: participant.playerToken,
    role: participant.role,
    currentArticleSlug: values.currentArticleSlug,
    followingParticipantId: values.followingParticipantId,
    cursorXRatio: clampRatio(values.cursorXRatio),
    cursorYRatio: clampRatio(values.cursorYRatio),
    scrollRatio: clampRatio(values.scrollRatio),
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return;
  }

  await ctx.db.insert("raceParticipantPresence", {
    roomId: room._id,
    participantId: participant._id,
    ...payload,
  });
}

async function listFollowerPresences(
  ctx: QueryCtx,
  roomId: RaceRoom["_id"],
  targetParticipantId: Id<"raceParticipants">,
) {
  return await ctx.db
    .query("raceParticipantPresence")
    .withIndex("by_roomId_and_followingParticipantId", (query) =>
      query.eq("roomId", roomId).eq("followingParticipantId", targetParticipantId),
    )
    .take(MAX_FOLLOWER_PRESENCES);
}

async function maybeStartCountdown(ctx: MutationCtx, room: RaceRoom) {
  if (room.status !== "lobby") {
    return room;
  }

  const participants = await listRoomParticipants(ctx, room._id);
  const players = participants.filter((participant) => participant.role === "player");

  if (players.length === 0 || players.some((participant) => !participant.ready)) {
    return room;
  }

  const countdownStartedAt = Date.now();
  await ctx.db.patch(room._id, {
    status: "countdown",
    countdownStartedAt,
  });

  return {
    ...room,
    status: "countdown" as const,
    countdownStartedAt,
  };
}

async function cacheInlineLinks(slug: string) {
  const fullArticle = await fetchFullArticlePayload(slug, { includeSections: true });
  const summaryArticle = await fetchWikipediaArticle(fullArticle.title);

  return {
    slug,
    title: summaryArticle.title,
    summary: summaryArticle.extract,
    thumbnail: summaryArticle.thumbnail,
    image: summaryArticle.originalImage,
    seeAlso: summaryArticle.links.slice(0, 10),
    articleLinks: fullArticle.articleLinks,
  };
}

async function resolveSetupArticles(startPreview: ArticlePreview, targetPreview: ArticlePreview) {
  if (startPreview.slug === targetPreview.slug) {
    throw new Error("Start and destination articles need to be different.");
  }

  const [startCache, targetCache] = await Promise.all([
    cacheInlineLinks(startPreview.slug),
    cacheInlineLinks(targetPreview.slug),
  ]);

  return {
    startPreview,
    targetPreview,
    startCache,
    targetCache,
  };
}

export const listRecentResults = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("raceResults")
      .withIndex("by_createdAt")
      .order("desc")
      .take(10);
  },
});

export const getRoomView = query({
  args: {
    code: v.string(),
    playerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room) {
      return null;
    }

    const participants = await listRoomParticipants(ctx, room._id);
    const self = args.playerToken
      ? participants.find((participant) => participant.playerToken === args.playerToken) ?? null
      : null;
    const players = participants.filter((participant) => participant.role === "player");
    const spectators = participants.filter((participant) => participant.role === "spectator");
    const winner = room.winnerParticipantId
      ? participants.find((participant) => participant._id === room.winnerParticipantId) ?? null
      : null;

    return {
      room,
      self,
      players,
      spectators,
      winner,
      countdownMs: COUNTDOWN_MS,
    };
  },
});

export const getFollowView = query({
  args: {
    code: v.string(),
    playerToken: v.string(),
    targetParticipantId: v.id("raceParticipants"),
  },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room) {
      return null;
    }

    const participants = await listRoomParticipants(ctx, room._id);
    const self = participants.find((participant) => participant.playerToken === args.playerToken) ?? null;
    if (!self) {
      return null;
    }

    const targetParticipant = participants.find((participant) => participant._id === args.targetParticipantId) ?? null;
    if (!targetParticipant || targetParticipant.role !== "player") {
      return null;
    }

    if (self.role === "player" && self._id !== targetParticipant._id) {
      return null;
    }

    const now = Date.now();
    const selfPresence = await getPresenceByPlayerToken(ctx, room._id, self.playerToken);
    const targetPresence = await getPresenceByParticipantId(ctx, room._id, targetParticipant._id);
    const followerPresences = await listFollowerPresences(ctx, room._id, targetParticipant._id);
    const participantById = new Map(participants.map((participant) => [participant._id, participant]));
    const recentSuggestions = await ctx.db
      .query("raceSuggestions")
      .withIndex("by_roomId_and_toParticipantId_and_createdAt", (query) =>
        query.eq("roomId", room._id).eq("toParticipantId", targetParticipant._id),
      )
      .order("desc")
      .take(MAX_RECENT_SUGGESTIONS);

    return {
      viewer: self,
      targetParticipant,
      selfPresence:
        selfPresence && isFreshPresence(selfPresence, now)
          ? {
              participantId: selfPresence.participantId,
              currentArticleSlug: selfPresence.currentArticleSlug,
              cursorXRatio: selfPresence.cursorXRatio,
              cursorYRatio: selfPresence.cursorYRatio,
              scrollRatio: selfPresence.scrollRatio,
              updatedAt: selfPresence.updatedAt,
            }
          : null,
      targetPresence:
        targetPresence && isFreshPresence(targetPresence, now)
          ? {
              participantId: targetPresence.participantId,
              displayName: targetParticipant.displayName,
              currentArticleSlug: targetPresence.currentArticleSlug,
              cursorXRatio: targetPresence.cursorXRatio,
              cursorYRatio: targetPresence.cursorYRatio,
              scrollRatio: targetPresence.scrollRatio,
              updatedAt: targetPresence.updatedAt,
            }
          : null,
      followerPresences: followerPresences
        .filter(
          (presence) =>
            presence.role === "spectator" &&
            isFreshPresence(presence, now) &&
            presence.currentArticleSlug === targetParticipant.currentArticleSlug,
        )
        .flatMap((presence) => {
          const follower = participantById.get(presence.participantId);

          return follower
            ? [{
                participantId: presence.participantId,
                playerToken: presence.playerToken,
                displayName: follower.displayName,
                currentArticleSlug: presence.currentArticleSlug,
                cursorXRatio: presence.cursorXRatio,
                cursorYRatio: presence.cursorYRatio,
                scrollRatio: presence.scrollRatio,
                updatedAt: presence.updatedAt,
              }]
            : [];
        }),
      recentSuggestions: recentSuggestions
        .filter(
          (suggestion) =>
            now - suggestion.createdAt <= LIVE_SUGGESTION_WINDOW_MS &&
            suggestion.sourceArticleSlug === targetParticipant.currentArticleSlug,
        )
        .map((suggestion) => ({
          _id: suggestion._id,
          fromParticipantId: suggestion.fromParticipantId,
          fromDisplayName: suggestion.fromDisplayName,
          sourceArticleSlug: suggestion.sourceArticleSlug,
          articleSlug: suggestion.articleSlug,
          articleTitle: suggestion.articleTitle,
          createdAt: suggestion.createdAt,
        })),
    };
  },
});

export const upsertPresence = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
    currentArticleSlug: v.string(),
    followingParticipantId: v.optional(v.id("raceParticipants")),
    cursorXRatio: v.number(),
    cursorYRatio: v.number(),
    scrollRatio: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room) {
      throw new Error("That room does not exist.");
    }

    const participant = await getParticipant(ctx, room._id, args.playerToken);
    if (!participant) {
      throw new Error("You need to join the room before syncing live state.");
    }

    let followingParticipantId: Id<"raceParticipants"> | undefined;
    if (participant.role === "spectator" && args.followingParticipantId) {
      const targetParticipant = await ctx.db.get(args.followingParticipantId);
      if (!targetParticipant || targetParticipant.roomId !== room._id || targetParticipant.role !== "player") {
        throw new Error("Spectators can only follow players in the same room.");
      }

      followingParticipantId = targetParticipant._id;
    }

    await upsertPresenceRecord(ctx, room, participant, {
      currentArticleSlug: args.currentArticleSlug,
      followingParticipantId,
      cursorXRatio: args.cursorXRatio,
      cursorYRatio: args.cursorYRatio,
      scrollRatio: args.scrollRatio,
    });

    return { ok: true };
  },
});

export const setFollowTarget = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
    followingParticipantId: v.id("raceParticipants"),
  },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room) {
      throw new Error("That room does not exist.");
    }

    const participant = await getParticipant(ctx, room._id, args.playerToken);
    if (!participant || participant.role !== "spectator") {
      throw new Error("Only spectators can follow another player.");
    }

    const targetParticipant = await ctx.db.get(args.followingParticipantId);
    if (!targetParticipant || targetParticipant.roomId !== room._id || targetParticipant.role !== "player") {
      throw new Error("Choose a player from this room to follow.");
    }

    const existingPresence = await getPresenceByParticipantId(ctx, room._id, participant._id);

    await upsertPresenceRecord(ctx, room, participant, {
      currentArticleSlug: targetParticipant.currentArticleSlug,
      followingParticipantId: targetParticipant._id,
      cursorXRatio: existingPresence?.cursorXRatio ?? 0.5,
      cursorYRatio: existingPresence?.cursorYRatio ?? 0.1,
      scrollRatio: existingPresence?.scrollRatio ?? 0,
    });

    return { ok: true };
  },
});

export const sendSuggestion = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
    toParticipantId: v.id("raceParticipants"),
    articleSlug: v.string(),
    articleTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room) {
      throw new Error("That room does not exist.");
    }

    const participant = await getParticipant(ctx, room._id, args.playerToken);
    if (!participant || participant.role !== "spectator") {
      throw new Error("Only spectators can send link suggestions.");
    }

    const targetParticipant = await ctx.db.get(args.toParticipantId);
    if (!targetParticipant || targetParticipant.roomId !== room._id || targetParticipant.role !== "player") {
      throw new Error("Suggestions can only target players in the same room.");
    }

    const sourceArticle = await ctx.db
      .query("articles")
      .withIndex("by_slug", (query) => query.eq("slug", targetParticipant.currentArticleSlug))
      .unique();

    if (!sourceArticle?.articleLinks) {
      throw new Error("That article is not ready for suggestion sync yet.");
    }

    const suggestedLink = sourceArticle.articleLinks.find((link) => link.slug === args.articleSlug);
    if (!suggestedLink) {
      throw new Error("That link is not available from the player's current article.");
    }

    await ctx.db.insert("raceSuggestions", {
      roomId: room._id,
      fromParticipantId: participant._id,
      fromDisplayName: participant.displayName,
      toParticipantId: targetParticipant._id,
      sourceArticleSlug: targetParticipant.currentArticleSlug,
      articleSlug: suggestedLink.slug,
      articleTitle: suggestedLink.title,
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

export const createRoomResolved = mutation({
  args: {
    playerToken: v.string(),
    displayName: v.string(),
    startSlug: v.string(),
    startTitle: v.string(),
    targetSlug: v.string(),
    targetTitle: v.string(),
  },
  handler: async (ctx, args) => {
    let code = "";

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const nextCode = generateRoomCode();
      const existing = await getRoomByCode(ctx, nextCode);
      if (!existing) {
        code = nextCode;
        break;
      }
    }

    if (!code) {
      throw new Error("Could not allocate a room code right now.");
    }

    const createdAt = Date.now();
    const roomId = await ctx.db.insert("raceRooms", {
      code,
      hostPlayerToken: args.playerToken,
      startSlug: args.startSlug,
      startTitle: args.startTitle,
      targetSlug: args.targetSlug,
      targetTitle: args.targetTitle,
      status: "lobby",
      createdAt,
    });

    await ctx.db.insert("raceParticipants", {
      roomId,
      playerToken: args.playerToken,
      displayName: args.displayName,
      role: "player",
      ready: false,
      currentArticleSlug: args.startSlug,
      currentArticleTitle: args.startTitle,
      path: [
        {
          slug: args.startSlug,
          title: args.startTitle,
        },
      ],
      clickCount: 0,
      joinedAt: createdAt,
    });

    return { code };
  },
});

export const createRoom = action({
  args: {
    playerToken: v.string(),
    displayName: v.string(),
    startArticle: v.object({
      slug: v.string(),
      title: v.string(),
    }),
    targetArticle: v.object({
      slug: v.string(),
      title: v.string(),
    }),
  },
  handler: async (ctx, args): Promise<{ code: string }> => {
    const { startPreview, startCache, targetPreview, targetCache } =
      await resolveSetupArticles(args.startArticle, args.targetArticle);

    await Promise.all([
      ctx.runMutation(api.articles.upsertArticle, startCache),
      ctx.runMutation(api.articles.upsertArticle, targetCache),
    ]);

    return await ctx.runMutation(api.races.createRoomResolved, {
      playerToken: args.playerToken,
      displayName: args.displayName.trim(),
      startSlug: startPreview.slug,
      startTitle: startPreview.title,
      targetSlug: targetPreview.slug,
      targetTitle: targetPreview.title,
    });
  },
});

export const updateRoomSetupResolved = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
    startSlug: v.string(),
    startTitle: v.string(),
    targetSlug: v.string(),
    targetTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room) {
      throw new Error("That room does not exist.");
    }

    if (room.status !== "lobby") {
      throw new Error("Room setup can only be changed before the countdown starts.");
    }

    if (room.hostPlayerToken !== args.playerToken) {
      throw new Error("Only the host can change the room setup.");
    }

    await ctx.db.patch(room._id, {
      startSlug: args.startSlug,
      startTitle: args.startTitle,
      targetSlug: args.targetSlug,
      targetTitle: args.targetTitle,
    });

    const participants = await listRoomParticipants(ctx, room._id);
    await Promise.all(
      participants.map((participant) =>
        ctx.db.patch(participant._id, {
          ready: false,
          currentArticleSlug: args.startSlug,
          currentArticleTitle: args.startTitle,
          path: [
            {
              slug: args.startSlug,
              title: args.startTitle,
            },
          ],
          clickCount: 0,
          finishedAt: undefined,
        }),
      ),
    );

    return { ok: true };
  },
});

export const updateRoomSetup = action({
  args: {
    code: v.string(),
    playerToken: v.string(),
    startArticle: v.object({
      slug: v.string(),
      title: v.string(),
    }),
    targetArticle: v.object({
      slug: v.string(),
      title: v.string(),
    }),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const { startPreview, startCache, targetPreview, targetCache } =
      await resolveSetupArticles(args.startArticle, args.targetArticle);

    await Promise.all([
      ctx.runMutation(api.articles.upsertArticle, startCache),
      ctx.runMutation(api.articles.upsertArticle, targetCache),
    ]);

    return await ctx.runMutation(api.races.updateRoomSetupResolved, {
      code: args.code,
      playerToken: args.playerToken,
      startSlug: startPreview.slug,
      startTitle: startPreview.title,
      targetSlug: targetPreview.slug,
      targetTitle: targetPreview.title,
    });
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room) {
      throw new Error("That room does not exist.");
    }

    const existing = await getParticipant(ctx, room._id, args.playerToken);
    if (existing) {
      if (existing.displayName !== args.displayName.trim()) {
        await ctx.db.patch(existing._id, { displayName: args.displayName.trim() });
      }

      return { role: existing.role };
    }

    const role = room.status === "lobby" ? "player" : "spectator";

    await ctx.db.insert("raceParticipants", {
      roomId: room._id,
      playerToken: args.playerToken,
      displayName: args.displayName.trim(),
      role,
      ready: false,
      currentArticleSlug: room.startSlug,
      currentArticleTitle: room.startTitle,
      path: [
        {
          slug: room.startSlug,
          title: room.startTitle,
        },
      ],
      clickCount: 0,
      joinedAt: Date.now(),
    });

    return { role };
  },
});

export const setReady = mutation({
  args: {
    code: v.string(),
    playerToken: v.string(),
    ready: v.boolean(),
  },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room) {
      throw new Error("That room does not exist.");
    }

    if (room.status !== "lobby") {
      return { started: true };
    }

    const participant = await getParticipant(ctx, room._id, args.playerToken);
    if (!participant || participant.role !== "player") {
      throw new Error("Only players in the lobby can change readiness.");
    }

    await ctx.db.patch(participant._id, { ready: args.ready });
    const updatedRoom = await maybeStartCountdown(ctx, room);

    return {
      started: updatedRoom.status === "countdown",
    };
  },
});

export const syncRaceStage = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room || room.status !== "countdown" || !room.countdownStartedAt) {
      return null;
    }

    if (Date.now() < room.countdownStartedAt + COUNTDOWN_MS) {
      return null;
    }

    await ctx.db.patch(room._id, {
      status: "racing",
      startedAt: room.startedAt ?? room.countdownStartedAt + COUNTDOWN_MS,
    });

    return { startedAt: room.countdownStartedAt + COUNTDOWN_MS };
  },
});

export const getNavigationContext = internalQuery({
  args: {
    code: v.string(),
    playerToken: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room) {
      return null;
    }

    const participant = await getParticipant(ctx, room._id, args.playerToken);
    if (!participant) {
      return null;
    }

    return {
      room,
      participant,
    };
  },
});

export const commitAdvance = internalMutation({
  args: {
    roomId: v.id("raceRooms"),
    playerToken: v.string(),
    fromSlug: v.string(),
    toSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new Error("That room no longer exists.");
    }

    const participant = await getParticipant(ctx, room._id, args.playerToken);
    if (!participant) {
      throw new Error("You are not part of this room.");
    }

    if (participant.role !== "player") {
      throw new Error("Spectators cannot move through the race.");
    }

    if (participant.currentArticleSlug !== args.fromSlug) {
      throw new Error("Your article changed before that move was applied.");
    }

    if (participant.finishedAt || room.status === "finished") {
      return { finished: true };
    }

    const countdownFinishedAt = room.countdownStartedAt
      ? room.countdownStartedAt + COUNTDOWN_MS
      : null;

    if (room.status === "lobby") {
      throw new Error("The race has not started yet.");
    }

    if (room.status === "countdown" && countdownFinishedAt && Date.now() < countdownFinishedAt) {
      throw new Error("Wait for the countdown to finish before moving.");
    }

    const article = await ctx.db
      .query("articles")
      .withIndex("by_slug", (query) => query.eq("slug", args.fromSlug))
      .unique();

    if (!article?.articleLinks) {
      throw new Error("That article is not ready for race validation yet.");
    }

    const nextLink = article.articleLinks.find((link) => link.slug === args.toSlug);
    if (!nextLink) {
      throw new Error("That move is not a valid inline article link from your current page.");
    }

    const now = Date.now();
    const nextPath = [
      ...participant.path,
      {
        slug: nextLink.slug,
        title: nextLink.title,
      },
    ];
    const clickCount = participant.clickCount + 1;

    await ctx.db.patch(participant._id, {
      currentArticleSlug: nextLink.slug,
      currentArticleTitle: nextLink.title,
      path: nextPath,
      clickCount,
      ...(nextLink.slug === room.targetSlug ? { finishedAt: now } : {}),
    });

    if (room.status === "countdown") {
      await ctx.db.patch(room._id, {
        status: "racing",
        startedAt: room.startedAt ?? countdownFinishedAt ?? now,
      });
    }

    if (nextLink.slug !== room.targetSlug) {
      return { finished: false };
    }

    const latestRoom = await ctx.db.get(room._id);
    if (!latestRoom || latestRoom.winnerParticipantId) {
      return { finished: true };
    }

    const startedAt = latestRoom.startedAt ?? countdownFinishedAt ?? now;

    await ctx.db.patch(room._id, {
      status: "finished",
      startedAt,
      finishedAt: now,
      winnerParticipantId: participant._id,
    });

    await ctx.db.insert("raceResults", {
      roomId: room._id,
      winnerName: participant.displayName,
      startSlug: room.startSlug,
      startTitle: room.startTitle,
      targetSlug: room.targetSlug,
      targetTitle: room.targetTitle,
      clickCount,
      timeMs: Math.max(now - startedAt, 0),
      createdAt: now,
    });

    return { finished: true };
  },
});

export const advanceParticipant = action({
  args: {
    code: v.string(),
    playerToken: v.string(),
    toSlug: v.string(),
  },
  handler: async (ctx, args): Promise<{ finished: boolean }> => {
    const context: { room: RaceRoom; participant: RaceParticipant } | null = await ctx.runQuery(
      internal.races.getNavigationContext,
      {
        code: args.code,
        playerToken: args.playerToken,
      },
    );

    if (!context) {
      throw new Error("You need to join the room before moving.");
    }

    const article = await ctx.runQuery(api.articles.getBySlug, {
      slug: context.participant.currentArticleSlug,
    });

    if (!article?.articleLinks) {
      await ctx.runMutation(api.articles.upsertArticle, await cacheInlineLinks(context.participant.currentArticleSlug));
    }

    return await ctx.runMutation(internal.races.commitAdvance, {
      roomId: context.room._id,
      playerToken: args.playerToken,
      fromSlug: context.participant.currentArticleSlug,
      toSlug: args.toSlug,
    });
  },
});
