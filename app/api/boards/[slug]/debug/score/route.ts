import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminForBoard } from "@/lib/session";

// Test-mode only: nudge a member's score up/down by creating a synthetic
// closed OD instead of going through raise → vote → close. Never exposed
// outside the admin test page.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await prisma.board.findUnique({
    where: { slug },
    include: { categories: true },
  });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  if (!isAdminForBoard(req, board.id)) {
    return NextResponse.json({ error: "Admin code required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const memberId = body.memberId as string;
  const delta = Number(body.delta);
  if (!memberId || !Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "memberId and a non-zero delta are required" }, { status: 400 });
  }

  const member = await prisma.member.findFirst({ where: { id: memberId, boardId: board.id } });
  if (!member) return NextResponse.json({ error: "Member not found on this board" }, { status: 404 });

  const category = board.categories[0];
  if (!category) return NextResponse.json({ error: "Board has no categories" }, { status: 400 });

  await prisma.oD.create({
    data: {
      boardId: board.id,
      raisedById: memberId,
      accusedId: memberId,
      categoryId: category.id,
      description: `Test mode: ${delta > 0 ? "+" : ""}${delta}`,
      status: "CLOSED",
      finalScore: delta,
      closesAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
