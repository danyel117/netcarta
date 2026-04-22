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
};
