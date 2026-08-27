import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SCORING_RULE } from "@/lib/scoring";
import { isAdminForBoard } from "@/lib/session";
import { clientMessage } from "@/lib/apiError";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const board = await prisma.board.findUnique({ where: { slug } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    if (!isAdminForBoard(req, board.id)) {
      return NextResponse.json({ error: "Admin code required" }, { status: 401 });
    }

    const scoringRule =
      body.scoringRule && typeof body.scoringRule === "object"
        ? JSON.stringify({ ...DEFAULT_SCORING_RULE, ...body.scoringRule })
        : JSON.stringify(DEFAULT_SCORING_RULE);

    const category = await prisma.category.create({
      data: { boardId: board.id, name, scoringRule },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error("POST /api/boards/[slug]/categories failed", err);
    return NextResponse.json(
      { error: clientMessage(err, "Failed to add category") },
      { status: 500 }
    );
  }
}
