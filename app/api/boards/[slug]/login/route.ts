import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeJoinCode } from "@/lib/joinCode";
import { hashPassword, verifyPassword } from "@/lib/password";
import { withMember } from "@/lib/session";
import { clientMessage } from "@/lib/apiError";

// Two flows share this endpoint, told apart by whether the picked member
// already has a passwordHash:
//  - Unclaimed name: the board's join code proves they're allowed in, then
//    whatever password they type becomes theirs from now on.
//  - Claimed name: the join code no longer matters — only their own
//    password gets them back in, so nobody else holding the join code can
//    pick an already-claimed name.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await req.json().catch(() => ({}));
    const memberId = (body.memberId ?? "").toString();
    const password = (body.password ?? "").toString();
    const code = normalizeJoinCode((body.code ?? "").toString());

    if (!memberId || !password) {
      return NextResponse.json({ error: "Member and password are required" }, { status: 400 });
    }

    const board = await prisma.board.findUnique({ where: { slug } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const member = await prisma.member.findFirst({ where: { id: memberId, boardId: board.id } });
    if (!member) {
      return NextResponse.json({ error: "That member isn't on this board" }, { status: 400 });
    }

    if (!member.passwordHash) {
      if (!code || !board.joinCode || board.joinCode !== code) {
        return NextResponse.json({ error: "Incorrect join code" }, { status: 401 });
      }
      if (password.length < 4) {
        return NextResponse.json(
          { error: "Choose a password with at least 4 characters" },
          { status: 400 }
        );
      }
      await prisma.member.update({
        where: { id: member.id },
        data: { passwordHash: hashPassword(password) },
      });
    } else if (!verifyPassword(password, member.passwordHash)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, memberId: member.id });
    withMember(res, req, board.id, member.id);
    return res;
  } catch (err) {
    console.error("POST /api/boards/[slug]/login failed", err);
    return NextResponse.json(
      { error: clientMessage(err, "Failed to log in") },
      { status: 500 }
    );
  }
}
