import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminForBoard, withMember } from "@/lib/session";

// Lets a browser that's already proven admin access (cookie set by
// /admin/verify or board creation) silently resolve "who am I" as the
// board's creator, without going through the join-code/password picker —
// an admin is already a member, so that check would be redundant. Used
// when local identity was never established on this device even though
// the admin session cookie already was (e.g. unlocked admin before this
// existed, or cleared localStorage but not cookies).
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const board = await prisma.board.findUnique({ where: { slug } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    if (!isAdminForBoard(req, board.id)) {
      return NextResponse.json({ error: "Not an admin on this board" }, { status: 403 });
    }
    if (!board.creatorMemberId) {
      return NextResponse.json({ error: "No member linked to this admin" }, { status: 404 });
    }

    const res = NextResponse.json({ memberId: board.creatorMemberId });
    withMember(res, req, board.id, board.creatorMemberId);
    return res;
  } catch (err) {
    console.error("POST /api/boards/[slug]/admin/self failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve admin identity" },
      { status: 500 }
    );
  }
}
