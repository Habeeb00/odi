import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeOdNow } from "@/lib/od";
import { serializeOd } from "@/lib/media";
import { isAdminForBoard } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ odId: string }> }) {
  const { odId } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.action !== "close") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const existing = await prisma.oD.findUnique({ where: { id: odId } });
  if (!existing) return NextResponse.json({ error: "OD not found" }, { status: 404 });
  if (!isAdminForBoard(req, existing.boardId)) {
    return NextResponse.json({ error: "Admin code required" }, { status: 401 });
  }

  const od = await closeOdNow(odId);
  if (!od) return NextResponse.json({ error: "OD not found" }, { status: 404 });

  return NextResponse.json(serializeOd(od));
}
