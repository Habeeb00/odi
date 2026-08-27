import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeExpiredOds, getLeaderboard } from "@/lib/od";
import { parseScoringRule, severityForOutcome } from "@/lib/scoring";
import { assetFileUrl, memberImageUrl } from "@/lib/media";

const odInclude = {
  raisedBy: true,
  accused: true,
  category: { include: { assets: true } },
  votes: true,
} as const;

function pickAsset<T extends { severity: string | null }>(assets: T[], severity: string | null): T | null {
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

  const [leaderboard, latestRaised, latestClosed, pendingOds] = await Promise.all([
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
    // Just enough to drive the display's live crying/laughing photo — the
    // full pending-OD objects aren't needed here, so keep this cheap rather
    // than making the display page fetch them in a second request.
    prisma.oD.findMany({
      where: { boardId: board.id, status: "PENDING" },
      select: { accusedId: true, raisedById: true },
    }),
  ]);
  const pendingCount = pendingOds.length;

  const latestRaisedAsset = latestRaised
    ? pickAsset(latestRaised.category.assets, null)
    : null;

  const latestClosedAsset = latestClosed
    ? pickAsset(
        latestClosed.category.assets,
        severityForOutcome(latestClosed.votes, parseScoringRule(latestClosed.category.scoringRule))
      )
    : null;

  // category.assets carries every asset's full data: URL for the category — it's
  // only needed server-side to pick one above, so drop it before serializing to
  // keep this (frequently polled) payload small.
  function serializeForDisplay(
    od: typeof latestRaised,
    asset: typeof latestRaisedAsset
  ) {
    if (!od) return null;
    const { assets: _assets, ...category } = od.category;
    return {
      ...od,
      raisedBy: memberImageUrl(od.raisedBy),
      accused: memberImageUrl(od.accused),
      category,
      asset: asset ? assetFileUrl(asset) : null,
    };
  }

  return NextResponse.json({
    // Only what the display needs. This endpoint is public — anyone with the
    // board link polls it — so the row's joinCode/adminCode must not ride
    // along, the way they used to when the whole board was spread in here.
    board: { name: board.name, slug: board.slug },
    leaderboard,
    pendingCount,
    pendingOds,
    latestRaised: serializeForDisplay(latestRaised, latestRaisedAsset),
    latestClosed: serializeForDisplay(latestClosed, latestClosedAsset),
    now: Date.now(),
  });
}
