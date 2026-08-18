# Oddy Board

A playful, meme-powered leaderboard for friend groups. Raise an "OD" against
someone, let the group judge it asynchronously, and watch the leaderboard
update. See the full product spec in the project's PRD.

## Stack

- Next.js (App Router, TypeScript, Tailwind)
- Prisma + SQLite

## Getting started

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db
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
