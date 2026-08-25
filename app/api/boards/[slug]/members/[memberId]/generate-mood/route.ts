import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminForBoard } from "@/lib/session";
import { generateMoodPhoto, type Mood } from "@/lib/gemini";
import { validateImageDataUrl } from "@/lib/upload";
import { memberImageUrl } from "@/lib/media";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!isAdminForBoard(req, member.boardId)) {
      return NextResponse.json({ error: "Admin code required" }, { status: 401 });
    }
    if (!member.image) {
      return NextResponse.json(
        { error: "Upload a normal photo first — AI generates from that" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const mood = body.mood as Mood;
    if (mood !== "happy" && mood !== "sad") {
      return NextResponse.json({ error: "mood must be 'happy' or 'sad'" }, { status: 400 });
    }

    const generated = validateImageDataUrl(await generateMoodPhoto(member.image, mood));
    const field = mood === "happy" ? "imageHappy" : "imageSad";
    const updated = await prisma.member.update({
      where: { id: memberId },
      data: { [field]: generated },
    });

    return NextResponse.json(memberImageUrl(updated));
  } catch (err) {
    console.error("POST /api/boards/[slug]/members/[memberId]/generate-mood failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate photo" },
      { status: 500 }
    );
  }
}
