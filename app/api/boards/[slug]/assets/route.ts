import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveDataUrl } from "@/lib/upload";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await prisma.board.findUnique({ where: { slug } });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const assets = await prisma.asset.findMany({
    where: { category: { boardId: board.id } },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(assets);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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
    file = await saveDataUrl(body.fileDataUrl, "asset");
  }

  if (!file && !dialogue) {
    return NextResponse.json({ error: "Provide an image, a dialogue, or both" }, { status: 400 });
  }

  const asset = await prisma.asset.create({
    data: { categoryId, file, dialogue, severity },
  });
  return NextResponse.json(asset, { status: 201 });
}
