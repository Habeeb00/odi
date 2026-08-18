import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeExpiredOds, getLeaderboard } from "@/lib/od";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await prisma.board.findUnique({ where: { slug } });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  await closeExpiredOds(board.id);
  const leaderboard = await getLeaderboard(board.id);
  return NextResponse.json({ board, leaderboard });
}
