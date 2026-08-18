import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeExpiredOds, getLeaderboard } from "@/lib/od";
import { parseScoringRule, severityForOutcome } from "@/lib/scoring";

const odInclude = {
  raisedBy: true,
  accused: true,
  category: { include: { assets: true } },
  votes: true,
} as const;

function pickAsset(assets: { severity: string | null }[], severity: string | null) {
  if (assets.length === 0) return null;
  const matching = severity ? assets.filter((a) => a.severity === severity) : [];
  const pool = matching.length > 0 ? matching : assets;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await prisma.board.findUnique({ where: { slug } });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  await closeExpiredOds(board.id);

  const [leaderboard, latestRaised, latestClosed, pendingCount] = await Promise.all([
    getLeaderboard(board.id),
    prisma.oD.findFirst({
      where: { boardId: board.id },
      orderBy: { createdAt: "desc" },
      include: odInclude,
    }),
    prisma.oD.findFirst({
      where: { boardId: board.id, status: "CLOSED" },
      orderBy: { closesAt: "desc" },
      include: odInclude,
    }),
    prisma.oD.count({ where: { boardId: board.id, status: "PENDING" } }),
  ]);

  const latestRaisedAsset = latestRaised
    ? pickAsset(latestRaised.category.assets, null)
    : null;

  const latestClosedAsset = latestClosed
    ? pickAsset(
        latestClosed.category.assets,
        severityForOutcome(latestClosed.votes, parseScoringRule(latestClosed.category.scoringRule))
      )
    : null;

  return NextResponse.json({
    board,
    leaderboard,
    pendingCount,
    latestRaised: latestRaised ? { ...latestRaised, asset: latestRaisedAsset } : null,
    latestClosed: latestClosed ? { ...latestClosed, asset: latestClosedAsset } : null,
    now: Date.now(),
  });
}
