import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withoutMember } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const board = await prisma.board.findUnique({ where: { slug } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const res = NextResponse.json({ ok: true });
    withoutMember(res, req, board.id);
    return res;
  } catch (err) {
    console.error("POST /api/boards/[slug]/logout failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to log out" },
      { status: 500 }
    );
  }
}
