"use client";

import { useAction, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import { EncartaShell } from "@/components/shell/encarta-shell";
import { useRaceIdentity } from "@/components/race/use-race-identity";

type RecentRaceResult = {
  _id: string;
  winnerName: string;
  startTitle: string;
  targetTitle: string;
  timeMs: number;
  clickCount: number;
};

export function RaceHubScreen() {
  const router = useRouter();
  const { playerToken, displayName, setDisplayName, isHydrated } = useRaceIdentity();
  const createRoom = useAction(api.races.createRoom);
  const recentResults = useQuery(api.races.listRecentResults, {});
  const [startQuery, setStartQuery] = useState("Lando Norris");
  const [targetQuery, setTargetQuery] = useState("Border Collie");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recentRaceResults = recentResults as RecentRaceResult[] | undefined;

  const canCreate = isHydrated && Boolean(playerToken) && displayName.trim();

  return (
    <EncartaShell
      title="Race"
      subtitle="Create a room, wait for every player to ready up, then sprint through inline article links."
      statusRight={isCreating ? "Allocating room..." : "Race lobby ready"}
    >
      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[1.15fr,0.85fr] lg:p-8">
        <section className="space-y-6">
          <div className="border-2 border-black bg-[rgba(255,255,255,0.82)] p-6">
            <div className="mb-4 bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">
              Create A Race Room
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();

                if (!playerToken || !displayName.trim()) {
                  setError("Enter your display name before creating a room.");
                  return;
                }

                setIsCreating(true);
                setError(null);

                void createRoom({
                  playerToken,
                  displayName: displayName.trim(),
                  startQuery,
                  targetQuery,
                })
                  .then(({ code }) => {
                    router.push(`/race/${code}`);
                  })
                  .catch((cause) => {
                    setError(cause instanceof Error ? cause.message : "Could not create the room.");
                    setIsCreating(false);
                  });
              }}
            >
              <label className="block text-sm font-bold">
                Your Name
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Enter your display name"
                  className="bevel-inset mt-2 w-full bg-white px-3 py-2 text-base outline-none"
                />
              </label>

              <label className="block text-sm font-bold">
                Starting Article
                <input
                  type="text"
                  value={startQuery}
                  onChange={(event) => setStartQuery(event.target.value)}
                  placeholder="Lando Norris"
                  className="bevel-inset mt-2 w-full bg-white px-3 py-2 text-base outline-none"
                />
              </label>

              <label className="block text-sm font-bold">
                Destination Article
                <input
                  type="text"
                  value={targetQuery}
                  onChange={(event) => setTargetQuery(event.target.value)}
                  placeholder="Border Collie"
                  className="bevel-inset mt-2 w-full bg-white px-3 py-2 text-base outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={!canCreate || isCreating}
                className="bevel bg-panel px-5 py-3 font-bold disabled:text-[#6b7280]"
              >
                {isCreating ? "Creating Room..." : "Create Room"}
              </button>
            </form>

            {error ? <p className="mt-4 text-sm text-[#7c2d12]">{error}</p> : null}
          </div>

          <div
            id="join-existing-room"
            className="border-2 border-black bg-[rgba(255,248,220,0.86)] p-6"
          >
            <div className="mb-4 bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">Join Existing Room</div>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                setError(null);
                router.push(`/race/${joinCode.trim().toUpperCase()}`);
              }}
            >
              <label className="block flex-1 text-sm font-bold">
                Room Code
                <input
                  type="text"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.replace(/\s+/g, "").toUpperCase())}
                  placeholder="ABC123"
                  className="bevel-inset mt-2 w-full bg-white px-3 py-2 text-base uppercase outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="bevel bg-panel px-5 py-3 font-bold disabled:text-[#6b7280]"
              >
                Open Room
              </button>
            </form>
          </div>
        </section>

        <section className="space-y-6">
          <div className="border-2 border-black bg-black/90 p-5 text-white">
            <div className="text-sm uppercase tracking-[0.35em] text-[#9ad7d7]">
              How It Works
            </div>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-[#d1d5db]">
              <li>1. Everyone joins the same room URL.</li>
              <li>2. Every player marks ready.</li>
              <li>3. Netcarta counts down from 5 to 1.</li>
              <li>4. Players move only through inline article links.</li>
              <li>5. First player to reach the destination wins.</li>
            </ol>
          </div>

          <div className="border-2 border-black bg-[rgba(255,255,255,0.75)] p-5">
            <div className="bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">
              Recent Winners
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {recentRaceResults === undefined ? <div>Loading scoreboard...</div> : null}
              {recentRaceResults?.length === 0 ? (
                <div className="text-[#475569]">No completed races yet.</div>
              ) : null}
              {recentRaceResults?.map((result) => (
                <div key={result._id} className="bevel-inset bg-white px-3 py-3">
                  <div className="font-bold">{result.winnerName}</div>
                  <div className="mt-1 text-[#334155]">
                    {result.startTitle} to {result.targetTitle}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[#64748b]">
                    {Math.max(Math.round(result.timeMs / 1000), 1)}s · {result.clickCount} clicks
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </EncartaShell>
  );
}
