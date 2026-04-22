"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";
import { SearchBox } from "@/components/search/search-box";
import { EncartaShell } from "@/components/shell/encarta-shell";
import type { FullArticlePayload, FullArticleTocItem } from "@/lib/types";

function readStatusLabel(anchor: HTMLAnchorElement) {
  return (
    anchor.dataset.netcartaTarget ??
    anchor.getAttribute("title") ??
    anchor.textContent?.trim() ??
    anchor.getAttribute("href") ??
    "Article link"
  );
}

function scrollToAnchor(anchor: string) {
  const target = document.getElementById(anchor);
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ArticleScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const cached = useQuery(api.articles.getBySlug, { slug });
  const fetchArticle = useAction(api.wikipedia.fetchAndCacheArticle);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [leadArticle, setLeadArticle] = useState<FullArticlePayload | null>(null);
  const [fullArticle, setFullArticle] = useState<FullArticlePayload | null>(null);
  const [fullStatus, setFullStatus] = useState<"idle" | "loading" | "error">("idle");
  const [leadStatus, setLeadStatus] = useState<"idle" | "loading" | "error">("idle");
  const [activeSection, setActiveSection] = useState("article-lead");
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const activeSlugRef = useRef(slug);
  const pendingAnchorRef = useRef<string | null>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const readerScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeSlugRef.current = slug;
    setLeadArticle(null);
    setFullArticle(null);
    setLeadStatus("idle");
    setFullStatus("idle");
    setStatus("idle");
    setActiveSection("article-lead");
    setHoveredStatus(null);
    setIsReaderOpen(false);
    pendingAnchorRef.current = null;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [slug]);

  useEffect(() => {
    if (cached !== null || status === "loading" || status === "error") {
      return;
    }

    setStatus("loading");
    void fetchArticle({ slug })
      .then(() => {
        if (activeSlugRef.current === slug) {
          setStatus("idle");
        }
      })
      .catch(() => {
        if (activeSlugRef.current === slug) {
          setStatus("error");
        }
      });
  }, [cached, fetchArticle, slug, status]);

  useEffect(() => {
    if (!cached || leadArticle || fullArticle || leadStatus === "loading") {
      return;
    }

    setLeadStatus("loading");

    void fetch(`/api/wikipedia/full/${encodeURIComponent(slug)}?leadOnly=1`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load lead article");
        }

        const article = (await response.json()) as FullArticlePayload;

        if (activeSlugRef.current !== slug) {
          return;
        }

        setLeadArticle(article);
        setLeadStatus("idle");
      })
      .catch(() => {
        if (activeSlugRef.current === slug) {
          setLeadStatus("error");
        }
      });
  }, [cached, fullArticle, leadArticle, leadStatus, slug]);

  const loadFullArticle = useCallback(async () => {
    if (fullArticle) {
      return fullArticle;
    }

    if (fullStatus === "loading") {
      return null;
    }

    setFullStatus("loading");

    try {
      const response = await fetch(`/api/wikipedia/full/${encodeURIComponent(slug)}`);

      if (!response.ok) {
        throw new Error("Could not load full article");
      }

      const article = (await response.json()) as FullArticlePayload;

      if (activeSlugRef.current !== slug) {
        return null;
      }

      setLeadArticle(article);
      setFullArticle(article);
      setFullStatus("idle");

      return article;
    } catch {
      if (activeSlugRef.current === slug) {
        setFullStatus("error");
      }

      return null;
    }
  }, [fullArticle, fullStatus, slug]);

  const openFullArticle = useCallback(
    async (anchor?: string) => {
      const nextAnchor = anchor ?? fullArticle?.toc[0]?.anchor ?? "article-lead";
      pendingAnchorRef.current = nextAnchor;

      if (fullArticle) {
        scrollToAnchor(nextAnchor);
        return;
      }

      const article = await loadFullArticle();
      if (!article) {
        pendingAnchorRef.current = null;
      }
    },
    [fullArticle, loadFullArticle],
  );

  const openReaderMode = useCallback(() => {
    setIsReaderOpen(true);
    if (!fullArticle) {
      void loadFullArticle();
    }
  }, [fullArticle, loadFullArticle]);

  useEffect(() => {
    if (!fullArticle || !pendingAnchorRef.current) {
      return;
    }

    const anchor = pendingAnchorRef.current;
    pendingAnchorRef.current = null;

    requestAnimationFrame(() => {
      scrollToAnchor(anchor);
    });
  }, [fullArticle]);

  useEffect(() => {
    if (!isReaderOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsReaderOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isReaderOpen]);

  useEffect(() => {
    if (!fullArticle) {
      return;
    }

    const sectionIds = [
      "article-lead",
      ...fullArticle.toc.map((section) => section.anchor),
    ];
    const elements = sectionIds
      .map((sectionId) => document.getElementById(sectionId))
      .filter((element): element is HTMLElement => Boolean(element));

    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              Math.abs(left.boundingClientRect.top) -
              Math.abs(right.boundingClientRect.top),
          )[0];

        if (visibleEntry?.target.id) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      {
        rootMargin: "-10% 0px -70% 0px",
        threshold: [0, 0.25, 0.5],
      },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [fullArticle]);

  const loadingMessage = useMemo(() => {
    if (cached === undefined) {
      return "Checking Encarta cache...";
    }
    if (status === "loading") {
      return "Retrieving encyclopedia entry...";
    }
    if (cached === null && status !== "error") {
      return "Updating archive...";
    }
    return "Loading...";
  }, [cached, status]);

  const isLoading =
    cached === undefined || (cached === null && status !== "error");

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

      if (href.startsWith("/articles/")) {
        event.preventDefault();
        router.push(href);
      }
    },
    [router],
  );

  const handleDocumentMouseMove = useCallback(
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

  const handleContentsSelect = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, section: FullArticleTocItem) => {
      if (!fullArticle) {
        event.preventDefault();
        void openFullArticle(section.anchor);
        return;
      }

      event.preventDefault();
      scrollToAnchor(section.anchor);
    },
    [fullArticle, openFullArticle],
  );

  const scrollReaderToTop = useCallback(() => {
    readerScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const articleSidebar = useMemo(
    () => (
      <>
        <div className="bevel-inset mb-4 bg-black px-3 py-4 text-white">
          <div className="text-xs uppercase tracking-[0.3em] text-[#8dd3d3]">
            Encyclopedia
          </div>
          <h1 className="mt-2 text-3xl font-semibold">{cached?.title ?? slug.replaceAll("_", " ")}</h1>
          <p className="mt-3 text-sm leading-5 text-[#d4d4d4]">
            Open the full entry to browse section-by-section like a boxed encyclopedia.
          </p>
        </div>

        <div className="space-y-4 text-sm">
          <section>
            <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">
              Search
            </div>
            <div className="px-2">
              <SearchBox />
            </div>
          </section>

          <section>
            <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">
              Contents
            </div>
            <div className="bevel-inset max-h-[320px] overflow-y-auto bg-white px-2 py-2 text-[14px]">
              <a
                href="#article-lead"
                onClick={(event) => {
                  event.preventDefault();
                  scrollToAnchor("article-lead");
                }}
                className={`article-toc-link ${activeSection === "article-lead" ? "is-active" : ""}`}
              >
                Overview
              </a>

              {fullArticle ? (
                fullArticle.toc.map((section) => (
                  <a
                    key={section.index}
                    href={`#${section.anchor}`}
                    onClick={(event) => handleContentsSelect(event, section)}
                    className={`article-toc-link ${activeSection === section.anchor ? "is-active" : ""}`}
                    style={{ paddingLeft: `${10 + (section.level - 1) * 14}px` }}
                  >
                    <span className="mr-2 text-[#666]">{section.number}</span>
                    {section.title}
                  </a>
                ))
              ) : (
                <div className="px-2 py-3 text-[13px] leading-5 text-[#444]">
                  <p>
                    The overview is open now. Use <b>Read Full Article</b> to load the section tree and all internal links.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-2 bg-[#b0b0b0] px-2 py-1 text-xl font-bold">
              Article Tools
            </div>
            <div className="space-y-2 px-2 text-[15px] text-[#202020]">
              <button
                type="button"
                onClick={() => {
                  void openFullArticle();
                }}
                className="bevel w-full bg-panel px-3 py-2 text-left font-bold disabled:text-[#6b7280]"
                disabled={fullStatus === "loading"}
              >
                {fullArticle
                  ? "Jump To Full Entry"
                  : fullStatus === "loading"
                    ? "Opening Full Entry..."
                    : "Read Full Article"}
              </button>
            </div>
          </section>
        </div>
      </>
    ),
    [activeSection, cached?.title, fullArticle, fullStatus, handleContentsSelect, openFullArticle, slug],
  );

  const actions = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/" className="bevel bg-panel px-4 py-2 font-bold">
          Home
        </Link>
        <button
          type="button"
          onClick={() => {
            void openFullArticle();
          }}
          className="bevel bg-panel px-4 py-2 font-bold disabled:text-[#6b7280]"
          disabled={fullStatus === "loading"}
        >
          {fullArticle ? "Full Entry Open" : fullStatus === "loading" ? "Opening Entry..." : "Read Full Article"}
        </button>
        <div className="bevel-inset bg-white px-4 py-2">
          Current article: {(fullArticle?.title ?? cached?.title ?? slug).replaceAll("_", " ")}
        </div>
        <button
          type="button"
          onClick={openReaderMode}
          className="bevel bg-panel px-4 py-2 font-bold disabled:text-[#6b7280]"
          disabled={fullStatus === "loading" && !fullArticle}
        >
          {isReaderOpen
            ? "Reader Open"
            : fullStatus === "loading" && !fullArticle
              ? "Opening Reader..."
              : "Fullscreen Reader"}
        </button>
      </div>
    ),
    [cached?.title, fullArticle, fullStatus, isReaderOpen, openFullArticle, openReaderMode, slug],
  );

  const statusRight = hoveredStatus ?? (fullArticle ? "Article links ready" : "Overview ready");
  const articleTitle = (fullArticle?.title ?? leadArticle?.title ?? cached?.title ?? slug).replaceAll("_", " ");

  return (
    <>
      <EncartaShell
        title={cached?.title ?? slug.replaceAll("_", " ")}
        subtitle="A sectioned encyclopedia entry with deep article-to-article navigation."
        actions={actions}
        sidebar={articleSidebar}
        statusRight={statusRight}
      >
        {isLoading ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="bevel-inset bg-white px-6 py-5 text-lg">
            {loadingMessage}
          </div>
        </div>
        ) : null}

        {!isLoading && !cached ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="border-2 border-black bg-[#fff2d8] px-6 py-5 text-lg">
            {status === "error"
              ? "Could not load that article. Try another title or confirm the Convex deployment is configured."
              : "Article not found."}
          </div>
        </div>
        ) : null}

        {cached ? (
        <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[1.35fr,0.85fr] lg:p-8">
          <section className="min-w-0 space-y-6">
            <div className="border-2 border-black bg-[rgba(255,255,255,0.82)] p-6">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-black/20 pb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.42em] text-[#1d4b8f]">
                    Encyclopedia Entry
                  </div>
                  <h2 className="font-body text-5xl text-[#111]">
                    {fullArticle?.title ?? leadArticle?.title ?? cached.title}
                  </h2>
                </div>

                {!fullArticle && (cached.image || cached.thumbnail) ? (
                  <div className="hidden w-[180px] shrink-0 border-2 border-black bg-[#fdf7e3] p-2 md:block">
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

              <div
                id="article-lead"
                ref={documentRef}
                onClick={handleDocumentClick}
                onMouseMove={handleDocumentMouseMove}
                onMouseLeave={() => setHoveredStatus(null)}
                className="article-body text-[#1f2937]"
              >
                {fullArticle || leadArticle ? (
                  <div
                    className="article-html article-document"
                    dangerouslySetInnerHTML={{ __html: (fullArticle ?? leadArticle)?.leadHtml ?? "" }}
                  />
                ) : (
                  <div className="article-body text-[#1f2937]">
                    {cached.summary.split("\n").map((paragraph: string, index: number) => (
                      <p
                        key={`${paragraph.slice(0, 20)}-${index}`}
                        className="mb-4"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/20 pt-4 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    void openFullArticle();
                  }}
                  className="bevel bg-panel px-4 py-2 font-bold disabled:text-[#6b7280]"
                  disabled={fullStatus === "loading"}
                >
                  {fullArticle
                    ? "Jump To Sections"
                    : fullStatus === "loading"
                      ? "Opening Full Entry..."
                      : "Read Full Article"}
                </button>
                <button
                  type="button"
                  onClick={openReaderMode}
                  className="bevel bg-panel px-4 py-2 font-bold disabled:text-[#6b7280]"
                  disabled={fullStatus === "loading" && !fullArticle}
                >
                  {fullStatus === "loading" && !fullArticle ? "Opening Reader..." : "Open Reader"}
                </button>
                {fullStatus === "error" ? (
                  <span className="text-[#7c2d12]">
                    The full entry could not be opened right now.
                  </span>
                ) : null}
              </div>
            </div>

            {fullArticle ? (
              <div className="border-2 border-black bg-[rgba(255,248,220,0.86)] p-5">
                <div className="bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">
                  Full Entry
                </div>
                <div
                  className="mt-5 space-y-6"
                  onClick={handleDocumentClick}
                  onMouseMove={handleDocumentMouseMove}
                  onMouseLeave={() => setHoveredStatus(null)}
                >
                  {fullArticle.sections.map((section) => (
                    <section
                      key={section.index}
                      className="article-section border-2 border-black/70 bg-[rgba(255,255,255,0.7)] p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3 border-b border-black/15 pb-3">
                        <div className="font-bold uppercase tracking-[0.18em] text-[#334155]">
                          {section.title}
                        </div>
                        <button
                          type="button"
                          onClick={() => scrollToAnchor("article-lead")}
                          className="bevel bg-panel px-3 py-1 text-xs font-bold"
                        >
                          Back To Top
                        </button>
                      </div>
                      <div
                        className="article-html article-document"
                        dangerouslySetInnerHTML={{ __html: section.html }}
                      />
                    </section>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-2 border-black bg-[rgba(255,248,220,0.85)] p-5">
                <div className="bg-[#b0b0b0] px-2 py-1 text-2xl font-bold">
                  Read More
                </div>
                <p className="article-body mt-4 text-[18px] leading-8 text-[#1f2937]">
                  Open the full entry to browse section by section, follow inline article links, and navigate the encyclopedia the way a 2001 desktop reference app should.
                </p>
              </div>
            )}
          </section>

          <section className="min-w-0 space-y-6">
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
                    onMouseEnter={() => setHoveredStatus(item.title)}
                    onMouseLeave={() => setHoveredStatus(null)}
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
                Link Explorer
              </div>
              <div className="mt-4 space-y-3 text-[15px] leading-7 text-[#1f2937]">
                <p>
                  The overview opens fast from Convex. The full entry unlocks inline article links and the complete section tree.
                </p>
                <p>
                  Use the left rail to jump between sections, or follow links in the body to move article-to-article like a real encyclopedia browser.
                </p>
              </div>
              <div className="mt-5 border-t border-black/20 pt-4 text-sm text-[#334155]">
                {fullArticle
                  ? `${fullArticle.sections.length} major sections loaded into the encyclopedia.`
                  : "Overview mode active. Open the full entry to load sections."}
              </div>
            </div>
          </section>
        </div>
        ) : null}
      </EncartaShell>

      {isReaderOpen ? (
        <div
          className="reader-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsReaderOpen(false);
            }
          }}
        >
          <div className="reader-window window-frame bg-panel text-black" role="dialog" aria-modal="true" aria-label={`${articleTitle} reader`}>
            <div className="title-bar">
              <div className="title-bar-text">Netcarta Reader</div>
              <div className="title-bar-controls">
                <button aria-label="Close" onClick={() => setIsReaderOpen(false)} />
              </div>
            </div>

            <div className="border-b-2 border-black bg-[#d7d7d7] px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="bevel bg-panel px-4 py-2 font-bold">{articleTitle}</div>
                <button
                  type="button"
                  onClick={() => {
                    void openFullArticle();
                  }}
                  className="bevel bg-panel px-4 py-2 font-bold disabled:text-[#6b7280]"
                  disabled={fullStatus === "loading"}
                >
                  {fullArticle ? "Sections Loaded" : fullStatus === "loading" ? "Loading Full Entry..." : "Load Full Entry"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsReaderOpen(false)}
                  className="bevel bg-panel px-4 py-2"
                >
                  Return To Shell
                </button>
              </div>
            </div>

            <div className="reader-body grid bg-[linear-gradient(180deg,#fefefe,#eef4fb)] lg:grid-cols-[220px,1fr]">
              <aside className="reader-sidebar border-r-2 border-black bg-[#efefef] p-4">
                <div className="bg-[#b0b0b0] px-2 py-1 text-xl font-bold">Contents</div>
                <div className="bevel-inset mt-3 max-h-[calc(100vh-240px)] overflow-y-auto bg-white px-2 py-2 text-[14px]">
                  <a href="#" className="article-toc-link is-active">
                    Reader Mode
                  </a>
                  {fullArticle ? (
                    fullArticle.toc.map((section) => (
                      <div
                        key={`reader-${section.index}`}
                        className="article-toc-link"
                        style={{ paddingLeft: `${10 + (section.level - 1) * 14}px` }}
                      >
                        <span className="mr-2 text-[#666]">{section.number}</span>
                        {section.title}
                      </div>
                    ))
                  ) : (
                    <div className="px-2 py-3 text-[13px] leading-5 text-[#444]">
                      The reader opens wide immediately. The complete section list appears after the full entry finishes loading.
                    </div>
                  )}
                </div>
              </aside>

              <div ref={readerScrollRef} className="reader-scroll scroll-panel overflow-y-auto p-5 lg:p-8">
                <div
                  className="reader-document border-2 border-black bg-[rgba(255,255,255,0.92)] p-6 lg:p-10"
                  onClick={handleDocumentClick}
                  onMouseMove={handleDocumentMouseMove}
                  onMouseLeave={() => setHoveredStatus(null)}
                >
                  <div className="mb-6 border-b border-black/20 pb-5">
                    <div className="text-xs uppercase tracking-[0.42em] text-[#1d4b8f]">Reader Mode</div>
                    <h2 className="font-body text-5xl text-[#111] lg:text-6xl">{articleTitle}</h2>
                  </div>

                  {fullArticle || leadArticle ? (
                    <div className="space-y-8">
                      <div
                        className="article-html article-document"
                        dangerouslySetInnerHTML={{ __html: (fullArticle ?? leadArticle)?.leadHtml ?? "" }}
                      />
                      {fullArticle?.sections.map((section) => (
                        <section key={`reader-section-${section.index}`} className="border-t border-black/20 pt-6">
                          <div className="mb-4 flex items-center justify-between gap-3 border-b border-black/15 pb-3">
                            <div className="font-bold uppercase tracking-[0.18em] text-[#334155]">
                              {section.title}
                            </div>
                            <button
                              type="button"
                              onClick={scrollReaderToTop}
                              className="bevel bg-panel px-3 py-1 text-xs font-bold"
                            >
                              Back To Top
                            </button>
                          </div>
                          <div
                            className="article-html article-document"
                            dangerouslySetInnerHTML={{ __html: section.html }}
                          />
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="article-body text-[#1f2937]">
                      {cached?.summary.split("\n").map((paragraph: string, index: number) => (
                        <p key={`reader-summary-${paragraph.slice(0, 20)}-${index}`} className="mb-4">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}

                  {fullStatus === "loading" ? (
                    <div className="mt-8 border-t border-black/20 pt-4 text-sm text-[#475569]">
                      Loading the full reader entry...
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
