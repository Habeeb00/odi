import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeJoinCode } from "@/lib/joinCode";
import { clientMessage } from "@/lib/apiError";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = normalizeJoinCode((body.code ?? "").toString());
    if (!code) {
      return NextResponse.json({ error: "Join code is required" }, { status: 400 });
    }

    const board = await prisma.board.findUnique({ where: { joinCode: code } });
    if (!board) {
      return NextResponse.json({ error: "No board found for that code" }, { status: 404 });
    }

    return NextResponse.json({ slug: board.slug });
  } catch (err) {
    console.error("POST /api/boards/join failed", err);
    return NextResponse.json(
      { error: clientMessage(err, "Failed to join board") },
      { status: 500 }
    );
  }
}
