import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateJoinCode } from "@/lib/joinCode";
import { memberImageUrl } from "@/lib/media";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const board = await prisma.board.findUnique({
      where: { slug },
      include: { members: true, categories: true },
    });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    return NextResponse.json({ ...board, members: board.members.map(memberImageUrl) });
  } catch (err) {
    console.error("GET /api/boards/[slug] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load board" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
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

    const board = await prisma.board.update({ where: { slug }, data });
    return NextResponse.json(board);
  } catch (err) {
    console.error("PATCH /api/boards/[slug] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update board" },
      { status: 500 }
    );
  }
}
