# Oddy Board

A playful, meme-powered leaderboard for friend groups. Raise an "OD" against
someone, let the group judge it asynchronously, and watch the leaderboard
update. See the full product spec in the project's PRD.

## Stack

- Next.js (App Router, TypeScript, Tailwind)
- Prisma + PostgreSQL
- Images (member photos, evidence, category assets) are stored as `data:`
  URLs directly in the database — no filesystem writes, so it runs the same
  locally and on serverless hosts.

## Deploy (Vercel)

1. [Deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHabeeb00%2Fodi%2Ftree%2Fclaude%2Foddy-board-prd-t2wuxs&project-name=oddy-board&repository-name=oddy-board) and sign in with GitHub.
2. On the "Configure Project" screen, add an environment variable
   `DATABASE_URL` pointing at any Postgres database (see below for a free
   one). Deploy.
3. If you add the database *after* the first deploy: open the project →
   **Storage** tab → **Create Database** → Postgres, connect it to the
   project, then copy its connection string into a `DATABASE_URL` env var
   (Settings → Environment Variables) and hit **Redeploy**.

The build runs `prisma db push` automatically, so the schema is created on
first deploy — no manual migration step.

**Free Postgres options** if you don't already have one: Vercel's own
Postgres/Neon integration (Storage tab, no separate signup), or
[neon.tech](https://neon.tech) / [supabase.com](https://supabase.com)
directly.

## Local development

```bash
npm install
# set DATABASE_URL in .env to a Postgres connection string
npx prisma db push
npm run dev
```

Open http://localhost:3000, create a board, and share the `/b/<slug>` link
with your group. Open `/b/<slug>/display` on a shared screen (TV, monitor)
for the live leaderboard and OD announcements.

## How it works

- **Raise an OD** — pick who it's against, a category, and describe what
  happened. Evidence photos are optional.
- **Async voting** — every board member can vote `OD` / `Small OD` / `Reject`
  whenever they're free; nobody needs to be online at the same time.
- **Auto-close** — each case closes automatically after the board's voting
  window (default 24h) and scores itself from the accumulated votes.
- **Leaderboard** — scores are the sum of every closed case's score per
  member, always derived live from votes (no separate score table to keep in
  sync).
- **Assets** — admins upload category-specific images/dialogues in
  `/b/<slug>/admin`; the display and voting screens surface them instead of
  generic decoration. Oddy Board never generates humour with AI — the
  personality comes entirely from what you upload.
