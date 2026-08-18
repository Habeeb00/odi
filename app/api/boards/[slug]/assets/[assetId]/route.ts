import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; assetId: string }> }
) {
  const { assetId } = await params;
  await prisma.asset.delete({ where: { id: assetId } });
  return NextResponse.json({ ok: true });
}
