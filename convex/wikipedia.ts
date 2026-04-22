import { v } from "convex/values";

import { api } from "./_generated/api";
import { action } from "./_generated/server";

async function fetchWikipediaArticle(slug: string) {
  const summaryResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`, {
    headers: {
      "User-Agent": "Netcarta/0.1 (Hackathon Project)",
    },
  });

  if (!summaryResponse.ok) {
    throw new Error(`Could not fetch Wikipedia summary for ${slug}`);
  }

  const summary = (await summaryResponse.json()) as {
    title: string;
    extract: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
  };

  const relatedResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/related/${encodeURIComponent(slug)}`, {
    headers: {
      "User-Agent": "Netcarta/0.1 (Hackathon Project)",
    },
  });

  const related = relatedResponse.ok
    ? ((await relatedResponse.json()) as {
        pages?: Array<{ title?: string; key?: string }>;
      })
    : { pages: [] };

  return {
    slug,
    title: summary.title,
    summary: summary.extract,
    thumbnail: summary.thumbnail?.source,
    image: summary.originalimage?.source,
    seeAlso: (related.pages ?? [])
      .filter((page): page is { title: string; key: string } => Boolean(page?.title && page?.key && page.key !== slug))
      .slice(0, 10)
      .map((page) => ({ slug: page.key, title: page.title })),
  };
}

export const fetchAndCacheArticle = action({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(api.articles.getBySlug, { slug: args.slug });
    if (existing && Date.now() - existing.fetchedAt < 1000 * 60 * 60 * 6) {
      return existing;
    }

    const article = await fetchWikipediaArticle(args.slug);
    await ctx.runMutation(api.articles.upsertArticle, article);
    return article;
  },
});
