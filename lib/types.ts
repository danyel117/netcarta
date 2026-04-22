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

export type RaceSnapshot = {
  room: {
    _id: string;
    code: string;
    startArticle: string;
    endArticle: string;
    status: "lobby" | "racing" | "finished";
    startedAt?: number;
    finishedAt?: number;
    winnerId?: string;
  };
  participants: Array<{
    _id: string;
    displayName: string;
    userId: string;
    currentArticle: string;
    path: string[];
    clickCount: number;
    finished: boolean;
    finishedAt?: number;
  }>;
  leaderboardEntry?: {
    winnerName: string;
    clicks: number;
    timeMs: number;
  };
};
