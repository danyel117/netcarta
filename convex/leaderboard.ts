import { query } from "./_generated/server";

export const topEntries = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("leaderboard").withIndex("by_createdAt").order("desc").take(10);
  },
});
