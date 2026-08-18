import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  const { memberId } = await params;
  await prisma.member.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
