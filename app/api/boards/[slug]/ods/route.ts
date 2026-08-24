import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeExpiredOds } from "@/lib/od";
import { validateImageDataUrl } from "@/lib/upload";
import { serializeOd } from "@/lib/media";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const status = req.nextUrl.searchParams.get("status"); // "PENDING" | "CLOSED" | null
  const accusedId = req.nextUrl.searchParams.get("accusedId");

  const board = await prisma.board.findUnique({ where: { slug } });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  await closeExpiredOds(board.id);

  const ods = await prisma.oD.findMany({
    where: {
      boardId: board.id,
      ...(status ? { status } : {}),
      ...(accusedId ? { accusedId } : {}),
    },
    include: { raisedBy: true, accused: true, category: true, votes: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(ods.map(serializeOd));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const { raisedById, accusedId, categoryId, description } = body;

    if (!raisedById || !accusedId || !categoryId || !description?.trim()) {
      return NextResponse.json(
        { error: "raisedById, accusedId, categoryId and description are required" },
        { status: 400 }
      );
    }
    if (raisedById === accusedId) {
      return NextResponse.json({ error: "You can't raise an OD against yourself" }, { status: 400 });
    }

    const board = await prisma.board.findUnique({ where: { slug } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    await closeExpiredOds(board.id);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const raisedToday = await prisma.oD.count({
      where: { boardId: board.id, raisedById, createdAt: { gte: since } },
    });
    if (raisedToday >= board.dailyOdLimit) {
      return NextResponse.json(
        { error: `Daily OD limit reached (${board.dailyOdLimit} per day)` },
        { status: 429 }
      );
    }

    let evidence: string | undefined;
    if (typeof body.evidenceDataUrl === "string" && body.evidenceDataUrl) {
      try {
        evidence = validateImageDataUrl(body.evidenceDataUrl);
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
      }
    }

    const od = await prisma.oD.create({
      data: {
        boardId: board.id,
        raisedById,
        accusedId,
        categoryId,
        description: description.trim(),
        evidence,
        closesAt: new Date(Date.now() + board.votingDurationHours * 60 * 60 * 1000),
      },
      include: { raisedBy: true, accused: true, category: true, votes: true },
    });

    return NextResponse.json(serializeOd(od), { status: 201 });
  } catch (err) {
    console.error("POST /api/boards/[slug]/ods failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to raise OD" },
      { status: 500 }
    );
  }
}
