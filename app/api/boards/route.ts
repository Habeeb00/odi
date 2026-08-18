import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { DEFAULT_SCORING_RULE } from "@/lib/scoring";

const DEFAULT_CATEGORIES = ["OD", "Loyalty", "Novelty"];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = (body.name ?? "").trim();
  const createdBy = (body.createdBy ?? "").trim();
  const memberNames: string[] = Array.isArray(body.memberNames) ? body.memberNames : [];

  if (!name || !createdBy) {
    return NextResponse.json({ error: "name and createdBy are required" }, { status: 400 });
  }

  let slug = slugify(name);
  // extremely unlikely collision, but keep it correct
  while (await prisma.board.findUnique({ where: { slug } })) {
    slug = slugify(name);
  }

  const board = await prisma.board.create({
    data: {
      name,
      slug,
      createdBy,
      categories: {
        create: DEFAULT_CATEGORIES.map((n) => ({
          name: n,
          scoringRule: JSON.stringify(DEFAULT_SCORING_RULE),
        })),
      },
      members: {
        create: memberNames
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ name: n })),
      },
    },
    include: { members: true, categories: true },
  });

  return NextResponse.json(board, { status: 201 });
}
