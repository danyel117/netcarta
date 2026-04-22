import { ArticleScreen } from "@/components/articles/article-screen";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArticleScreen slug={decodeURIComponent(slug)} />;
}
