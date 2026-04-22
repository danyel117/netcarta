import type { ArticlePreview } from "./types";

const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "Netcarta/0.1 (Hackathon Project)";
const REVALIDATE_SECONDS = 60 * 60 * 6;

type TocItemResponse = {
  anchor: string;
  hLevel: number;
  index: string;
  line: string;
  number: string;
  tocLevel: number;
};

export type FullArticleTocItem = {
  anchor: string;
  index: string;
  level: number;
  number: string;
  title: string;
};

export type FullArticleSection = {
  anchor: string;
  html: string;
  index: string;
  title: string;
};

export type FullArticlePayload = {
  canonicalSlug: string;
  leadHtml: string;
  sections: FullArticleSection[];
  title: string;
  toc: FullArticleTocItem[];
  articleLinks: ArticlePreview[];
};

function toSearchQuery(slug: string) {
  return decodeURIComponent(slug).replaceAll("_", " ").trim();
}

function toArticleSlug(title: string) {
  return title.replaceAll(" ", "_");
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function fetchWikipediaJson<T>(params: URLSearchParams): Promise<T> {
  params.set("format", "json");
  params.set("formatversion", "2");

  const response = await fetch(`${WIKIPEDIA_API_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": USER_AGENT,
    },
    next: {
      revalidate: REVALIDATE_SECONDS,
    },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function resolveCanonicalTitle(slug: string): Promise<string> {
  const requested = toSearchQuery(slug);
  const titleFromSlug = requested
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const directLookup = await fetchWikipediaJson<{
    query?: {
      pages?: Array<{
        missing?: boolean;
        title?: string;
      }>;
    };
  }>(
    new URLSearchParams({
      action: "query",
      redirects: "1",
      titles: titleFromSlug,
    }),
  );

  const directPage = directLookup.query?.pages?.[0];
  if (directPage?.title && !directPage.missing) {
    return directPage.title;
  }

  const searchLookup = await fetchWikipediaJson<{
    query?: {
      search?: Array<{
        title: string;
      }>;
    };
  }>(
    new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: requested,
      srlimit: "5",
    }),
  );

  const normalizedRequested = requested.toLowerCase();
  const exactMatch = searchLookup.query?.search?.find(
    (result) => result.title.toLowerCase() === normalizedRequested,
  );

  if (exactMatch) {
    return exactMatch.title;
  }

  const firstResult = searchLookup.query?.search?.[0]?.title;
  if (firstResult) {
    return firstResult;
  }

  throw new Error(`Could not resolve a Wikipedia title for ${slug}`);
}

function normalizeHref(href: string) {
  if (href.startsWith("//")) {
    return `https:${href}`;
  }

  return href;
}

function rewriteAnchorTag(
  _match: string,
  beforeHref: string,
  href: string,
  afterHref: string,
  articleLinks: Map<string, string>,
) {
  const normalizedHref = normalizeHref(href);

  if (normalizedHref.startsWith("#")) {
    return `<a${beforeHref}href="${normalizedHref}"${afterHref}>`;
  }

  if (normalizedHref.startsWith("/wiki/")) {
    const [pagePath, hash = ""] = normalizedHref.slice("/wiki/".length).split("#");
    const decodedPagePath = decodeURIComponent(pagePath);
    const targetTitle = decodedPagePath.replaceAll("_", " ");
    const firstSegment = decodedPagePath.split("/")[0] ?? "";

    if (firstSegment.includes(":")) {
      return `<a${beforeHref}href="https://en.wikipedia.org${normalizedHref}"${afterHref} target="_blank" rel="noreferrer">`;
    }

    const articleSlug = decodedPagePath.replaceAll(" ", "_");
    const localHref = `/articles/${encodeURIComponent(articleSlug)}${hash ? `#${hash}` : ""}`;
    const label = escapeAttribute(targetTitle);

    articleLinks.set(articleSlug, targetTitle);

    return `<a${beforeHref}href="${localHref}"${afterHref} data-netcarta-link="article" data-netcarta-target="${label}" data-netcarta-slug="${escapeAttribute(articleSlug)}">`;
  }

  if (normalizedHref.startsWith("/")) {
    return `<a${beforeHref}href="https://en.wikipedia.org${normalizedHref}"${afterHref} target="_blank" rel="noreferrer">`;
  }

  if (normalizedHref.startsWith("http://") || normalizedHref.startsWith("https://")) {
    return `<a${beforeHref}href="${normalizedHref}"${afterHref} target="_blank" rel="noreferrer">`;
  }

  return `<a${beforeHref}href="${normalizedHref}"${afterHref}>`;
}

function normalizeSectionHtml(html: string, articleLinks: Map<string, string>) {
  let normalized = html;

  normalized = normalized.replace(/<!--([\s\S]*?)-->/g, "");
  normalized = normalized.replace(/<style[\s\S]*?<\/style>/gi, "");
  normalized = normalized.replace(/<script[\s\S]*?<\/script>/gi, "");
  normalized = normalized.replace(/<link[^>]*>/gi, "");
  normalized = normalized.replace(/<meta[^>]*>/gi, "");
  normalized = normalized.replace(/<span class="mw-editsection">[\s\S]*?<\/span>/gi, "");
  normalized = normalized.replace(/<table[^>]*class="[^"]*(?:ambox|navbox|vertical-navbox|metadata)[^"]*"[\s\S]*?<\/table>/gi, "");
  normalized = normalized.replace(/<div[^>]*class="[^"]*(?:shortdescription|hatnote|navbox|catlinks)[^"]*"[\s\S]*?<\/div>/gi, "");
  normalized = normalized.replace(/<span[^>]*class="[^"]*Template-Fact[^"]*"[\s\S]*?<\/span>/gi, "");
  normalized = normalized.replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, "");
  normalized = normalized.replace(/<span[^>]*class="[^"]*mw-ext-cite-error[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "");
  normalized = normalized.replace(/<div[^>]*class="[^"]*(?:mw-references-wrap|reflist)[^"]*"[\s\S]*?<\/div>/gi, "");
  normalized = normalized.replace(/<ol[^>]*class="[^"]*references[^"]*"[^>]*>[\s\S]*?<\/ol>/gi, "");
  normalized = normalized.replace(/<p>\s*Cite error:[\s\S]*?<\/p>/gi, "");
  normalized = normalized.replace(/="\/\//g, '="https://');
  normalized = normalized.replace(/,\s*\/\//g, ", https://");
  normalized = normalized.replace(/<a\b([^>]*?)href="([^"]+)"([^>]*)>/gi, (match, beforeHref, href, afterHref) =>
    rewriteAnchorTag(match, beforeHref, href, afterHref, articleLinks),
  );

  return normalized.trim();
}

function shouldIncludeSection(section: FullArticleTocItem) {
  const normalizedTitle = section.title.trim().toLowerCase();

  return ![
    "references",
    "external links",
    "further reading",
    "notes",
    "footnotes",
    "citations",
  ].includes(normalizedTitle);
}

async function fetchSectionHtml(
  title: string,
  sectionIndex: string,
  articleLinks: Map<string, string>,
) {
  const response = await fetchWikipediaJson<{
    parse?: {
      text?: string;
    };
  }>(
    new URLSearchParams({
      action: "parse",
      page: title,
      prop: "text",
      section: sectionIndex,
    }),
  );

  return normalizeSectionHtml(response.parse?.text ?? "", articleLinks);
}

export async function fetchFullArticlePayload(
  slug: string,
  options?: { includeSections?: boolean },
): Promise<FullArticlePayload> {
  const includeSections = options?.includeSections ?? true;
  const title = await resolveCanonicalTitle(slug);
  const articleLinks = new Map<string, string>();
  const tocResponse = await fetchWikipediaJson<{
    parse?: {
      tocdata?: {
        sections?: TocItemResponse[];
      };
    };
  }>(
    new URLSearchParams({
      action: "parse",
      page: title,
      prop: "tocdata",
    }),
  );

  const toc = (tocResponse.parse?.tocdata?.sections ?? [])
    .map((section) => ({
      anchor: section.anchor,
      index: section.index,
      level: section.tocLevel,
      number: section.number,
      title: section.line,
    }))
    .filter(shouldIncludeSection);

  const leadHtml = await fetchSectionHtml(title, "0", articleLinks);
  const topLevelSections = toc.filter((section) => section.level === 1);

  const sections = includeSections
    ? await Promise.all(
        topLevelSections.map(async (section) => ({
          anchor: section.anchor,
          html: await fetchSectionHtml(title, section.index, articleLinks),
          index: section.index,
          title: section.title,
        })),
      )
    : [];

  return {
    canonicalSlug: toArticleSlug(title),
    leadHtml,
    sections,
    title,
    toc,
    articleLinks: Array.from(articleLinks.entries()).map(([linkSlug, linkTitle]) => ({
      slug: linkSlug,
      title: linkTitle,
    })),
  };
}
