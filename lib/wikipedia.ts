import type { ArticlePreview } from "./types";

const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";
const API_USER_AGENT = "Netcarta/0.1 (Hackathon Project)";

type SearchResponse = {
  query?: {
    search?: Array<{
      title: string;
    }>;
  };
};

type TitleLookupResponse = {
  query?: {
    pages?: Array<{
      title?: string;
      missing?: boolean;
    }>;
  };
};

type ArticleResponse = {
  query?: {
    pages?: Array<{
      title: string;
      extract?: string;
      thumbnail?: { source?: string };
      original?: { source?: string };
      links?: Array<{ title: string }>;
      missing?: boolean;
    }>;
  };
};

export type WikipediaArticle = {
  title: string;
  extract: string;
  thumbnail?: string;
  originalImage?: string;
  links: ArticlePreview[];
};

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeWikipediaQuery(value: string) {
  return safeDecodeURIComponent(value)
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleHint(query: string) {
  return query
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toArticleSlug(title: string) {
  return title.trim().replace(/\s+/g, "_");
}

async function fetchWikipediaJson<T>(params: URLSearchParams): Promise<T> {
  params.set("format", "json");
  params.set("formatversion", "2");

  const response = await fetch(`${WIKIPEDIA_API_URL}?${params.toString()}`, {
    headers: {
      "Api-User-Agent": API_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function lookupPageTitle(title: string) {
  if (!title) {
    return null;
  }

  const lookup = await fetchWikipediaJson<TitleLookupResponse>(
    new URLSearchParams({
      action: "query",
      redirects: "1",
      titles: title,
    }),
  );

  const page = lookup.query?.pages?.[0];
  if (page?.title && !page.missing) {
    return page.title;
  }

  return null;
}

export async function searchWikipedia(
  query: string,
  limit = 10,
): Promise<ArticlePreview[]> {
  const requested = normalizeWikipediaQuery(query);
  if (!requested) {
    return [];
  }

  const data = await fetchWikipediaJson<SearchResponse>(
    new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: requested,
      srlimit: String(limit),
    }),
  );

  const seen = new Set<string>();

  return (data.query?.search ?? []).flatMap((page) => {
    const slug = toArticleSlug(page.title);
    if (seen.has(slug)) {
      return [];
    }

    seen.add(slug);
    return [{ slug, title: page.title }];
  });
}

export async function resolveCanonicalTitle(query: string): Promise<string> {
  const requested = normalizeWikipediaQuery(query);
  if (!requested) {
    throw new Error("Could not resolve an empty Wikipedia title");
  }

  const directCandidates = Array.from(
    new Set([requested, toTitleHint(requested)]),
  );

  for (const candidate of directCandidates) {
    const resolvedTitle = await lookupPageTitle(candidate);
    if (resolvedTitle) {
      return resolvedTitle;
    }
  }

  const searchResults = await searchWikipedia(requested, 5);
  const normalizedRequested = requested.toLowerCase();
  const exactMatch = searchResults.find(
    (result) => result.title.toLowerCase() === normalizedRequested,
  );

  if (exactMatch) {
    return exactMatch.title;
  }

  const firstResult = searchResults[0]?.title;
  if (firstResult) {
    return firstResult;
  }

  throw new Error(`Could not resolve a Wikipedia title for ${query}`);
}

export async function resolveArticlePreview(
  query: string,
): Promise<ArticlePreview | null> {
  try {
    const title = await resolveCanonicalTitle(query);
    return {
      slug: toArticleSlug(title),
      title,
    };
  } catch {
    return null;
  }
}

export async function fetchWikipediaArticle(
  title: string,
): Promise<WikipediaArticle> {
  const response = await fetchWikipediaJson<ArticleResponse>(
    new URLSearchParams({
      action: "query",
      prop: "extracts|pageimages|links",
      redirects: "1",
      explaintext: "1",
      exintro: "1",
      piprop: "original|thumbnail",
      pithumbsize: "520",
      plnamespace: "0",
      pllimit: "20",
      titles: title,
    }),
  );

  const page = response.query?.pages?.[0];
  if (!page || page.missing) {
    throw new Error(`Could not fetch Wikipedia page for ${title}`);
  }

  return {
    title: page.title,
    extract: page.extract ?? "",
    thumbnail: page.thumbnail?.source,
    originalImage: page.original?.source,
    links: (page.links ?? []).filter((link) => Boolean(link.title)).map((link) => ({
      slug: toArticleSlug(link.title),
      title: link.title,
    })),
  };
}
