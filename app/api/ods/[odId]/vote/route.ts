import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeExpiredOds } from "@/lib/od";
import { VOTE_CHOICES } from "@/lib/scoring";
import { getMemberIdForBoard } from "@/lib/session";
import { clientMessage } from "@/lib/apiError";

export async function POST(req: NextRequest, { params }: { params: Promise<{ odId: string }> }) {
  try {
    const { odId } = await params;
    const body = await req.json();
    const { vote } = body;

    if (!VOTE_CHOICES.includes(vote)) {
      return NextResponse.json({ error: "A valid vote is required" }, { status: 400 });
    }

    const od = await prisma.oD.findUnique({ where: { id: odId } });
    if (!od) return NextResponse.json({ error: "OD not found" }, { status: 404 });

    const memberId = getMemberIdForBoard(req, od.boardId);
    if (!memberId) {
      return NextResponse.json({ error: "Log in to vote" }, { status: 401 });
    }

    await closeExpiredOds(od.boardId);
    const fresh = await prisma.oD.findUnique({ where: { id: odId } });
    if (fresh?.status === "CLOSED") {
      return NextResponse.json({ error: "Voting has closed for this case" }, { status: 409 });
    }
    if (memberId === od.accusedId) {
      return NextResponse.json({ error: "You can't vote on your own case" }, { status: 400 });
    }

    const result = await prisma.vote.upsert({
      where: { odId_memberId: { odId, memberId } },
      update: { vote },
      create: { odId, memberId, vote },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/ods/[odId]/vote failed", err);
    return NextResponse.json(
      { error: clientMessage(err, "Failed to record vote") },
      { status: 500 }
    );
  }
}
