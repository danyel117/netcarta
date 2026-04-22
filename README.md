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
- Set secret: `CONVEX_API_KEY` (or your preferred deployment-only secret)

If deploying manually with Wrangler and secret support is needed, use:

```bash
wrangler secret put CONVEX_API_KEY
```

## Notes

- `.env` is intentionally ignored in git and should only be local.
- `.dev.vars` is used for worker/development env defaults.
