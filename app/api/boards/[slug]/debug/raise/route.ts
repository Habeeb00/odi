import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminForBoard } from "@/lib/session";
import { serializeOd } from "@/lib/media";

// Test-mode only: raise an OD as any member against any member, bypassing
// login and the daily limit, so the display's detected/pending animations
// can be triggered on demand while designing.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await prisma.board.findUnique({ where: { slug } });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  if (!isAdminForBoard(req, board.id)) {
    return NextResponse.json({ error: "Admin code required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { raisedById, accusedId, categoryId } = body;
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!raisedById || !accusedId || !categoryId || !description) {
    return NextResponse.json(
      { error: "raisedById, accusedId, categoryId and description are required" },
      { status: 400 }
    );
  }

  const od = await prisma.oD.create({
    data: {
      boardId: board.id,
      raisedById,
      accusedId,
      categoryId,
      description,
      closesAt: new Date(Date.now() + board.votingDurationHours * 60 * 60 * 1000),
    },
    include: { raisedBy: true, accused: true, category: true, votes: true },
  });

  return NextResponse.json(serializeOd(od), { status: 201 });
}
