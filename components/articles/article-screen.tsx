"use client";

import Image from "next/image";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/convex/_generated/api";
import { EncartaShell } from "@/components/shell/encarta-shell";

export function ArticleScreen({ slug }: { slug: string }) {
  const cached = useQuery(api.articles.getBySlug, { slug });
  const fetchArticle = useAction(api.wikipedia.fetchAndCacheArticle);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (cached !== null || status === "loading" || status === "error") {
      return;
    }

    setStatus("loading");
    void fetchArticle({ slug })
      .then(() => setStatus("idle"))
      .catch(() => setStatus("error"));
  }, [cached, fetchArticle, slug, status]);

  const loading = cached === undefined || status === "loading";

  const actions = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/" className="bevel bg-panel px-4 py-2 font-bold">
          Home
        </Link>
        <Link href="/race" className="bevel bg-panel px-4 py-2 font-bold">
          Open Race Lobby
        </Link>
        <div className="bevel-inset bg-white px-4 py-2">
          Current article: {slug.replaceAll("_", " ")}
        </div>
      </div>
    ),
    [slug],
  );

  return (
    <EncartaShell
      title={cached?.title ?? slug.replaceAll("_", " ")}
      subtitle="Wikipedia content, routed through Convex caching to keep the illusion intact."
      actions={actions}
    >
      {loading ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="bevel-inset bg-white px-6 py-5 text-lg">
            Loading article from Convex cache...
          </div>
        </div>
      ) : null}

      {!loading && !cached ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="border-2 border-black bg-[#fff2d8] px-6 py-5 text-lg">
            {status === "error"
              ? "Could not load that article. Try another title or confirm the Convex deployment is configured."
              : "Article not found."}
          </div>
        </div>
      ) : null}

      {cached ? (
        <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[1.3fr,0.95fr] lg:p-8">
          <section className="space-y-6">
            <div className="border-2 border-black bg-[rgba(255,255,255,0.82)] p-6">
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="min-w-0 flex-1">
                  <h2 className="font-body text-5xl text-[#111]">
                    {cached.title}
                  </h2>
                  <div className="article-body mt-5 text-[#1f2937]">
                    {cached.summary.split("\n").map((paragraph: string, index: number) => (
                      <p
                        key={`${paragraph.slice(0, 20)}-${index}`}
                        className="mb-4"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>

                {cached.image || cached.thumbnail ? (
                  <div className="w-full max-w-[280px] shrink-0 border-2 border-black bg-[#fdf7e3] p-2">
                    <Image
                      src={cached.image ?? cached.thumbnail ?? ""}
                      alt={cached.title}
                      width={520}
                      height={520}
                      className="h-auto w-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-2 border-black bg-[rgba(255,248,220,0.85)] p-5">
              <div className="bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">
                Did You Know?
              </div>
              <p className="article-body mt-4 text-[18px] leading-8 text-[#1f2937]">
                Every linked article on this screen can become part of a race
                path. The fastest route is often not the most obvious one.
              </p>
            </div>
          </section>

          <section className="space-y-6">
            <div className="border-2 border-black bg-[rgba(0,0,0,0.86)] p-5 text-white">
              <div className="text-xs uppercase tracking-[0.45em] text-[#87dcdc]">
                See Also
              </div>
              <div className="link-list mt-4 grid gap-3 text-lg">
                {cached.seeAlso.map((item: { slug: string; title: string }) => (
                  <Link
                    key={item.slug}
                    href={`/articles/${item.slug}`}
                    className="bevel bg-[#d7d7d7] px-4 py-3 font-semibold text-black hover:bg-[#ececec]"
                  >
                    {item.title}
                  </Link>
                ))}
                {cached.seeAlso.length === 0 ? (
                  <div className="text-sm text-[#d1d5db]">
                    No related links surfaced for this article.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-2 border-black bg-[rgba(255,255,255,0.75)] p-5">
              <div className="bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">
                Race Tip
              </div>
              <p className="mt-4 text-[15px] leading-7 text-[#1f2937]">
                In race mode, navigation is locked to this related-link rail.
                That keeps the challenge fair and turns Wikipedia into a
                realtime graph puzzle.
              </p>
              <Link
                href="/race"
                className="bevel mt-5 inline-flex bg-panel px-4 py-2 font-bold"
              >
                Start A Room
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </EncartaShell>
  );
}
