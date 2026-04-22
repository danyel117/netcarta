# Netcarta

Minimal Next.js + Convex scaffold for Netcarta, deployed on Cloudflare Workers via OpenNext.

## Requirements

- Bun
- Node-compatible environment for Convex CLI
- Wrangler auth (`wrangler login`)
- Convex project URL and API key

## Local setup

1. Install dependencies:

```bash
bun install
```

2. Copy env template and set values:

```bash
cp .env.example .env.local
```

3. Run the app:

```bash
bun run dev
```

> `NEXT_PUBLIC_CONVEX_URL` is required at build time for client-side Convex access.

> `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are required for the article recommendation dialog when you want Workers AI enabled locally.

## Cloudflare deployment

Use OpenNext wrappers for Worker deploys:

```bash
bun run deploy
```

To test locally as a Worker:

```bash
bun run preview
```

## Git-connected Cloudflare deploy checklist

When deployment is triggered from Cloudflare Git integration, environment variables are read from Cloudflare project settings, not local `.env.local` files.

- Set plain env var: `NEXT_PUBLIC_CONVEX_URL`
- Set plain env var: `CLOUDFLARE_ACCOUNT_ID`
- Set plain env var: `CLOUDFLARE_AI_MODEL` (optional, defaults to `@cf/moonshotai/kimi-k2.6`)
- Set secret: `CONVEX_API_KEY` (or your preferred deployment-only secret)
- Set secret: `CLOUDFLARE_API_TOKEN`

If deploying manually with Wrangler and secret support is needed, use:

```bash
wrangler secret put CONVEX_API_KEY
wrangler secret put CLOUDFLARE_API_TOKEN
```

The recommendation feature validates every AI suggestion against Wikipedia before showing the links, and falls back to direct Wikipedia search results if Workers AI is unavailable.

## Notes

- `.env` is intentionally ignored in git and should only be local.
- `.dev.vars` is used for worker/development env defaults.
