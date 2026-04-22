"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FullArticlePayload } from "@/lib/types";

const PLAYER_CURSOR_THEME = {
  fill: "#1d4ed8",
  border: "#0f172a",
  labelBackground: "#dbeafe",
  labelText: "#0f172a",
};

const SPECTATOR_CURSOR_THEMES = [
  {
    fill: "#ef4444",
    border: "#7f1d1d",
    labelBackground: "#fee2e2",
    labelText: "#7f1d1d",
  },
  {
    fill: "#f97316",
    border: "#9a3412",
    labelBackground: "#ffedd5",
    labelText: "#9a3412",
  },
  {
    fill: "#10b981",
    border: "#065f46",
    labelBackground: "#d1fae5",
    labelText: "#065f46",
  },
  {
    fill: "#8b5cf6",
    border: "#5b21b6",
    labelBackground: "#ede9fe",
    labelText: "#5b21b6",
  },
  {
    fill: "#ec4899",
    border: "#9d174d",
    labelBackground: "#fce7f3",
    labelText: "#9d174d",
  },
  {
    fill: "#14b8a6",
    border: "#115e59",
    labelBackground: "#ccfbf1",
    labelText: "#115e59",
  },
];

const PRESENCE_SYNC_MS = 100;
const SUGGESTION_FLASH_MS = 1_800;

type PresenceCursor = {
  participantId: Id<"raceParticipants">;
  displayName: string;
  currentArticleSlug: string;
  cursorXRatio: number;
  cursorYRatio: number;
  scrollRatio: number;
  updatedAt: number;
};

type SuggestionEvent = {
  _id: string;
  fromParticipantId: Id<"raceParticipants">;
  fromDisplayName: string;
  sourceArticleSlug: string;
  articleSlug: string;
  articleTitle: string;
  createdAt: number;
};

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

function hashParticipantId(participantId: string) {
  let hash = 0;

  for (const character of participantId) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1_000_000_007;
  }

  return hash;
}

function getCursorTheme(participantId: string, role: "player" | "spectator") {
  if (role === "player") {
    return PLAYER_CURSOR_THEME;
  }

  return SPECTATOR_CURSOR_THEMES[hashParticipantId(participantId) % SPECTATOR_CURSOR_THEMES.length];
}

function escapeSelectorValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

