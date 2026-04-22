"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/convex/_generated/api";
import { EncartaShell } from "@/components/shell/encarta-shell";
import { randomRacePairs, slugifyTitle } from "@/lib/race-pairs";
import { getLocalUser } from "@/lib/users";

type LeaderboardEntry = {
  _id: string;
  winnerName: string;
  startArticle: string;
  endArticle: string;
  clicks: number;
  timeMs: number;
};

export function RaceLobby() {
  const router = useRouter();
  const leaderboard = useQuery(api.leaderboard.topEntries, {});
  const createRoom = useMutation(api.rooms.createRoom);
  const [startArticle, setStartArticle] = useState("Lando Norris");
  const [endArticle, setEndArticle] = useState("Border Collie");
  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const pair = randomRacePairs[Math.floor(Math.random() * randomRacePairs.length)];
    setStartArticle(pair[0]);
    setEndArticle(pair[1]);
  }, []);

  const actions = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => {
            const pair = randomRacePairs[Math.floor(Math.random() * randomRacePairs.length)];
            setStartArticle(pair[0]);
            setEndArticle(pair[1]);
          }}
          className="bevel bg-panel px-4 py-2 font-bold"
        >
          Random Pair
        </button>
        <button
          type="button"
          onClick={async () => {
            setCreating(true);
            try {
              const user = getLocalUser();
              const code = await createRoom({
                startArticle: slugifyTitle(startArticle),
                endArticle: slugifyTitle(endArticle),
                displayName: user.name,
                userId: user.id,
              });
              router.push(`/race/${code}`);
            } finally {
              setCreating(false);
            }
          }}
          className="bevel bg-[#fff8dc] px-4 py-2 font-bold"
          disabled={creating}
        >
          {creating ? "Creating..." : "Create Room"}
        </button>
      </div>
    ),
    [createRoom, creating, endArticle, router, startArticle],
  );

  return (
    <EncartaShell title="Netcarta Race" subtitle="Create a room, share the URL, and send everyone through the Wikipedia link graph at the same time." actions={actions}>
      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[1.1fr,0.9fr] lg:p-8">
        <section className="space-y-6">
          <div className="border-2 border-black bg-[rgba(255,255,255,0.85)] p-6">
            <h2 className="font-body text-5xl text-[#111]">Set the challenge</h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#1f2937]">
              Hosts pick the opening article and the target article, then everyone joins via a shareable URL and begins on the same page.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-bold uppercase tracking-[0.25em] text-[#1d4b8f]">Start Article</span>
                <input value={startArticle} onChange={(event) => setStartArticle(event.target.value)} className="bevel-inset w-full bg-white px-3 py-3 text-lg" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold uppercase tracking-[0.25em] text-[#1d4b8f]">End Article</span>
                <input value={endArticle} onChange={(event) => setEndArticle(event.target.value)} className="bevel-inset w-full bg-white px-3 py-3 text-lg" />
              </label>
            </div>

            <div className="mt-8 border-2 border-black bg-[#0f172a] p-5 text-white">
              <div className="text-xs uppercase tracking-[0.4em] text-[#8adcdc]">Room Join</div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <input
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  className="bevel-inset min-w-0 flex-1 bg-white px-3 py-3 text-lg text-black"
                />
                <button
                  type="button"
                  onClick={() => roomCode && router.push(`/race/${roomCode}`)}
                  className="bevel bg-panel px-4 py-3 font-bold text-black"
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="border-2 border-black bg-black/85 p-5 text-white">
            <div className="text-xs uppercase tracking-[0.4em] text-[#8adcdc]">Demo Notes</div>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-[#d1d5db]">
              <li>1. Host creates the room and shares the link.</li>
              <li>2. Players join from desktop or phone with generated local names.</li>
              <li>3. The room flips to racing and every participant starts on the same article.</li>
              <li>4. First to hit the target wins and writes an entry to the leaderboard.</li>
            </ol>
          </div>

          <div className="border-2 border-black bg-[rgba(255,255,255,0.8)] p-5">
            <div className="bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">Leaderboard</div>
            <div className="mt-4 space-y-3 text-sm">
              {leaderboard === undefined ? <div>Loading leaderboard...</div> : null}
              {leaderboard?.map((entry: LeaderboardEntry, index: number) => (
                <div key={entry._id} className="bevel flex items-center justify-between bg-[#fff8dc] px-3 py-3">
                  <div>
                    <div className="font-bold">#{index + 1} {entry.winnerName}</div>
                    <div className="text-xs text-[#4b5563]">
                      {entry.startArticle.replaceAll("_", " ")} to {entry.endArticle.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div>{Math.round(entry.timeMs / 1000)}s</div>
                    <div>{entry.clicks} clicks</div>
                  </div>
                </div>
              ))}
              {leaderboard?.length === 0 ? <div>No races recorded yet.</div> : null}
            </div>
          </div>
        </section>
      </div>
    </EncartaShell>
  );
}
