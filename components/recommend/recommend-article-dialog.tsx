"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import type { ArticlePreview } from "@/lib/types";

type RecommendationResponse = {
  recommendations?: ArticlePreview[];
  error?: string;
};

export function RecommendArticleDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<ArticlePreview[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    inputRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDialog, isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuery = query.replace(/\s+/g, " ").trim();
    if (trimmedQuery.length < 2) {
      setError("Please enter a topic with at least 2 characters.");
      setRecommendations([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommend-articles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: trimmedQuery }),
      });

      const payload = (await response.json().catch(() => null)) as
        | RecommendationResponse
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Netcarta could not suggest articles right now.",
        );
      }

      setRecommendations(payload?.recommendations ?? []);
    } catch (caughtError) {
      setRecommendations([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Netcarta could not suggest articles right now.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bevel mt-2 flex w-full items-center gap-3 bg-[linear-gradient(180deg,#fffbe8_0%,#f1e3a7_100%)] px-3 py-2 text-left text-black transition hover:bg-[linear-gradient(180deg,#fffdf1_0%,#f5e8ba_100%)] active:translate-y-px"
      >
        <span className="bevel-inset flex h-8 w-8 shrink-0 items-center justify-center bg-[#0d3f83] text-[11px] font-bold uppercase tracking-[0.14em] text-[#fff6cc]">
          AI
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold leading-5">
            Recommend me an article
          </span>
          <span className="block text-[10px] uppercase tracking-[0.24em] text-[#6b4f16]">
            Research Assistant
          </span>
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="window-frame w-full max-w-2xl overflow-hidden bg-panel text-black shadow-[8px_8px_0_rgba(0,0,0,0.35)]">
            <div className="title-bar">
              <div className="title-bar-text">Article Recommender</div>
              <div className="title-bar-controls">
                <button aria-label="Close" onClick={closeDialog} />
              </div>
            </div>

            <div className="bg-[#efefef] p-4 sm:p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <p className="text-[15px] font-bold text-[#111]">
                    What do you want to learn about?
                  </p>
                  <p className="mt-2 text-sm leading-5 text-[#333]">
                    Netcarta will suggest five broad starting points from the
                    encyclopedia.
                  </p>
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Try ancient Rome, volcanoes, or jazz"
                  className="bevel-inset w-full bg-white px-3 py-2 text-base outline-none"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bevel bg-panel px-4 py-2 font-bold disabled:text-[#6b7280]"
                  >
                    {isLoading ? "Thinking..." : "Recommend"}
                  </button>
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="bevel bg-panel px-4 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </form>

              <div className="mt-5 border-2 border-black bg-[rgba(255,248,220,0.82)] p-4">
                <div className="bg-[#b0b0b0] px-2 py-1 text-xl font-bold">
                  Suggested Reading
                </div>

                {isLoading ? (
                  <p className="mt-4 text-[15px] leading-6 text-[#1f2937]">
                    Consulting the Netcarta research assistant...
                  </p>
                ) : null}

                {!isLoading && error ? (
                  <p className="mt-4 text-[15px] leading-6 text-[#7f1d1d]">
                    {error}
                  </p>
                ) : null}

                {!isLoading && !error && recommendations.length === 0 ? (
                  <p className="mt-4 text-[15px] leading-6 text-[#1f2937]">
                    Enter a topic to get a short reading list of foundational
                    articles.
                  </p>
                ) : null}

                {!isLoading && !error && recommendations.length > 0 ? (
                  <div className="link-list mt-4 grid gap-3 text-[17px]">
                    {recommendations.map((article) => (
                      <Link
                        key={article.slug}
                        href={`/articles/${encodeURIComponent(article.slug)}`}
                        onClick={closeDialog}
                        className="bevel block bg-[#d7d7d7] px-4 py-3 font-semibold hover:bg-[#ececec]"
                      >
                        {article.title}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
