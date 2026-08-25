import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";
import { generateJoinCode } from "@/lib/joinCode";
import { DEFAULT_SCORING_RULE } from "@/lib/scoring";
import { memberImageUrl } from "@/lib/media";
import { withAdmin, withMember } from "@/lib/session";

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

    // The admin is a member of their own board — if they didn't list
    // themselves among the other members, add them so they show up on
    // the leaderboard and can raise/vote like anyone else.
    const trimmedMemberNames = memberNames.map((n) => n.trim()).filter(Boolean);
    if (!trimmedMemberNames.some((n) => n.toLowerCase() === createdBy.toLowerCase())) {
      trimmedMemberNames.push(createdBy);
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
          create: trimmedMemberNames.map((n) => ({ name: n })),
        },
      },
      include: { members: true, categories: true },
    });

    // Best-effort match on the name we just created it with — safe since
    // trimmedMemberNames has no duplicate of createdBy (deduped above).
    const creatorMember = board.members.find(
      (m) => m.name.toLowerCase() === createdBy.toLowerCase()
    );
    const finalBoard = creatorMember
      ? await prisma.board.update({
          where: { id: board.id },
          data: { creatorMemberId: creatorMember.id },
          include: { members: true, categories: true },
        })
      : board;

    const res = NextResponse.json({
      ...finalBoard,
      members: finalBoard.members.map(memberImageUrl),
    }, { status: 201 });
    withAdmin(res, req, board.id);
    if (creatorMember) withMember(res, req, board.id, creatorMember.id);
    return res;
  } catch (err) {
    console.error("POST /api/boards failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create board" },
      { status: 500 }
    );
  }
}
