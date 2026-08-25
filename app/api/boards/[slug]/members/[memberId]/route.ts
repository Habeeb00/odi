import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMemberImageFields } from "@/lib/upload";
import { memberImageUrl } from "@/lib/media";
import { isAdminForBoard } from "@/lib/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const existing = await prisma.member.findUnique({ where: { id: memberId } });
    if (!existing) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!isAdminForBoard(req, existing.boardId)) {
      return NextResponse.json({ error: "Admin code required" }, { status: 401 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    try {
      Object.assign(data, parseMemberImageFields(body));
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    const member = await prisma.member.update({ where: { id: memberId }, data });
    return NextResponse.json(memberImageUrl(member));
  } catch (err) {
    console.error("PATCH /api/boards/[slug]/members/[memberId] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const existing = await prisma.member.findUnique({ where: { id: memberId } });
    if (!existing) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!isAdminForBoard(req, existing.boardId)) {
      return NextResponse.json({ error: "Admin code required" }, { status: 401 });
    }

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
