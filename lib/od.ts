import { prisma } from "@/lib/prisma";
import { computeFinalScore, parseScoringRule } from "@/lib/scoring";
import { memberImageUrl } from "@/lib/media";

// Lazily closes any of the board's ODs whose voting window has passed and
// scores them from accumulated votes (PRD section 13 — time-based closure,
// no cron worker needed for V1: every read triggers the check).
export async function closeExpiredOds(boardId: string) {
  const expired = await prisma.oD.findMany({
    where: { boardId, status: "PENDING", closesAt: { lte: new Date() } },
    include: { votes: true, category: true },
  });

  for (const od of expired) {
    const rule = parseScoringRule(od.category.scoringRule);
    const finalScore = computeFinalScore(od.votes, rule);
    await prisma.oD.update({
      where: { id: od.id },
      data: { status: "CLOSED", finalScore },
    });
  }

  return expired.length;
}

// Admin-triggered early closure: scores a still-PENDING OD from whatever
// votes it has accumulated so far, without waiting for closesAt.
export async function closeOdNow(odId: string) {
  const od = await prisma.oD.findUnique({
    where: { id: odId },
    include: { raisedBy: true, accused: true, votes: true, category: true },
  });
  if (!od) return null;
  if (od.status === "CLOSED") return od;

  const rule = parseScoringRule(od.category.scoringRule);
  const finalScore = computeFinalScore(od.votes, rule);
  return prisma.oD.update({
    where: { id: odId },
    data: { status: "CLOSED", finalScore },
    include: { raisedBy: true, accused: true, category: true, votes: true },
  });
}

export async function getLeaderboard(boardId: string) {
  const [members, closedOds] = await Promise.all([
    prisma.member.findMany({ where: { boardId } }),
    prisma.oD.findMany({
      where: { boardId, status: "CLOSED" },
      select: { accusedId: true, finalScore: true },
    }),
  ]);

  const totals = new Map<string, number>();
  for (const m of members) totals.set(m.id, 0);
  for (const od of closedOds) {
    totals.set(od.accusedId, (totals.get(od.accusedId) ?? 0) + (od.finalScore ?? 0));
  }

  return members
    .map((m) => ({ ...memberImageUrl(m), score: totals.get(m.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}
