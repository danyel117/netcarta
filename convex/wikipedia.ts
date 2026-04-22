import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

async function fetchWikipediaSummary(slug: string): Promise<{
  title: string;
  extract: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
}> {
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
    {
      headers: {
        "User-Agent": "Netcarta/0.1 (Hackathon Project)",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Could not fetch Wikipedia summary for ${slug}`);
  }

  return (await response.json()) as {
    title: string;
    extract: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
  };
}

async function fetchWikipediaRelated(slug: string): Promise<{
  pages?: Array<{ title?: string; key?: string }>;
}> {
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/related/${encodeURIComponent(slug)}`,
    {
      headers: {
        "User-Agent": "Netcarta/0.1 (Hackathon Project)",
      },
    },
  );

  if (!response.ok) {
    return { pages: [] };
  }

  return (await response.json()) as {
    pages?: Array<{ title?: string; key?: string }>;
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
      return {
        slug: existing.slug,
        title: existing.title,
        summary: existing.summary,
        thumbnail: existing.thumbnail,
        image: existing.image,
        seeAlso: existing.seeAlso,
      };
    }

    const summary = await fetchWikipediaSummary(args.slug);
    const related = await fetchWikipediaRelated(args.slug);

    const article: ArticlePayload = {
      slug: args.slug,
      title: summary.title,
      summary: summary.extract,
      thumbnail: summary.thumbnail?.source,
      image: summary.originalimage?.source,
      seeAlso: (related.pages ?? [])
        .filter(
          (page): page is { title: string; key: string } =>
            Boolean(page?.title && page?.key && page.key !== args.slug),
        )
        .slice(0, 10)
        .map((page) => ({ slug: page.key, title: page.title })),
    };

    await ctx.runMutation(api.articles.upsertArticle, article);
    return article;
  },
});

export const searchWikipedia = action({
  args: { query: v.string() },
  handler: async (_ctx, args): Promise<Array<{ slug: string; title: string }>> => {
    const response = await fetch(
      `https://en.wikipedia.org/rest.php/v1/search/title?q=${encodeURIComponent(args.query)}&limit=10`,
      {
        headers: {
          "User-Agent": "Netcarta/0.1 (Hackathon Project)",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Search failed");
    }

    const data = (await response.json()) as {
      pages?: Array<{ key: string; title: string; excerpt?: string }>;
    };

    return (data.pages ?? []).map((page) => ({
      slug: page.key,
      title: page.title,
    }));
  },
});
