import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateImageDataUrl } from "@/lib/upload";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.imageDataUrl === "string" && body.imageDataUrl) {
      try {
        data.image = validateImageDataUrl(body.imageDataUrl);
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
      }
    }

    const member = await prisma.member.update({ where: { id: memberId }, data });
    return NextResponse.json(member);
  } catch (err) {
    console.error("PATCH /api/boards/[slug]/members/[memberId] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const { memberId } = await params;
    await prisma.member.delete({ where: { id: memberId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/boards/[slug]/members/[memberId] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove member" },
      { status: 500 }
    );
  }
}
