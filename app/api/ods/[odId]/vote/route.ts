import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeExpiredOds } from "@/lib/od";
import { VOTE_CHOICES } from "@/lib/scoring";

export async function POST(req: NextRequest, { params }: { params: Promise<{ odId: string }> }) {
  const { odId } = await params;
  const body = await req.json();
  const { memberId, vote } = body;

  if (!memberId || !VOTE_CHOICES.includes(vote)) {
    return NextResponse.json({ error: "memberId and a valid vote are required" }, { status: 400 });
  }

  const od = await prisma.oD.findUnique({ where: { id: odId } });
  if (!od) return NextResponse.json({ error: "OD not found" }, { status: 404 });

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
}
