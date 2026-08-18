import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateImageDataUrl } from "@/lib/upload";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const board = await prisma.board.findUnique({ where: { slug } });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  let image: string | undefined;
  if (typeof body.imageDataUrl === "string" && body.imageDataUrl) {
    try {
      image = validateImageDataUrl(body.imageDataUrl);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  const member = await prisma.member.create({
    data: { boardId: board.id, name, image },
  });
  return NextResponse.json(member, { status: 201 });
}
