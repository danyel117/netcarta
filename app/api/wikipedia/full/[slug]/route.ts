import { NextResponse } from "next/server";

import { fetchFullArticlePayload } from "@/lib/wikipedia-full";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const leadOnly = searchParams.get("leadOnly") === "1";

  try {
    const article = await fetchFullArticlePayload(decodeURIComponent(slug), {
      includeSections: !leadOnly,
    });

    return NextResponse.json(article, {
      headers: {
        "Cache-Control": "s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load the full Wikipedia article.",
      },
      { status: 500 },
    );
  }
}
