import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOdForTesting } from "@/lib/od";
import { serializeOd } from "@/lib/media";
import { isAdminForBoard } from "@/lib/session";

// Test-mode only: close a pending OD with a hand-picked score instead of
// tallying votes, so the verdict screen can be previewed on demand.
export async function POST(req: NextRequest, { params }: { params: Promise<{ odId: string }> }) {
  const { odId } = await params;
  const existing = await prisma.oD.findUnique({ where: { id: odId } });
  if (!existing) return NextResponse.json({ error: "OD not found" }, { status: 404 });
  if (!isAdminForBoard(req, existing.boardId)) {
    return NextResponse.json({ error: "Admin code required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const finalScore = Number(body.finalScore);
  if (!Number.isFinite(finalScore)) {
    return NextResponse.json({ error: "finalScore is required" }, { status: 400 });
  }

  const od = await resolveOdForTesting(odId, finalScore);
  return NextResponse.json(serializeOd(od));
}
