import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDataUrl } from "@/lib/media";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const mood = req.nextUrl.searchParams.get("mood");

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dataUrl =
    mood === "happy" ? member.imageHappy : mood === "sad" ? member.imageSad : member.image;
  if (!dataUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(parsed.buffer), {
    headers: {
      "Content-Type": parsed.mime,
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
