"use client";

import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/convex/_generated/api";
import { EncartaShell } from "@/components/shell/encarta-shell";
import { getLocalUser } from "@/lib/users";

type Participant = {
  _id: string;
  displayName: string;
  userId: string;
  currentArticle: string;
  path: string[];
  clickCount: number;
  finished: boolean;
};

type RelatedArticle = {
  slug: string;
  title: string;
};

function formatDuration(startedAt?: number, finishedAt?: number) {
  if (!startedAt) {
    return "00:00";
  }

  const elapsed = (finishedAt ?? Date.now()) - startedAt;
  const totalSeconds = Math.max(0, Math.floor(elapsed / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function RaceRoom({ code }: { code: string }) {
  const roomState = useQuery(api.rooms.getRoomState, { code });
  const joinRoom = useMutation(api.rooms.joinRoom);
  const startRoom = useMutation(api.rooms.startRace);
  const navigateRoom = useMutation(api.rooms.navigateParticipant);
  const fetchArticle = useAction((api as any).wikipedia.fetchAndCacheArticle);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const user = useMemo(() => (typeof window === "undefined" ? null : getLocalUser()), []);
  const selfParticipant = user
    ? roomState?.participants.find((participant: Participant) => participant.userId === user.id)
    : undefined;
  const currentSlug = selfParticipant?.currentArticle ?? roomState?.room.startArticle;
  const article = useQuery(api.articles.getBySlug, currentSlug ? { slug: currentSlug } : "skip");

  useEffect(() => {
    if (!code || !user || roomState === undefined || selfParticipant) {
      return;
    }

    setJoining(true);
    void joinRoom({ code, userId: user.id, displayName: user.name }).finally(() => setJoining(false));
  }, [code, joinRoom, roomState, selfParticipant, user]);

  useEffect(() => {
    if (roomState?.room.status !== "racing" || roomState.room.finishedAt) {
      return;
    }

    const timerId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [roomState?.room.finishedAt, roomState?.room.status]);

  useEffect(() => {
    if (!currentSlug || article !== null || article === undefined) {
      return;
    }

    void fetchArticle({ slug: currentSlug });
  }, [article, currentSlug, fetchArticle]);

  useEffect(() => {
    const targets = new Set<string>();
    if (roomState?.room.startArticle) {
      targets.add(roomState.room.startArticle);
    }
    if (roomState?.room.endArticle) {
      targets.add(roomState.room.endArticle);
    }
    if (roomState?.self?.currentArticle) {
      targets.add(roomState.self.currentArticle);
    }

    targets.forEach((slug) => {
      void fetchArticle({ slug });
    });
  }, [fetchArticle, roomState?.room.endArticle, roomState?.room.startArticle, roomState?.self?.currentArticle]);

  const actions = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          className="bevel bg-panel px-4 py-2 font-bold"
        >
          {copied ? "Copied" : "Copy Join URL"}
        </button>
        {roomState?.room.status === "lobby" ? (
          <button
            type="button"
            onClick={() => startRoom({ code })}
            className="bevel bg-[#fff8dc] px-4 py-2 font-bold"
          >
            Start Race
          </button>
        ) : null}
        <div className="bevel-inset bg-white px-4 py-2">Room Code: {code}</div>
      </div>
    ),
    [code, copied, roomState?.room.status, startRoom],
  );

  if (roomState === undefined || joining) {
    return (
      <EncartaShell title="Race Room" subtitle="Joining the room..." actions={actions}>
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="bevel-inset bg-white px-6 py-5 text-lg">Connecting to Convex room state...</div>
        </div>
      </EncartaShell>
    );
  }

  if (roomState === null) {
    return (
      <EncartaShell title="Race Room" subtitle="This room code does not exist." actions={actions}>
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="border-2 border-black bg-[#fff2d8] px-6 py-5 text-lg">
            Room not found. Head back to the <Link href="/race" className="underline">race lobby</Link> and create a new one.
          </div>
        </div>
      </EncartaShell>
    );
  }

  return (
    <EncartaShell
      title={`Race ${code}`}
      subtitle={`Target article: ${roomState.room.endArticle.replaceAll("_", " ")}`}
      actions={actions}
    >
      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[1.15fr,0.85fr] lg:p-8">
        <section className="space-y-6">
          <div className="border-2 border-black bg-[rgba(255,255,255,0.84)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-[#1d4b8f]">Current Article</div>
                <h2 className="font-body mt-2 text-5xl text-[#111]">
                  {(article?.title ?? currentSlug ?? "Waiting").replaceAll("_", " ")}
                </h2>
              </div>
              <div className="border-2 border-black bg-black px-4 py-3 text-center text-white">
                <div className="text-xs uppercase tracking-[0.3em] text-[#8adcdc]">Timer</div>
                <div className="mt-2 text-3xl font-bold">
                  {formatDuration(roomState.room.startedAt, roomState.room.finishedAt ?? now)}
                </div>
              </div>
            </div>

            <div className="article-body mt-6 text-[18px] leading-8 text-[#1f2937]">
              {article?.summary ? (
                article.summary.split("\n").map((paragraph: string, index: number) => (
                  <p key={`${paragraph.slice(0, 20)}-${index}`} className="mb-4">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p>Waiting for article cache...</p>
              )}
            </div>
          </div>

          <div className="border-2 border-black bg-black/90 p-5 text-white">
            <div className="text-xs uppercase tracking-[0.45em] text-[#8adcdc]">See Also</div>
            <div className="mt-4 grid gap-3">
              {article?.seeAlso.map((item: RelatedArticle) => {
                const disabled = roomState.room.status !== "racing" || !selfParticipant;

                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => navigateRoom({ code, userId: selfParticipant!.userId, nextArticle: item.slug })}
                    disabled={disabled}
                    className="bevel bg-[#d7d7d7] px-4 py-3 text-left text-lg font-semibold text-black disabled:opacity-50"
                  >
                    {item.title}
                  </button>
                );
              })}
              {article?.seeAlso.length === 0 ? <div className="text-sm text-[#d1d5db]">No linked navigation targets found yet.</div> : null}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="border-2 border-black bg-[rgba(255,255,255,0.82)] p-5">
            <div className="bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">Presence</div>
            <div className="mt-4 flex flex-wrap gap-3">
              {roomState.participants.map((participant: Participant) => (
                <div key={participant._id} className="bevel bg-[#fff8dc] px-3 py-2 text-sm">
                  <div className="font-bold">{participant.displayName}</div>
                  <div>{participant.currentArticle.replaceAll("_", " ")}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-2 border-black bg-[rgba(255,255,255,0.82)] p-5">
            <div className="bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">Race Status</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="bevel flex items-center justify-between bg-[#fff8dc] px-3 py-3">
                <span>Start</span>
                <span>{roomState.room.startArticle.replaceAll("_", " ")}</span>
              </div>
              <div className="bevel flex items-center justify-between bg-[#fff8dc] px-3 py-3">
                <span>Target</span>
                <span>{roomState.room.endArticle.replaceAll("_", " ")}</span>
              </div>
              <div className="bevel flex items-center justify-between bg-[#fff8dc] px-3 py-3">
                <span>Status</span>
                <span className="capitalize">{roomState.room.status}</span>
              </div>
            </div>
          </div>

          <div className="border-2 border-black bg-[rgba(0,0,0,0.88)] p-5 text-white">
            <div className="text-xs uppercase tracking-[0.4em] text-[#8adcdc]">Paths</div>
            <div className="mt-4 space-y-3 text-sm">
              {roomState.participants.map((participant: Participant) => {
                const scenicRoute = roomState.room.status === "finished" && !participant.finished;
                return (
                  <div key={participant._id} className="border border-white/30 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">{participant.displayName}</span>
                      <span>{participant.clickCount} clicks</span>
                    </div>
                    <div className="mt-2 text-[#d1d5db]">{participant.path.join(" -> ").replaceAll("_", " ")}</div>
                    {scenicRoute ? <div className="mt-2 text-[#ffe59a]">The Scenic Route</div> : null}
                  </div>
                );
              })}
            </div>
          </div>

          {roomState.room.status === "finished" && roomState.leaderboardEntry ? (
            <div className="border-2 border-black bg-[#fff2d8] p-5">
              <div className="text-xs uppercase tracking-[0.35em] text-[#1d4b8f]">Winner</div>
              <div className="mt-3 text-3xl font-bold">{roomState.leaderboardEntry.winnerName}</div>
              <div className="mt-2 text-sm text-[#4b5563]">
                {Math.round(roomState.leaderboardEntry.timeMs / 1000)} seconds, {roomState.leaderboardEntry.clicks} clicks.
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </EncartaShell>
  );
}
