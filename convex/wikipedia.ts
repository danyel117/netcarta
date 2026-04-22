import { v } from "convex/values";

import { api } from "./_generated/api";
import { action } from "./_generated/server";

const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "Netcarta/0.1 (Hackathon Project)";

function toSearchQuery(slug: string) {
  return decodeURIComponent(slug).replaceAll("_", " ").trim();
}

function toArticleSlug(title: string) {
  return title.replaceAll(" ", "_");
}

async function fetchWikipediaJson<T>(params: URLSearchParams): Promise<T> {
  params.set("format", "json");
  params.set("formatversion", "2");

  const response = await fetch(`${WIKIPEDIA_API_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": USER_AGENT,
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
        title?: string;
        missing?: boolean;
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

async function fetchWikipediaArticle(title: string): Promise<{
  title: string;
  extract: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  links: Array<{ title: string }>;
}> {
  const response = await fetchWikipediaJson<{
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
  }>(
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
    thumbnail: page.thumbnail,
    originalimage: page.original,
    links: page.links ?? [],
  };
}

type ArticlePayload = {
  slug: string;
  title: string;
  summary: string;
  thumbnail?: string;
  image?: string;
  seeAlso: Array<{ slug: string; title: string }>;
};

function withOptionalImages<T extends {
  slug: string;
  title: string;
  summary: string;
  seeAlso: Array<{ slug: string; title: string }>;
}>(article: T & { thumbnail?: string; image?: string }): ArticlePayload {
  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    seeAlso: article.seeAlso,
    ...(article.thumbnail ? { thumbnail: article.thumbnail } : {}),
    ...(article.image ? { image: article.image } : {}),
  };
}

export const fetchAndCacheArticle = action({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<ArticlePayload> => {
    const existing: {
      _id: string;
      slug: string;
      title: string;
      summary: string;
      thumbnail?: string;
      image?: string;
      seeAlso: Array<{ slug: string; title: string }>;
      fetchedAt: number;
    } | null = await ctx.runQuery(api.articles.getBySlug, {
      slug: args.slug,
    });

    if (existing && Date.now() - existing.fetchedAt < 1000 * 60 * 60 * 6) {
      return withOptionalImages(existing);
    }

    const canonicalTitle = await resolveCanonicalTitle(args.slug);
    const page = await fetchWikipediaArticle(canonicalTitle);

    const article = withOptionalImages({
      slug: args.slug,
      title: page.title,
      summary: page.extract,
      thumbnail: page.thumbnail?.source,
      image: page.originalimage?.source,
      seeAlso: page.links
        .filter((link) => Boolean(link.title))
        .slice(0, 10)
        .map((link) => ({
          slug: toArticleSlug(link.title),
          title: link.title,
        })),
    });

    await ctx.runMutation(api.articles.upsertArticle, article);
    return article;
  },
});

export const searchWikipedia = action({
  args: { query: v.string() },
  handler: async (_ctx, args): Promise<Array<{ slug: string; title: string }>> => {
    const data = await fetchWikipediaJson<{
      query?: {
        search?: Array<{ title: string }>;
      };
    }>(
      new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: args.query,
        srlimit: "10",
      }),
    );

    return (data.query?.search ?? []).map((page) => ({
      slug: toArticleSlug(page.title),
      title: page.title,
    }));
  },
});
