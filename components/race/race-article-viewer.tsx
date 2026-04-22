"use client";

import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";
import type { FullArticlePayload } from "@/lib/types";

function readStatusLabel(anchor: HTMLAnchorElement) {
  return (
    anchor.dataset.netcartaTarget ??
    anchor.getAttribute("title") ??
    anchor.textContent?.trim() ??
    anchor.getAttribute("href") ??
    "Article link"
  );
}

function extractArticleSlug(href: string) {
  const normalizedHref = href.split("#")[0] ?? href;
  if (!normalizedHref.startsWith("/articles/")) {
    return null;
  }

  return decodeURIComponent(normalizedHref.slice("/articles/".length));
}

export function RaceArticleViewer({
  slug,
  navigationLocked,
  targetTitle,
  onNavigate,
}: {
  slug: string;
  navigationLocked: boolean;
  targetTitle: string;
  onNavigate: (nextSlug: string) => void | Promise<void>;
}) {
  const cached = useQuery(api.articles.getBySlug, { slug });
  const fetchArticle = useAction(api.wikipedia.fetchAndCacheArticle);
  const [summaryStatus, setSummaryStatus] = useState<"idle" | "loading" | "error">("idle");
  const [fullStatus, setFullStatus] = useState<"idle" | "loading" | "error">("idle");
  const [fullArticle, setFullArticle] = useState<FullArticlePayload | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const activeSlugRef = useRef(slug);

  useEffect(() => {
    activeSlugRef.current = slug;
    setFullArticle(null);
    setSummaryStatus("idle");
    setFullStatus("idle");
    setHoveredStatus(null);
  }, [slug]);

  useEffect(() => {
    if (cached !== null || summaryStatus === "loading" || summaryStatus === "error") {
      return;
    }

    setSummaryStatus("loading");
    void fetchArticle({ slug })
      .then(() => {
        if (activeSlugRef.current === slug) {
          setSummaryStatus("idle");
        }
      })
      .catch(() => {
        if (activeSlugRef.current === slug) {
          setSummaryStatus("error");
        }
      });
  }, [cached, fetchArticle, slug, summaryStatus]);

  useEffect(() => {
    if (fullArticle || fullStatus === "loading") {
      return;
    }

    setFullStatus("loading");

    void fetch(`/api/wikipedia/full/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not open the article viewer");
        }

        const article = (await response.json()) as FullArticlePayload;
        if (activeSlugRef.current !== slug) {
          return;
        }

        setFullArticle(article);
        setFullStatus("idle");
      })
      .catch(() => {
        if (activeSlugRef.current === slug) {
          setFullStatus("error");
        }
      });
  }, [fullArticle, fullStatus, slug]);

  const isLoading = cached === undefined || (cached === null && summaryStatus !== "error");

  const handleDocumentClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest("a");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const nextSlug = extractArticleSlug(href);
      if (!nextSlug) {
        return;
      }

      event.preventDefault();

      if (navigationLocked) {
        return;
      }

      void onNavigate(nextSlug);
    },
    [navigationLocked, onNavigate],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest("a");

      if (!(anchor instanceof HTMLAnchorElement)) {
        if (hoveredStatus !== null) {
          setHoveredStatus(null);
        }
        return;
      }

      const label = readStatusLabel(anchor);
      if (label !== hoveredStatus) {
        setHoveredStatus(label);
      }
    },
    [hoveredStatus],
  );

  const title = (fullArticle?.title ?? cached?.title ?? slug).replaceAll("_", " ");
  const isFullEntryPending = Boolean(cached && !fullArticle && fullStatus !== "error");
  const statusMessage = useMemo(() => {
    if (navigationLocked) {
      return "Navigation locked until the countdown finishes";
    }

    if (isFullEntryPending) {
      return "Loading encyclopedia entry...";
    }

    return hoveredStatus ?? "Inline article links are live";
  }, [hoveredStatus, isFullEntryPending, navigationLocked]);

  return (
    <div className="space-y-5">
      <div className="border-2 border-black bg-black/90 p-5 text-white">
        <div className="text-xs uppercase tracking-[0.45em] text-[#87dcdc]">
          Destination
        </div>
        <div className="mt-2 font-body text-4xl text-[#ffe59a]">{targetTitle}</div>
        <p className="mt-3 text-sm leading-6 text-[#d1d5db]">
          Follow only inline article links inside the encyclopedia entry.
        </p>
      </div>

      <div className="border-2 border-black bg-[rgba(255,255,255,0.84)] p-6">
        <div className="mb-4 border-b border-black/20 pb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.42em] text-[#1d4b8f]">
              Current Article
            </div>
            <h2 className="font-body text-5xl text-[#111]">{title}</h2>
          </div>
          <div className="mt-4 inline-flex h-12 items-center bevel-inset bg-white px-4 py-2 text-sm leading-5">
            {statusMessage}
          </div>
        </div>

        {isLoading ? (
          <div className="bevel-inset bg-white px-6 py-5 text-lg">Loading article...</div>
        ) : null}

        {!isLoading && !cached ? (
          <div className="border-2 border-black bg-[#fff2d8] px-6 py-5 text-lg">
            {summaryStatus === "error"
              ? "Could not load that article right now."
              : "Article not found."}
          </div>
        ) : null}

        {cached ? (
          <div
            onClick={handleDocumentClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredStatus(null)}
            className="article-body text-[#1f2937]"
          >
            {isFullEntryPending ? (
              <div className="space-y-5">
                <div className="border-2 border-black bg-[#fff3b7] px-5 py-4 text-[#334155]">
                  <div className="text-xs uppercase tracking-[0.3em] text-[#92400e]">
                    Opening Article
                  </div>
                  <div className="mt-2 text-lg font-bold text-[#111]">
                    Loading the full encyclopedia entry
                  </div>
                  <p className="mt-2 text-sm leading-6">
                    Preparing article text and inline links for the next move.
                  </p>
                </div>

                <div className="border-2 border-black bg-white p-5">
                  <div className="mb-5 flex gap-3">
                    <div className="h-4 w-24 bg-[#d6dde8]" />
                    <div className="h-4 w-16 bg-[#e5e7eb]" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-5 w-full bg-[#dbe4f0]" />
                    <div className="h-5 w-[92%] bg-[#e5e7eb]" />
                    <div className="h-5 w-[96%] bg-[#dbe4f0]" />
                    <div className="h-5 w-[78%] bg-[#e5e7eb]" />
                  </div>
                  <div className="mt-8 border-t border-black/15 pt-5">
                    <div className="mb-4 h-4 w-32 bg-[#cfd8e3]" />
                    <div className="space-y-3">
                      <div className="h-4 w-full bg-[#e5e7eb]" />
                      <div className="h-4 w-[88%] bg-[#dbe4f0]" />
                      <div className="h-4 w-[93%] bg-[#e5e7eb]" />
                    </div>
                  </div>
                </div>
              </div>
            ) : fullArticle ? (
              <div className="space-y-8">
                <div
                  className="article-html article-document"
                  dangerouslySetInnerHTML={{ __html: fullArticle.leadHtml }}
                />
                {fullArticle.sections.map((section) => (
                  <section key={section.index} className="border-t border-black/15 pt-6">
                    <div className="mb-4 font-bold uppercase tracking-[0.18em] text-[#334155]">
                      {section.title}
                    </div>
                    <div
                      className="article-html article-document"
                      dangerouslySetInnerHTML={{ __html: section.html }}
                    />
                  </section>
                ))}
              </div>
            ) : (
              <div className="border-2 border-black bg-[#fff9ec] px-5 py-4">
                <div className="text-xs uppercase tracking-[0.3em] text-[#92400e]">
                  Fallback Summary
                </div>
                <div className="mt-2 text-sm text-[#7c2d12]">
                  The full article could not be loaded, so the cached summary is shown instead.
                </div>
                <div className="mt-4">
                {cached.summary.split("\n").map((paragraph: string, index: number) => (
                  <p key={`${paragraph.slice(0, 20)}-${index}`} className="mb-4">
                    {paragraph}
                  </p>
                ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {fullStatus === "loading" ? (
          <div className="mt-6 border-t border-black/20 pt-4 text-sm text-[#475569]">
            {cached ? "Preparing inline article links..." : "Loading the full encyclopedia entry..."}
          </div>
        ) : null}

        {fullStatus === "error" ? (
          <div className="mt-6 border-t border-black/20 pt-4 text-sm text-[#7c2d12]">
            The full article could not be loaded, so only the cached summary is available.
          </div>
        ) : null}
      </div>
    </div>
  );
}
