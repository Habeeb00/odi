import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await prisma.board.findUnique({
    where: { slug },
    include: { members: true, categories: true },
  });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  return NextResponse.json(board);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.votingDurationHours === "number") data.votingDurationHours = body.votingDurationHours;
  if (typeof body.dailyOdLimit === "number") data.dailyOdLimit = body.dailyOdLimit;

  const board = await prisma.board.update({ where: { slug }, data });
  return NextResponse.json(board);
}
