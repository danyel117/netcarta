import { NextResponse } from "next/server";

import type { ArticlePreview } from "@/lib/types";
import { resolveArticlePreview, searchWikipedia } from "@/lib/wikipedia";

const DEFAULT_MODEL = "@cf/moonshotai/kimi-k2.5";
const MAX_RECOMMENDATIONS = 5;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
};

type ChatContent =
  | string
  | Array<{
      type?: string;
      text?: string;
    }>
  | undefined;

function normalizeUserQuery(query: unknown) {
  if (typeof query !== "string") {
    return "";
  }

  return query.replace(/\s+/g, " ").trim();
}

function extractChatContent(content: ChatContent) {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

function parseSuggestedTitles(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*•]\s*/, "")
        .replace(/^\d+[.)]\s*/, "")
        .replace(/^"(.*)"$/, "$1"),
    )
    .filter(Boolean);
}

async function fetchAiSuggestions(query: string): Promise<string[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_AI_MODEL ?? DEFAULT_MODEL;

  if (!accountId || !apiToken) {
    return [];
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_completion_tokens: 180,
        messages: [
          {
            role: "system",
            content:
              "You recommend broad, foundational English Wikipedia article titles for curious general readers. Return exactly five likely-existing article titles, one per line, with no numbering, bullets, commentary, or markdown. Prefer canonical encyclopedia topics. Avoid niche topics, duplicates, list pages, timelines, and disambiguation pages.",
          },
          {
            role: "user",
            content: `Topic: ${query}`,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Workers AI request failed with ${response.status}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = extractChatContent(payload.choices?.[0]?.message?.content);
  return parseSuggestedTitles(content).slice(0, MAX_RECOMMENDATIONS);
}

async function buildRecommendations(query: string): Promise<ArticlePreview[]> {
  const recommendations: ArticlePreview[] = [];
  const seenSlugs = new Set<string>();

  const addRecommendation = (article: ArticlePreview | null) => {
    if (!article || seenSlugs.has(article.slug)) {
      return;
    }

    seenSlugs.add(article.slug);
    recommendations.push(article);
  };

  try {
    const aiSuggestions = await fetchAiSuggestions(query);
    for (const suggestion of aiSuggestions) {
      if (recommendations.length >= MAX_RECOMMENDATIONS) {
        break;
      }

      addRecommendation(await resolveArticlePreview(suggestion));
    }
  } catch {
    // Falling back to direct Wikipedia search keeps the feature usable without AI.
  }

  if (recommendations.length < MAX_RECOMMENDATIONS) {
    const fallbackResults = await searchWikipedia(query, 10);
    for (const article of fallbackResults) {
      addRecommendation(article);
      if (recommendations.length >= MAX_RECOMMENDATIONS) {
        break;
      }
    }
  }

  return recommendations.slice(0, MAX_RECOMMENDATIONS);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { query?: unknown }
    | null;
  const query = normalizeUserQuery(body?.query);

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Please enter a topic with at least 2 characters." },
      { status: 400 },
    );
  }

  const recommendations = await buildRecommendations(query);

  if (recommendations.length === 0) {
    return NextResponse.json(
      { error: "No related articles were found for that topic." },
      { status: 502 },
    );
  }

  return NextResponse.json({ recommendations });
}
