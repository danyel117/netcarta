"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EncartaShell } from "@/components/shell/encarta-shell";

const hubItems = [
  {
    title: "Articles",
    description:
      "Browse live Wikipedia content wrapped in chunky Encarta chrome.",
    href: "/articles/Encarta",
  },
  {
    title: "Race",
    description:
      "Create a multiplayer room and race through See Also links in real time.",
    href: "/race",
  },
  {
    title: "Atlas",
    description: "Greyed out, because the bit has to feel like a boxed product.",
  },
  {
    title: "MindMaze",
    description:
      "Also disabled, staying faithful to the fake 2001-era roadmap.",
  },
];

export function HomeScreen() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!showSplash) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSplash(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSplash]);

  return (
    <>
      {showSplash ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6">
          <div className="scanlines bevel relative w-full max-w-4xl overflow-hidden bg-[radial-gradient(circle_at_center,#3251ac_0%,#091132_58%,#000_100%)] px-8 py-16 text-white">
            <button
              type="button"
              onClick={() => setShowSplash(false)}
              className="bevel absolute right-5 top-5 bg-panel px-4 py-2 text-sm text-black"
            >
              Skip Intro
            </button>
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-4 text-xs uppercase tracking-[0.7em] text-[#b9d6ff]">
                Online Edition
              </p>
              <h1 className="font-body text-7xl tracking-tight text-[#fff7d6] sm:text-8xl">
                Netcarta
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-[#d7e8ff]">
                Encyclopedia. Online. At last. A missing Microsoft product from
                2001, now rebuilt as a realtime Wikipedia race.
              </p>
              <button
                type="button"
                onClick={() => setShowSplash(false)}
                className="bevel mt-10 bg-panel px-6 py-3 text-lg font-bold text-black"
              >
                Enter Encyclopedia
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <EncartaShell
        title="Home"
        subtitle="A multiplayer encyclopedia shell with Convex-backed race rooms, cached articles, and enough 2001 chrome to sell the fiction."
      >
        <div className="grid flex-1 gap-8 p-6 lg:grid-cols-[1.15fr,0.85fr] lg:p-10">
          <section className="relative overflow-hidden border-2 border-black bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(190,210,235,0.92))] p-8">
            <div className="absolute inset-y-0 right-0 w-[40%] bg-[radial-gradient(circle_at_top,rgba(71,105,186,0.2),transparent_52%),linear-gradient(180deg,transparent,rgba(30,58,138,0.12))]" />
            <div className="relative">
              <p className="text-xs uppercase tracking-[0.5em] text-[#1d4b8f]">
                Welcome To
              </p>
              <h2 className="font-body text-6xl text-[#111] sm:text-7xl">
                Netcarta 2026
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#202020]">
                Browse live encyclopedia entries, spin up a room, and challenge
                everyone in the room to navigate from one article to another
                using only the link graph.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {hubItems.map((item) => {
                  const disabled = !item.href;

                  if (disabled) {
                    return (
                      <div
                        key={item.title}
                        className="bevel bg-[#d0d0d0] p-4 opacity-70"
                      >
                        <div className="text-2xl font-bold">{item.title}</div>
                        <p className="mt-2 text-sm leading-6">
                          {item.description}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.title}
                      href={item.href}
                      className="bevel bg-[#fff8dc] p-4 transition hover:-translate-y-0.5 hover:bg-[#fff3b7]"
                    >
                      <div className="text-2xl font-bold">{item.title}</div>
                      <p className="mt-2 text-sm leading-6">
                        {item.description}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="border-2 border-black bg-black/90 p-5 text-white">
              <div className="text-sm uppercase tracking-[0.35em] text-[#9ad7d7]">
                Today&apos;s Challenge
              </div>
              <div className="mt-3 font-body text-4xl text-[#ffe59a]">
                Lando Norris to Border Collie
              </div>
              <p className="mt-3 text-sm leading-6 text-[#d1d5db]">
                Judges join from phones, everyone starts together, and the first
                player to reach the target article wins.
              </p>
              <Link
                href="/race"
                className="bevel mt-5 inline-flex bg-panel px-4 py-2 font-bold text-black"
              >
                Launch Race Lobby
              </Link>
            </div>

            <div className="border-2 border-black bg-[rgba(255,255,255,0.72)] p-5">
              <div className="bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">
                Encarta Highlights
              </div>
              <div className="mt-4 space-y-4 text-[15px] leading-7">
                <p>
                  Wikipedia summaries are cached in Convex, so the article shell
                  stays fast even while players are hammering the same route.
                </p>
                <p>
                  Presence chips, timers, click counts, and room state all update
                  live through Convex subscriptions.
                </p>
                <p>
                  The fake software packaging is the joke. The realtime race is
                  the actual product.
                </p>
              </div>
            </div>
          </section>
        </div>
      </EncartaShell>
    </>
  );
}
