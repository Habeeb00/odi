import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeJoinCode } from "@/lib/joinCode";
import { withMember } from "@/lib/session";

// Combined "prove you have the join code" + "pick who you are" step — a
// join code alone isn't an identity, so both are required together to
// establish a member session.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await req.json().catch(() => ({}));
    const code = normalizeJoinCode((body.code ?? "").toString());
    const memberId = (body.memberId ?? "").toString();

    if (!code || !memberId) {
      return NextResponse.json({ error: "Join code and member are required" }, { status: 400 });
    }

    const board = await prisma.board.findUnique({ where: { slug } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    if (!board.joinCode || board.joinCode !== code) {
      return NextResponse.json({ error: "Incorrect join code" }, { status: 401 });
    }

    const member = await prisma.member.findFirst({ where: { id: memberId, boardId: board.id } });
    if (!member) {
      return NextResponse.json({ error: "That member isn't on this board" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true, memberId: member.id });
    withMember(res, req, board.id, member.id);
    return res;
  } catch (err) {
    console.error("POST /api/boards/[slug]/login failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to log in" },
      { status: 500 }
    );
  }
}
