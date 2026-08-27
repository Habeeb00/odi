import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMemberImageFields } from "@/lib/upload";
import { memberImageUrl } from "@/lib/media";
import { isAdminForBoard } from "@/lib/session";
import { clientMessage } from "@/lib/apiError";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const board = await prisma.board.findUnique({ where: { slug } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    if (!isAdminForBoard(req, board.id)) {
      return NextResponse.json({ error: "Admin code required" }, { status: 401 });
    }

    // Names are how you're addressed on the board, how you're picked at
    // login, and how a verdict reads — two Amals make all three ambiguous.
    const clash = await prisma.member.findFirst({
      where: { boardId: board.id, name: { equals: name, mode: "insensitive" } },
    });
    if (clash) {
      return NextResponse.json(
        { error: `${clash.name} is already on this board — pick a different name` },
        { status: 409 }
      );
    }

    let imageFields: Record<string, string>;
    try {
      imageFields = parseMemberImageFields(body);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    // A head with no face can't race, can't be judged, and can't be picked
    // out of the tub at login. The admin adds the photo, not the member.
    if (!imageFields.image) {
      return NextResponse.json({ error: "A photo is required" }, { status: 400 });
    }

    const member = await prisma.member.create({
      data: { boardId: board.id, name, ...imageFields },
    });
    return NextResponse.json(memberImageUrl(member), { status: 201 });
  } catch (err) {
    console.error("POST /api/boards/[slug]/members failed", err);
    return NextResponse.json(
      { error: clientMessage(err, "Failed to add member") },
      { status: 500 }
    );
  }
}
