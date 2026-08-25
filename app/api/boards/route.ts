import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";
import { generateJoinCode } from "@/lib/joinCode";
import { DEFAULT_SCORING_RULE } from "@/lib/scoring";
import { withAdmin } from "@/lib/session";

const DEFAULT_CATEGORIES = ["OD", "Loyalty", "Novelty"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body.name ?? "").trim();
    const createdBy = (body.createdBy ?? "").trim();
    const memberNames: string[] = Array.isArray(body.memberNames) ? body.memberNames : [];

    if (!name || !createdBy) {
      return NextResponse.json({ error: "name and createdBy are required" }, { status: 400 });
    }

    const baseSlug = slugify(name);
    let slug = baseSlug;
    let suffix = 1;
    while (RESERVED_SLUGS.has(slug) || (await prisma.board.findUnique({ where: { slug } }))) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    let joinCode = generateJoinCode();
    while (await prisma.board.findUnique({ where: { joinCode } })) {
      joinCode = generateJoinCode();
    }

    // Separate from joinCode: this one gates /admin, not raising/voting.
    let adminCode = generateJoinCode();
    while (await prisma.board.findUnique({ where: { adminCode } })) {
      adminCode = generateJoinCode();
    }

    const board = await prisma.board.create({
      data: {
        name,
        slug,
        joinCode,
        adminCode,
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

    const res = NextResponse.json(board, { status: 201 });
    withAdmin(res, req, board.id);
    return res;
  } catch (err) {
    console.error("POST /api/boards failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create board" },
      { status: 500 }
    );
  }
}
