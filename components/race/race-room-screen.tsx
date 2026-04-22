"use client";

import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RaceArticlePicker } from "@/components/race/race-article-picker";
import { RaceArticleViewer } from "@/components/race/race-article-viewer";
import { useRaceIdentity } from "@/components/race/use-race-identity";
import { EncartaShell } from "@/components/shell/encarta-shell";
import type { ArticlePreview } from "@/lib/types";

function formatCountdown(countdownStartedAt: number, now: number) {
  const remaining = 5 - Math.floor((now - countdownStartedAt) / 1000);
  return Math.max(remaining, 0);
}

export function RaceRoomScreen({ code }: { code: string }) {
  const normalizedCode = code.toUpperCase();
  const { playerToken, displayName, setDisplayName, isHydrated } = useRaceIdentity();
  const roomView = useQuery(api.races.getRoomView, {
    code: normalizedCode,
    playerToken: playerToken ?? undefined,
  });
  const joinRoom = useMutation(api.races.joinRoom);
  const setReady = useMutation(api.races.setReady);
  const syncRaceStage = useMutation(api.races.syncRaceStage);
  const setFollowTarget = useMutation(api.races.setFollowTarget);
  const advanceParticipant = useAction(api.races.advanceParticipant);
  const updateRoomSetup = useAction(api.races.updateRoomSetup);
  const [joinState, setJoinState] = useState<"idle" | "joining">("idle");
  const [setupState, setSetupState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [selectedParticipantId, setSelectedParticipantId] = useState<Id<"raceParticipants"> | null>(null);
  const [isWinnerOverlayDismissed, setIsWinnerOverlayDismissed] = useState(false);
  const [joinName, setJoinName] = useState(displayName);
  const [startArticle, setStartArticle] = useState<ArticlePreview | null>(null);
  const [targetArticle, setTargetArticle] = useState<ArticlePreview | null>(null);
  const syncedFollowTargetRef = useRef<Id<"raceParticipants"> | null>(null);
  const room = roomView?.room;
  const roomStartSlug = room?.startSlug;
  const roomStartTitle = room?.startTitle;
  const roomTargetSlug = room?.targetSlug;
  const roomTargetTitle = room?.targetTitle;

  useEffect(() => {
    setJoinName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (roomView?.room.status === "finished" && roomView.winner?._id) {
      setIsWinnerOverlayDismissed(false);
    }
  }, [roomView?.room.status, roomView?.winner?._id]);

  useEffect(() => {
    if (!roomStartSlug || !roomStartTitle || !roomTargetSlug || !roomTargetTitle) {
      return;
    }

    setStartArticle({
      slug: roomStartSlug,
      title: roomStartTitle,
    });
    setTargetArticle({
      slug: roomTargetSlug,
      title: roomTargetTitle,
    });
  }, [roomStartSlug, roomStartTitle, roomTargetSlug, roomTargetTitle]);

  useEffect(() => {
    if (roomView?.room.status !== "countdown" || !roomView.room.countdownStartedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, [roomView?.room.countdownStartedAt, roomView?.room.status]);

  useEffect(() => {
    if (roomView?.room.status !== "countdown" || !roomView.room.countdownStartedAt) {
      return;
    }

    if (formatCountdown(roomView.room.countdownStartedAt, now) > 0) {
      return;
    }

    void syncRaceStage({ code: normalizedCode });
  }, [normalizedCode, now, roomView?.room.countdownStartedAt, roomView?.room.status, syncRaceStage]);

  useEffect(() => {
    if (!roomView?.self || roomView.self.role !== "spectator") {
      syncedFollowTargetRef.current = null;
      setSelectedParticipantId(null);
      return;
    }

    if (
      selectedParticipantId &&
      roomView.players.some((player) => player._id === selectedParticipantId)
    ) {
      return;
    }

    setSelectedParticipantId(roomView.winner?._id ?? roomView.players[0]?._id ?? null);
  }, [roomView, selectedParticipantId]);

  useEffect(() => {
    if (!playerToken || !roomView?.self || roomView.self.role !== "spectator" || !selectedParticipantId) {
      return;
    }

    if (syncedFollowTargetRef.current === selectedParticipantId) {
      return;
    }

    syncedFollowTargetRef.current = selectedParticipantId;
    void setFollowTarget({
      code: normalizedCode,
      playerToken,
      followingParticipantId: selectedParticipantId,
    }).catch((cause) => {
      syncedFollowTargetRef.current = null;
      setError(cause instanceof Error ? cause.message : "Could not follow that player live.");
    });
  }, [normalizedCode, playerToken, roomView?.self, selectedParticipantId, setFollowTarget]);

  const countdownValue =
    roomView?.room.status === "countdown" && roomView.room.countdownStartedAt
      ? formatCountdown(roomView.room.countdownStartedAt, now)
      : null;

  const viewedParticipant = useMemo(() => {
    if (!roomView) {
      return null;
    }

    if (roomView.self?.role === "spectator") {
      return (
        roomView.players.find((player) => player._id === selectedParticipantId) ??
        roomView.winner ??
        roomView.players[0] ??
        null
      );
    }

    return roomView.self;
  }, [roomView, selectedParticipantId]);

  const followTargetParticipantId =
    roomView?.self?.role === "spectator"
      ? selectedParticipantId
      : roomView?.self?.role === "player"
        ? roomView.self._id
        : null;

  const followView = useQuery(
    api.races.getFollowView,
    playerToken && followTargetParticipantId
      ? {
          code: normalizedCode,
          playerToken,
          targetParticipantId: followTargetParticipantId,
        }
      : "skip",
  );

  const isSpectator = roomView?.self?.role === "spectator";

  const getPlayerStatusMeta = (player: { _id: string; ready: boolean; finishedAt?: number }) => {
    const isWinner = roomView?.winner?._id === player._id;

    if (isWinner) {
      return {
        label: "winner",
        className: "bg-[#fff3b7] text-[#7c2d12]",
      };
    }

    if (player.finishedAt) {
      return {
        label: "finished",
        className: "bg-[#dcfce7] text-[#166534]",
      };
    }

    if (room?.status === "racing") {
      return {
        label: "racing",
        className: "bg-[#dbeafe] text-[#1d4ed8]",
      };
    }

    if (player.ready) {
      return {
        label: "ready",
        className: "bg-[#d8f3dc] text-[#166534]",
      };
    }

    return {
      label: "waiting",
      className: "bg-[#eef2ff] text-[#475569]",
    };
  };

  const navigationLocked = useMemo(() => {
    if (!roomView?.self || roomView.self.role !== "player") {
      return true;
    }

    if (roomView.room.status === "finished") {
      return true;
    }

    if (roomView.room.status === "countdown") {
      return countdownValue !== 0;
    }

    return roomView.room.status !== "racing";
  }, [countdownValue, roomView]);

  const statusRight =
    roomView?.room.status === "finished"
      ? `${roomView.winner?.displayName ?? "A player"} won`
      : roomView?.room.status === "countdown"
        ? countdownValue === 0
          ? "Go"
          : `Starting in ${countdownValue}`
        : roomView?.room.status === "racing"
          ? "Race live"
          : "Lobby ready";

  if (roomView === null) {
    return (
      <EncartaShell title="Race Room" subtitle={`Room ${normalizedCode}`}>
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="border-2 border-black bg-[#fff2d8] px-6 py-5 text-lg">
            Room `{normalizedCode}` was not found.
          </div>
        </div>
      </EncartaShell>
    );
  }

  if (!roomView) {
    return (
      <EncartaShell title="Race Room" subtitle={`Room ${normalizedCode}`}>
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="bevel-inset bg-white px-6 py-5 text-lg">Loading race room...</div>
        </div>
      </EncartaShell>
    );
  }

  const needsExplicitJoin = isHydrated && !roomView.self;
  const isHost = roomView.self?.playerToken === roomView.room.hostPlayerToken;
  const canEditSetup = isHost && roomView.room.status === "lobby";
  const joinRole = roomView.room.status === "lobby" ? "player" : "spectator";
  const followedParticipant = viewedParticipant?.role === "player" ? viewedParticipant : null;

  const submitJoin = () => {
    if (!playerToken || !joinName.trim()) {
      setError("Enter your name before joining the session.");
      return;
    }

    setJoinState("joining");
    setError(null);
    setDisplayName(joinName.trim());

    void joinRoom({
      code: normalizedCode,
      playerToken,
      displayName: joinName.trim(),
    })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not join the room.");
      })
      .finally(() => {
        setJoinState("idle");
      });
  };

  return (
    <EncartaShell
      title={`Race ${normalizedCode}`}
      subtitle={`${roomView.room.startTitle} to ${roomView.room.targetTitle}`}
      statusLeft={roomView.self ? `${roomView.self.displayName} · ${roomView.self.role}` : "Not joined yet"}
      statusRight={statusRight}
      actions={
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/race" className="bevel bg-panel px-4 py-2 font-bold">
            Back To Lobby
          </Link>
          <div className="bevel-inset bg-white px-4 py-2">Room code: {normalizedCode}</div>
          <div className="bevel-inset bg-white px-4 py-2">Target: {roomView.room.targetTitle}</div>
        </div>
      }
      sidebar={
        <div className="space-y-4 text-sm">
          <div className="bevel-inset bg-black px-3 py-4 text-white">
            <div className="text-xs uppercase tracking-[0.3em] text-[#8dd3d3]">Netcarta Race</div>
            <h1 className="mt-2 text-3xl font-semibold">{normalizedCode}</h1>
            <p className="mt-3 text-sm leading-5 text-[#d4d4d4]">
              {roomView.room.startTitle} to {roomView.room.targetTitle}
            </p>
          </div>

          {needsExplicitJoin ? (
            <section>
              <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">Join Room</div>
              <form
                className="space-y-3 px-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitJoin();
                }}
              >
                <input
                  type="text"
                  value={joinName}
                  onChange={(event) => setJoinName(event.target.value)}
                  placeholder="Enter your name to join this session"
                  className="bevel-inset w-full bg-white px-3 py-2 outline-none"
                />
                <button
                  type="submit"
                  disabled={joinState === "joining" || !joinName.trim()}
                  className="bevel bg-panel px-4 py-2 font-bold disabled:text-[#6b7280]"
                >
                  {joinState === "joining" ? "Joining Session..." : "Join Session"}
                </button>
                <div className="text-xs text-[#475569]">
                  {joinRole === "player"
                    ? "Join before the countdown starts to enter as a player."
                    : "This session has already started. Join now to watch as a spectator."}
                </div>
              </form>
            </section>
          ) : null}

          {canEditSetup ? (
            <section>
              <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">Room Setup</div>
              <form
                className="space-y-3 px-2"
                onSubmit={(event) => {
                  event.preventDefault();

                  if (!playerToken || !startArticle || !targetArticle) {
                    setError("Choose both the initial and final article from the search results.");
                    return;
                  }

                  setSetupState("saving");
                  setError(null);

                  void updateRoomSetup({
                    code: normalizedCode,
                    playerToken,
                    startArticle,
                    targetArticle,
                  })
                    .catch((cause) => {
                      setError(cause instanceof Error ? cause.message : "Could not update the room setup.");
                    })
                    .finally(() => {
                      setSetupState("idle");
                    });
                }}
              >
                <RaceArticlePicker
                  label="Initial Article"
                  placeholder="Search for the opening article"
                  selectedArticle={startArticle}
                  onSelect={setStartArticle}
                />
                <RaceArticlePicker
                  label="Final Article"
                  placeholder="Search for the destination article"
                  selectedArticle={targetArticle}
                  onSelect={setTargetArticle}
                />
                <button
                  type="submit"
                  disabled={setupState === "saving" || !startArticle || !targetArticle}
                  className="bevel bg-panel px-4 py-2 font-bold disabled:text-[#6b7280]"
                >
                  {setupState === "saving" ? "Saving Articles..." : "Save Articles"}
                </button>
                <div className="text-xs text-[#475569]">
                  Saving resets every player back to the initial article and clears ready states.
                </div>
              </form>
            </section>
          ) : null}

          <section>
            <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">Players</div>
            <div className="space-y-2 px-2">
              {roomView.players.map((player) => {
                const isWatching = roomView.self?.role === "spectator" && selectedParticipantId === player._id;
                const playerStatus = getPlayerStatusMeta(player);

                return (
                  <button
                    key={player._id}
                    type="button"
                    onClick={() => {
                      if (roomView.self?.role === "spectator") {
                        setSelectedParticipantId(player._id);
                      }
                    }}
                    className={`bevel w-full px-3 py-3 text-left ${isWatching ? "bg-[#fff3b7]" : "bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">{player.displayName}</span>
                      <span
                        className={`rounded-sm px-2 py-1 text-xs uppercase tracking-[0.2em] ${playerStatus.className}`}
                      >
                        {playerStatus.label}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-[#334155]">{player.currentArticleTitle}</div>
                    <div className="mt-1 text-xs text-[#64748b]">
                      {player.clickCount} clicks · {player.path.length} articles visited
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {roomView.spectators.length > 0 ? (
            <section>
              <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">Spectators</div>
              <div className="space-y-2 px-2">
                {roomView.spectators.map((spectator) => (
                  <div key={spectator._id} className="bevel bg-[#f5f5f5] px-3 py-2">
                    {spectator.displayName}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {roomView.self?.role === "player" && roomView.room.status === "lobby" ? (
            <section>
              <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">Ready Check</div>
              <div className="space-y-3 px-2">
                <p>Every player needs to mark ready before the five-second countdown begins.</p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    void setReady({
                      code: normalizedCode,
                      playerToken: playerToken!,
                      ready: !roomView.self?.ready,
                    }).catch((cause) => {
                      setError(cause instanceof Error ? cause.message : "Could not update readiness.");
                    });
                  }}
                  className="bevel bg-panel px-4 py-2 font-bold"
                >
                  {roomView.self.ready ? "Not Ready" : "Mark Ready"}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      }
    >
      <div className="relative flex-1 p-6 lg:p-8">
        {error ? <div className="mb-5 text-sm text-[#7c2d12]">{error}</div> : null}

        {roomView.room.status === "countdown" && countdownValue !== null ? (
          <div className="mb-6 border-2 border-black bg-[#fff3b7] px-5 py-4 text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-[#92400e]">Countdown</div>
            <div className="font-body text-6xl text-[#111]">{countdownValue === 0 ? "Go" : countdownValue}</div>
          </div>
        ) : null}

        {roomView.room.status === "finished" && roomView.winner ? (
          <>
            {!isWinnerOverlayDismissed ? (
              <div className="winner-overlay">
                <div className="winner-panel scanlines">
                  <div className="winner-marquee">
                    <div className="winner-marquee-track">
                      <span>Netcarta Champion</span>
                      <span>Session Complete</span>
                      <span>{roomView.winner.displayName} Wins</span>
                      <span>Destination Reached</span>
                      <span>Netcarta Champion</span>
                      <span>Session Complete</span>
                      <span>{roomView.winner.displayName} Wins</span>
                      <span>Destination Reached</span>
                    </div>
                  </div>

                  <div className="space-y-5 p-6 text-center md:p-8">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsWinnerOverlayDismissed(true)}
                        className="bevel bg-panel px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-black"
                      >
                        Close
                      </button>
                    </div>
                    <div className="text-xs uppercase tracking-[0.45em] text-[#1d4b8f]">Race Complete</div>
                    <div className="font-body text-5xl leading-none text-[#111] md:text-7xl">
                      {roomView.winner.displayName}
                    </div>
                    <div className="text-xl font-bold uppercase tracking-[0.28em] text-[#7c2d12] md:text-2xl">
                      Wins The Room
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="bevel-inset bg-white px-4 py-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-[#64748b]">Destination</div>
                        <div className="mt-2 text-lg font-bold text-[#111]">{roomView.room.targetTitle}</div>
                      </div>
                      <div className="bevel-inset bg-white px-4 py-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-[#64748b]">Clicks</div>
                        <div className="mt-2 text-3xl font-bold text-[#111]">{roomView.winner.clickCount}</div>
                      </div>
                      <div className="bevel-inset bg-white px-4 py-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-[#64748b]">Articles Visited</div>
                        <div className="mt-2 text-3xl font-bold text-[#111]">{roomView.winner.path.length}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mb-6 border-2 border-black bg-[#fff3b7] px-5 py-4">
              <div className="text-xs uppercase tracking-[0.3em] text-[#92400e]">Winner</div>
              <div className="mt-2 font-body text-4xl text-[#111]">{roomView.winner.displayName}</div>
              <div className="mt-2 text-sm text-[#334155]">
                Reached {roomView.room.targetTitle} in {roomView.winner.clickCount} clicks.
              </div>
            </div>
          </>
        ) : null}

        {needsExplicitJoin ? (
          <div className="border-2 border-black bg-[rgba(255,255,255,0.88)] p-8">
            <div className="mx-auto max-w-xl">
              <div className="text-xs uppercase tracking-[0.4em] text-[#1d4b8f]">Join Session</div>
              <h2 className="mt-3 font-body text-5xl text-[#111]">
                {joinRole === "player" ? "Enter your name" : "Join as spectator"}
              </h2>
              <p className="mt-4 text-lg leading-8 text-[#334155]">
                {joinRole === "player" ? (
                  <>
                    Join room <b>{normalizedCode}</b> to race from <b>{roomView.room.startTitle}</b> to{" "}
                    <b>{roomView.room.targetTitle}</b>.
                  </>
                ) : (
                  <>
                    This session has already started. Enter your name and join room <b>{normalizedCode}</b> as a spectator to follow the player live.
                  </>
                )}
              </p>

              <form
                className="mt-8 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitJoin();
                }}
              >
                <label className="block text-sm font-bold">
                  Your Name
                  <input
                    type="text"
                    value={joinName}
                    onChange={(event) => setJoinName(event.target.value)}
                    placeholder="Your name"
                    className="bevel-inset mt-2 w-full bg-white px-3 py-3 text-base outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={joinState === "joining" || !joinName.trim()}
                  className="bevel bg-panel px-5 py-3 font-bold disabled:text-[#6b7280]"
                >
                  {joinState === "joining"
                    ? joinRole === "player"
                      ? "Joining Session..."
                      : "Joining As Spectator..."
                    : joinRole === "player"
                      ? "Join This Session"
                      : "Join As Spectator"}
                </button>
              </form>
            </div>
          </div>
        ) : viewedParticipant && roomView.self && playerToken ? (
          <div className="space-y-6">
            {isSpectator ? (
              <div className="grid gap-4 xl:grid-cols-[1.25fr,0.75fr]">
                <div className="border-2 border-black bg-[rgba(255,255,255,0.88)] p-6">
                  <div className="text-xs uppercase tracking-[0.35em] text-[#1d4b8f]">Spectator Sync</div>
                  <h2 className="mt-3 font-body text-5xl text-[#111]">Following {followedParticipant?.displayName}</h2>
                  <p className="mt-4 text-lg leading-8 text-[#334155]">
                    The player governs article changes and scroll. Your cursor is visible to the player, and every article click becomes a live suggestion pulse.
                  </p>
                </div>

                <div className="border-2 border-black bg-[rgba(255,248,220,0.86)] p-5">
                  <div className="bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">Followed Player</div>
                  <div className="mt-4 space-y-3">
                    <div className="bevel-inset bg-white px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#64748b]">Current Article</div>
                      <div className="mt-1 text-lg font-bold text-[#111]">{followedParticipant?.currentArticleTitle}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bevel-inset bg-white px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-[#64748b]">Clicks</div>
                        <div className="mt-1 text-2xl font-bold text-[#111]">{followedParticipant?.clickCount ?? 0}</div>
                      </div>
                      <div className="bevel-inset bg-white px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-[#64748b]">Visited</div>
                        <div className="mt-1 text-2xl font-bold text-[#111]">{followedParticipant?.path.length ?? 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <RaceArticleViewer
              code={normalizedCode}
              playerToken={playerToken}
              viewerParticipantId={roomView.self._id}
              viewerDisplayName={roomView.self.displayName}
              mode={isSpectator ? "spectator" : "player"}
              slug={viewedParticipant.currentArticleSlug}
              targetTitle={roomView.room.targetTitle}
              navigationLocked={navigationLocked || isSpectator}
              followingParticipantId={isSpectator ? followedParticipant?._id ?? null : null}
              followedParticipantId={isSpectator ? followedParticipant?._id ?? null : null}
              followedParticipantName={isSpectator ? followedParticipant?.displayName ?? null : null}
              remotePlayerPresence={isSpectator ? followView?.targetPresence ?? null : null}
              spectatorPresences={!isSpectator ? followView?.followerPresences ?? [] : []}
              recentSuggestions={!isSpectator ? followView?.recentSuggestions ?? [] : []}
              onError={(message) => setError(message)}
              onNavigate={(nextSlug) => {
                setError(null);

                void advanceParticipant({
                  code: normalizedCode,
                  playerToken,
                  toSlug: nextSlug,
                }).catch((cause) => {
                  setError(cause instanceof Error ? cause.message : "Could not move to that article.");
                });
              }}
            />

            {isSpectator ? (
              <details className="border-2 border-black bg-[rgba(255,255,255,0.88)] px-5 py-4">
                <summary className="cursor-pointer list-none font-bold text-[#111]">
                  Followed Player Click History
                </summary>
                <div className="mt-4 space-y-2 border-t border-black/15 pt-4 text-sm">
                  {followedParticipant?.path.map((step, index) => (
                    <div
                      key={`${followedParticipant._id}-${step.slug}-${index}`}
                      className="bevel-inset flex items-start gap-3 bg-white px-3 py-2"
                    >
                      <div className="min-w-10 text-xs font-bold uppercase tracking-[0.2em] text-[#64748b]">
                        {index === 0 ? "Start" : `#${index}`}
                      </div>
                      <div className="font-medium text-[#1f2937]">{step.title}</div>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : (
          <div className="border-2 border-black bg-[rgba(255,255,255,0.82)] p-6 text-lg">
            Waiting for a player to join this room.
          </div>
        )}
      </div>
    </EncartaShell>
  );
}
