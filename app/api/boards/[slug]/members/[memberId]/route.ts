import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMemberImageFields } from "@/lib/upload";
import { memberImageUrl } from "@/lib/media";
import { isAdminForBoard } from "@/lib/session";
import { clientMessage } from "@/lib/apiError";

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

    if (typeof body.name === "string" && body.name.trim()) {
      const name = body.name.trim();
      // Same one-name-per-board rule as adding a member, minus this member.
      const clash = await prisma.member.findFirst({
        where: {
          boardId: existing.boardId,
          id: { not: memberId },
          name: { equals: name, mode: "insensitive" },
        },
      });
      if (clash) {
        return NextResponse.json(
          { error: `${clash.name} is already on this board` },
          { status: 409 }
        );
      }
      data.name = name;
    }
    try {
      Object.assign(data, parseMemberImageFields(body));
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    // Lets someone back into a name they locked themselves out of — clears
    // the password so the next login goes through the join-code claim flow
    // again, same as an unclaimed name.
    if (body.resetPassword) data.passwordHash = null;

    const member = await prisma.member.update({ where: { id: memberId }, data });
    return NextResponse.json(memberImageUrl(member));
  } catch (err) {
    console.error("PATCH /api/boards/[slug]/members/[memberId] failed", err);
    return NextResponse.json(
      { error: clientMessage(err, "Failed to update member") },
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
      { error: clientMessage(err, "Failed to remove member") },
      { status: 500 }
    );
  }
}
