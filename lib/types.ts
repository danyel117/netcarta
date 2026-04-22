export type ArticlePreview = {
  slug: string;
  title: string;
};

export type ArticleRecord = {
  slug: string;
  title: string;
  summary: string;
  thumbnail?: string;
  image?: string;
  seeAlso: ArticlePreview[];
  fetchedAt: number;
};
