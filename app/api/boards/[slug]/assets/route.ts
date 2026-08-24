import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateImageDataUrl } from "@/lib/upload";
import { assetFileUrl } from "@/lib/media";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await prisma.board.findUnique({ where: { slug } });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const assets = await prisma.asset.findMany({
    where: { category: { boardId: board.id } },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(assets.map(assetFileUrl));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const categoryId = body.categoryId as string;
    const dialogue = typeof body.dialogue === "string" ? body.dialogue.trim() : undefined;
    const severity = ["MILD", "MEDIUM", "SEVERE"].includes(body.severity) ? body.severity : undefined;

    const board = await prisma.board.findUnique({ where: { slug } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const category = await prisma.category.findFirst({ where: { id: categoryId, boardId: board.id } });
    if (!category) return NextResponse.json({ error: "Category not found on this board" }, { status: 400 });

    let file: string | undefined;
    if (typeof body.fileDataUrl === "string" && body.fileDataUrl) {
      try {
        file = validateImageDataUrl(body.fileDataUrl);
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
      }
    }

    if (!file && !dialogue) {
      return NextResponse.json({ error: "Provide an image, a dialogue, or both" }, { status: 400 });
    }

    const asset = await prisma.asset.create({
      data: { categoryId, file, dialogue, severity },
    });
    return NextResponse.json(assetFileUrl(asset), { status: 201 });
  } catch (err) {
    console.error("POST /api/boards/[slug]/assets failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add asset" },
      { status: 500 }
    );
  }
}
