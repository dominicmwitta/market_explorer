# DSE Market Explorer — Web

A Next.js frontend for the same Neon Postgres database used by the Python
pipeline/dashboard (`dse_explorer/`). Read-only: all writes still come from
the daily scraping pipeline.

## Pages

- `/` — market summary, top gainers/losers
- `/sectors` — sector performance breakdown
- `/order-book` — latest bid/offer pressure across all stocks
- `/stocks/[ticker]` — price history + bid/offer ratio trend for one stock

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in DATABASE_URL
npm run dev
```

Open http://localhost:3000.

## Deploying for free (Vercel + Neon)

1. Push this branch to GitHub (already done if you're reading this from the repo).
2. Go to https://vercel.com, sign in with GitHub, and click **Add New → Project**.
3. Import the `market_explorer` repo. When asked for the **Root Directory**,
   set it to `web` (this is the important part — the repo root also has the
   unrelated Python package, Vercel must only build this subfolder).
4. Framework preset should auto-detect as **Next.js**. Leave build/output
   settings default.
5. Add an environment variable: `DATABASE_URL` = the same Neon connection
   string used by the Python pipeline (`postgresql://...`). You can copy it
   from the repo root's `.env`, or from the Neon dashboard's **Connection
   Details** panel — either the same database, or a Neon **branch** if you'd
   rather the website read from an isolated copy.
6. Click **Deploy**. Every future push to this branch auto-redeploys.
7. Optional: Vercel has a native **Neon integration**
   (Project Settings → Integrations) that manages the `DATABASE_URL` env var
   for you automatically instead of pasting it in by hand.

Vercel's free **Hobby** tier covers this comfortably: it's a small, low-traffic
site with no backend of its own beyond querying Neon, and Hobby includes a
generous free allowance of bandwidth/build minutes plus a free `*.vercel.app`
subdomain (custom domains are also free to attach).