export function RaceArticleViewer({
  code,
  playerToken,
  viewerParticipantId,
  viewerDisplayName,
  mode,
  slug,
  targetTitle,
  navigationLocked,
  followingParticipantId,
  followedParticipantId,
  followedParticipantName,
  remotePlayerPresence,
  spectatorPresences,
  recentSuggestions,
  onNavigate,
  onError,
}: {
  code: string;
  playerToken: string;
  viewerParticipantId: Id<"raceParticipants">;
  viewerDisplayName: string;
  mode: "player" | "spectator";
  slug: string;
  targetTitle: string;
  navigationLocked: boolean;
  followingParticipantId?: Id<"raceParticipants"> | null;
  followedParticipantId?: Id<"raceParticipants"> | null;
  followedParticipantName?: string | null;
  remotePlayerPresence?: PresenceCursor | null;
  spectatorPresences?: PresenceCursor[];
  recentSuggestions?: SuggestionEvent[];
  onNavigate: (nextSlug: string) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const cached = useQuery(api.articles.getBySlug, { slug });
  const fetchArticle = useAction(api.wikipedia.fetchAndCacheArticle);
  const syncPresence = useMutation(api.races.upsertPresence);
  const sendSuggestion = useMutation(api.races.sendSuggestion);
  const [summaryStatus, setSummaryStatus] = useState<"idle" | "loading" | "error">("idle");
  const [fullStatus, setFullStatus] = useState<"idle" | "loading" | "error">("idle");
  const [fullArticle, setFullArticle] = useState<FullArticlePayload | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [activeSuggestionPanelId, setActiveSuggestionPanelId] = useState<string | null>(null);
  const [localCursor, setLocalCursor] = useState({ x: 0.5, y: 0.12 });
  const activeSlugRef = useRef(slug);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const activeAnnouncementTimeoutRef = useRef<number | null>(null);
  const activePresenceTimeoutRef = useRef<number | null>(null);
  const activeSuggestionPanelTimeoutRef = useRef<number | null>(null);
  const lastPresenceSentAtRef = useRef(0);
  const seenSuggestionIdsRef = useRef<Set<string>>(new Set());
  const activeSuggestionTimeoutsRef = useRef<number[]>([]);
  const latestSuggestion = mode === "player" ? recentSuggestions?.[0] ?? null : null;
  const latestPresenceRef = useRef({
    currentArticleSlug: slug,
    followingParticipantId: followingParticipantId ?? undefined,
    cursorXRatio: 0.5,
    cursorYRatio: 0.12,
    scrollRatio: 0,
  });

  const showAnnouncement = useCallback((message: string) => {
    setAnnouncement(message);
    if (activeAnnouncementTimeoutRef.current !== null) {
      window.clearTimeout(activeAnnouncementTimeoutRef.current);
    }

    activeAnnouncementTimeoutRef.current = window.setTimeout(() => {
      setAnnouncement(null);
      activeAnnouncementTimeoutRef.current = null;
    }, 2_400);
  }, []);

  const clearSuggestionTimeouts = useCallback(() => {
    for (const timeout of activeSuggestionTimeoutsRef.current) {
      window.clearTimeout(timeout);
    }

    activeSuggestionTimeoutsRef.current = [];
  }, []);

  const flushPresence = useCallback(() => {
    activePresenceTimeoutRef.current = null;
    lastPresenceSentAtRef.current = Date.now();

    void syncPresence({
      code,
      playerToken,
      currentArticleSlug: latestPresenceRef.current.currentArticleSlug,
      followingParticipantId: latestPresenceRef.current.followingParticipantId,
      cursorXRatio: latestPresenceRef.current.cursorXRatio,
      cursorYRatio: latestPresenceRef.current.cursorYRatio,
      scrollRatio: latestPresenceRef.current.scrollRatio,
    }).catch((cause) => {
      onError?.(cause instanceof Error ? cause.message : "Could not sync live cursor state.");
    });
  }, [code, onError, playerToken, syncPresence]);

  const schedulePresenceSync = useCallback(
    (partial: Partial<typeof latestPresenceRef.current>) => {
      latestPresenceRef.current = {
        ...latestPresenceRef.current,
        ...partial,
      };

      if (activePresenceTimeoutRef.current !== null) {
        return;
      }

      const elapsed = Date.now() - lastPresenceSentAtRef.current;
      const wait = Math.max(PRESENCE_SYNC_MS - elapsed, 0);
      activePresenceTimeoutRef.current = window.setTimeout(flushPresence, wait);
    },
    [flushPresence],
  );

  useEffect(() => {
    activeSlugRef.current = slug;
    setFullArticle(null);
    setSummaryStatus("idle");
    setFullStatus("idle");
    setHoveredStatus(null);
    setAnnouncement(null);
    setActiveSuggestionPanelId(null);
    scrollViewportRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [slug]);

  useEffect(() => {
    latestPresenceRef.current = {
      ...latestPresenceRef.current,
      currentArticleSlug: slug,
      followingParticipantId: followingParticipantId ?? undefined,
      scrollRatio: mode === "spectator" ? remotePlayerPresence?.scrollRatio ?? 0 : 0,
    };

    schedulePresenceSync({
      currentArticleSlug: slug,
      followingParticipantId: followingParticipantId ?? undefined,
      scrollRatio: mode === "spectator" ? remotePlayerPresence?.scrollRatio ?? 0 : 0,
    });
  }, [followingParticipantId, mode, remotePlayerPresence?.scrollRatio, schedulePresenceSync, slug]);

  useEffect(() => {
    return () => {
      if (activeAnnouncementTimeoutRef.current !== null) {
        window.clearTimeout(activeAnnouncementTimeoutRef.current);
      }

      if (activePresenceTimeoutRef.current !== null) {
        window.clearTimeout(activePresenceTimeoutRef.current);
      }

      if (activeSuggestionPanelTimeoutRef.current !== null) {
        window.clearTimeout(activeSuggestionPanelTimeoutRef.current);
      }

      clearSuggestionTimeouts();
    };
  }, [clearSuggestionTimeouts]);

  useEffect(() => {
    if (mode !== "player" || !latestSuggestion) {
      setActiveSuggestionPanelId(null);
      return;
    }

    setActiveSuggestionPanelId(latestSuggestion._id);

    if (activeSuggestionPanelTimeoutRef.current !== null) {
      window.clearTimeout(activeSuggestionPanelTimeoutRef.current);
    }

    activeSuggestionPanelTimeoutRef.current = window.setTimeout(() => {
      setActiveSuggestionPanelId((current) => (current === latestSuggestion._id ? null : current));
      activeSuggestionPanelTimeoutRef.current = null;
    }, SUGGESTION_FLASH_MS);
  }, [latestSuggestion, mode]);

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

  useEffect(() => {
    if (mode !== "spectator") {
      return;
    }

    if (!remotePlayerPresence || remotePlayerPresence.currentArticleSlug !== slug) {
      return;
    }

    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    const maxScroll = Math.max(viewport.scrollHeight - viewport.clientHeight, 0);
    const nextTop = maxScroll * clampRatio(remotePlayerPresence.scrollRatio);

    if (Math.abs(viewport.scrollTop - nextTop) > 2) {
      viewport.scrollTop = nextTop;
    }
  }, [cached?._id, fullArticle?.canonicalSlug, mode, remotePlayerPresence, slug]);

  useEffect(() => {
    if (mode !== "player" || !recentSuggestions || recentSuggestions.length === 0) {
      return;
    }

    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    for (const suggestion of [...recentSuggestions].reverse()) {
      if (seenSuggestionIdsRef.current.has(suggestion._id)) {
        continue;
      }

      seenSuggestionIdsRef.current.add(suggestion._id);
      showAnnouncement(`${suggestion.fromDisplayName} suggested ${suggestion.articleTitle}`);

      const theme = getCursorTheme(suggestion.fromParticipantId, "spectator");
      const selector = `[data-netcarta-slug="${escapeSelectorValue(suggestion.articleSlug)}"]`;
      const targetLink = viewport.querySelector(selector);
      if (!(targetLink instanceof HTMLElement)) {
        continue;
      }

      targetLink.classList.remove("is-suggested-link");
      void targetLink.offsetWidth;
      targetLink.style.setProperty("--suggestion-accent", theme.fill);
      targetLink.style.setProperty("--suggestion-ink", theme.border);
      targetLink.setAttribute("data-suggestion-from", suggestion.fromDisplayName);
      targetLink.classList.add("is-suggested-link");

      const timeout = window.setTimeout(() => {
        targetLink.classList.remove("is-suggested-link");
        targetLink.removeAttribute("data-suggestion-from");
      }, SUGGESTION_FLASH_MS);

      activeSuggestionTimeoutsRef.current.push(timeout);
    }
  }, [mode, recentSuggestions, showAnnouncement]);

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

      if (mode === "spectator") {
        if (!followedParticipantId) {
          return;
        }

        showAnnouncement(`Suggested ${readStatusLabel(anchor)} to ${followedParticipantName ?? "the player"}`);

        void sendSuggestion({
          code,
          playerToken,
          toParticipantId: followedParticipantId,
          articleSlug: nextSlug,
          articleTitle: readStatusLabel(anchor),
        }).catch((cause) => {
          onError?.(cause instanceof Error ? cause.message : "Could not send that spectator suggestion.");
        });

        return;
      }

      if (navigationLocked) {
        return;
      }

      void onNavigate(nextSlug);
    },
    [
      code,
      followedParticipantId,
      followedParticipantName,
      mode,
      navigationLocked,
      onError,
      onNavigate,
      playerToken,
      sendSuggestion,
      showAnnouncement,
    ],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const cursorXRatio = clampRatio((event.clientX - rect.left) / rect.width);
      const cursorYRatio = clampRatio((event.clientY - rect.top) / rect.height);
      setLocalCursor({ x: cursorXRatio, y: cursorYRatio });
      schedulePresenceSync({ cursorXRatio, cursorYRatio });

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
    [hoveredStatus, schedulePresenceSync],
  );

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const viewport = event.currentTarget;
      const maxScroll = Math.max(viewport.scrollHeight - viewport.clientHeight, 1);
      const scrollRatio = clampRatio(viewport.scrollTop / maxScroll);
      schedulePresenceSync({ scrollRatio });
    },
    [schedulePresenceSync],
  );

  const title = (fullArticle?.title ?? cached?.title ?? slug).replaceAll("_", " ");
  const isFullEntryPending = Boolean(cached && !fullArticle && fullStatus !== "error");
  const latestSuggestionTheme = latestSuggestion
    ? getCursorTheme(latestSuggestion.fromParticipantId, "spectator")
    : null;
  const statusMessage = useMemo(() => {
    if (mode === "spectator" && announcement) {
      return announcement;
    }

    if (mode === "spectator") {
      if (hoveredStatus) {
        return `${hoveredStatus} · click to suggest it to ${followedParticipantName ?? "the player"}`;
      }

      return `Following ${followedParticipantName ?? "the player"} live`;
    }

    if (navigationLocked) {
      return "Navigation locked until the countdown finishes";
    }

    if (isFullEntryPending) {
      return "Loading encyclopedia entry...";
    }

    return hoveredStatus ?? "Inline article links are live";
  }, [announcement, followedParticipantName, hoveredStatus, isFullEntryPending, mode, navigationLocked]);

  const overlayCursors = useMemo(() => {
    const cursors: Array<{
      participantId: string;
      displayName: string;
      role: "player" | "spectator";
      x: number;
      y: number;
    }> = [
      {
        participantId: viewerParticipantId,
        displayName: `${viewerDisplayName} (you)`,
        role: mode === "player" ? "player" : "spectator",
        x: localCursor.x,
        y: localCursor.y,
      },
    ];

    if (mode === "spectator" && remotePlayerPresence && remotePlayerPresence.currentArticleSlug === slug) {
      cursors.push({
        participantId: remotePlayerPresence.participantId,
        displayName: remotePlayerPresence.displayName,
        role: "player",
        x: remotePlayerPresence.cursorXRatio,
        y: remotePlayerPresence.cursorYRatio,
      });
    }

    if (mode === "player") {
      for (const spectatorPresence of spectatorPresences ?? []) {
        if (spectatorPresence.currentArticleSlug !== slug) {
          continue;
        }

        cursors.push({
          participantId: spectatorPresence.participantId,
          displayName: spectatorPresence.displayName,
          role: "spectator",
          x: spectatorPresence.cursorXRatio,
          y: spectatorPresence.cursorYRatio,
        });
      }
    }

    return cursors;
  }, [localCursor.x, localCursor.y, mode, remotePlayerPresence, slug, spectatorPresences, viewerDisplayName, viewerParticipantId]);

  return (
    <div className="flex min-h-[calc(100vh-280px)] flex-col gap-5">
      <div className="border-2 border-black bg-black/90 p-5 text-white">
        <div className="text-xs uppercase tracking-[0.45em] text-[#87dcdc]">Destination</div>
        <div className="mt-2 font-body text-4xl text-[#ffe59a]">{targetTitle}</div>
        <p className="mt-3 text-sm leading-6 text-[#d1d5db]">
          {mode === "spectator"
            ? "The player governs article changes and scroll. Click a live article link to suggest a route."
            : "Follow only inline article links inside the encyclopedia entry."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-2 border-black bg-[rgba(255,255,255,0.84)] p-6">
        <div className="mb-4 border-b border-black/20 pb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.42em] text-[#1d4b8f]">Current Article</div>
            <h2 className="font-body text-5xl text-[#111]">{title}</h2>
          </div>
          <div className="race-article-header-panels mt-4">
            <div className="inline-flex min-h-12 items-center bevel-inset bg-white px-4 py-2 text-sm leading-5">
              {statusMessage}
            </div>
            {latestSuggestion && latestSuggestionTheme ? (
              <div
                className={`race-suggestion-panel bevel-inset ${activeSuggestionPanelId === latestSuggestion._id ? "is-active" : ""}`}
                style={
                  {
                    ["--suggestion-panel-accent" as string]: latestSuggestionTheme.fill,
                    ["--suggestion-panel-ink" as string]: latestSuggestionTheme.border,
                    ["--suggestion-panel-bg" as string]: latestSuggestionTheme.labelBackground,
                  } as CSSProperties
                }
              >
                <div className="race-suggestion-kicker">Spectator Suggestion</div>
                <div className="race-suggestion-title">{latestSuggestion.articleTitle}</div>
                <div className="race-suggestion-meta">{latestSuggestion.fromDisplayName} suggests this route</div>
              </div>
            ) : null}
          </div>
        </div>

        {isLoading ? <div className="bevel-inset bg-white px-6 py-5 text-lg">Loading article...</div> : null}

        {!isLoading && !cached ? (
          <div className="border-2 border-black bg-[#fff2d8] px-6 py-5 text-lg">
            {summaryStatus === "error" ? "Could not load that article right now." : "Article not found."}
          </div>
        ) : null}

        {cached ? (
          <div className="race-article-stage">
            <div
              ref={scrollViewportRef}
              onClick={handleDocumentClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredStatus(null)}
              onScroll={handleScroll}
              className="race-article-scroll scroll-panel article-body text-[#1f2937]"
            >
              {isFullEntryPending ? (
                <div className="space-y-5">
                  <div className="border-2 border-black bg-[#fff3b7] px-5 py-4 text-[#334155]">
                    <div className="text-xs uppercase tracking-[0.3em] text-[#92400e]">Opening Article</div>
                    <div className="mt-2 text-lg font-bold text-[#111]">Loading the full encyclopedia entry</div>
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
                  <div className="text-xs uppercase tracking-[0.3em] text-[#92400e]">Fallback Summary</div>
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

            <div className="live-cursor-layer" aria-hidden="true">
              {overlayCursors.map((cursor) => {
                const theme = getCursorTheme(cursor.participantId, cursor.role);
                const style = {
                  left: `${clampRatio(cursor.x) * 100}%`,
                  top: `${clampRatio(cursor.y) * 100}%`,
                  ["--live-cursor-fill" as string]: theme.fill,
                  ["--live-cursor-border" as string]: theme.border,
                  ["--live-cursor-label-bg" as string]: theme.labelBackground,
                  ["--live-cursor-label-text" as string]: theme.labelText,
                } as CSSProperties;

                return (
                  <div
                    key={`${cursor.participantId}-${cursor.role}`}
                    className={`live-cursor ${cursor.role === "player" ? "is-player" : "is-spectator"}`}
                    style={style}
                  >
                    <div className="live-cursor-glyph" />
                    <div className="live-cursor-label">{cursor.displayName}</div>
                  </div>
                );
              })}
            </div>
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
