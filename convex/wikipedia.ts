import { v } from "convex/values";

import {
  fetchWikipediaArticle,
  resolveCanonicalTitle,
  searchWikipedia as searchWikipediaResults,
} from "../lib/wikipedia";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

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
      thumbnail: page.thumbnail,
      image: page.originalImage,
      seeAlso: page.links.slice(0, 10),
    });

    await ctx.runMutation(api.articles.upsertArticle, article);
    return article;
  },
});

export const searchWikipedia = action({
  args: { query: v.string() },
  handler: async (_ctx, args): Promise<Array<{ slug: string; title: string }>> => {
    return await searchWikipediaResults(args.query, 10);
  },
});
