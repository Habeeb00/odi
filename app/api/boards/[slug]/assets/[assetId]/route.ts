import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminForBoard } from "@/lib/session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; assetId: string }> }
) {
  const { assetId } = await params;
  const existing = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { category: true },
  });
  if (!existing) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (!isAdminForBoard(req, existing.category.boardId)) {
    return NextResponse.json({ error: "Admin code required" }, { status: 401 });
  }

  await prisma.asset.delete({ where: { id: assetId } });
  return NextResponse.json({ ok: true });
}
