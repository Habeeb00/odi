import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateJoinCode } from "@/lib/joinCode";
import { memberImageUrl } from "@/lib/media";
import { isAdminForBoard } from "@/lib/session";
import { clientMessage } from "@/lib/apiError";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const board = await prisma.board.findUnique({
      where: { slug },
      include: { members: true, categories: true },
    });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    // adminCode is a private secret, unlike joinCode — never include it in a
    // general board read, only when explicitly issued or regenerated.
    const { adminCode: _adminCode, ...publicBoard } = board;
    return NextResponse.json({ ...publicBoard, members: board.members.map(memberImageUrl) });
  } catch (err) {
    console.error("GET /api/boards/[slug] failed", err);
    return NextResponse.json(
      { error: clientMessage(err, "Failed to load board") },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const existing = await prisma.board.findUnique({ where: { slug } });
    if (!existing) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    if (!isAdminForBoard(req, existing.id)) {
      return NextResponse.json({ error: "Admin code required" }, { status: 401 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.votingDurationHours === "number") data.votingDurationHours = body.votingDurationHours;
    if (typeof body.dailyOdLimit === "number") data.dailyOdLimit = body.dailyOdLimit;

    if (body.regenerateJoinCode) {
      let joinCode = generateJoinCode();
      while (await prisma.board.findUnique({ where: { joinCode } })) {
        joinCode = generateJoinCode();
      }
      data.joinCode = joinCode;
    }

    let regeneratedAdminCode: string | undefined;
    if (body.regenerateAdminCode) {
      let adminCode = generateJoinCode();
      while (await prisma.board.findUnique({ where: { adminCode } })) {
        adminCode = generateJoinCode();
      }
      data.adminCode = adminCode;
      regeneratedAdminCode = adminCode;
    }

    const board = await prisma.board.update({ where: { slug }, data });
    const { adminCode: _adminCode, ...publicBoard } = board;
    return NextResponse.json({
      ...publicBoard,
      ...(regeneratedAdminCode ? { adminCode: regeneratedAdminCode } : {}),
    });
  } catch (err) {
    console.error("PATCH /api/boards/[slug] failed", err);
    return NextResponse.json(
      { error: clientMessage(err, "Failed to update board") },
      { status: 500 }
    );
  }
}
