import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";
import { generateJoinCode } from "@/lib/joinCode";
import { DEFAULT_SCORING_RULE } from "@/lib/scoring";
import { memberImageUrl } from "@/lib/media";
import { withAdmin, withMember } from "@/lib/session";
import { clientMessage } from "@/lib/apiError";

const DEFAULT_CATEGORIES = ["OD", "Loyalty", "Novelty"];

const RACK_LIMIT = 60;

type MemberRow = { id: string; boardId: string; name: string; hasImage: boolean };

// The rack: every board as a pile of heads plus its running numbers. Only
// exposes what a board's public leaderboard already shows to anyone with the
// link — never join or admin codes.
export async function GET() {
  try {
    const boards = await prisma.board.findMany({
      orderBy: { createdAt: "desc" },
      take: RACK_LIMIT,
      select: { id: true, name: true, slug: true, createdAt: true },
    });
    if (boards.length === 0) return NextResponse.json([]);

    const boardIds = boards.map((b) => b.id);

    // Member photos are stored inline as data: URLs (see lib/media.ts), so
    // selecting `image` here would pull every board's every photo into
    // memory just to decide whether a head has one. Ask Postgres instead.
    const [members, closed, pending] = await Promise.all([
      prisma.$queryRaw<MemberRow[]>`
        SELECT id, "boardId", name, image IS NOT NULL AS "hasImage"
        FROM "Member"
        WHERE "boardId" = ANY(${boardIds}::text[])
        ORDER BY "createdAt" ASC
      `,
      prisma.oD.groupBy({
        by: ["boardId"],
        where: { boardId: { in: boardIds }, status: "CLOSED" },
        _sum: { finalScore: true },
        _count: { _all: true },
      }),
      prisma.oD.groupBy({
        by: ["boardId"],
        where: { boardId: { in: boardIds }, status: "PENDING" },
        _count: { _all: true },
      }),
    ]);

    const headsByBoard = new Map<string, { id: string; name: string; image: string | null }[]>();
    for (const m of members) {
      const list = headsByBoard.get(m.boardId) ?? [];
      list.push({
        id: m.id,
        name: m.name,
        image: m.hasImage ? `/api/members/${m.id}/image` : null,
      });
      headsByBoard.set(m.boardId, list);
    }
    const closedByBoard = new Map(closed.map((c) => [c.boardId, c]));
    const pendingByBoard = new Map(pending.map((p) => [p.boardId, p._count._all]));

    return NextResponse.json(
      boards.map((b) => ({
        name: b.name,
        slug: b.slug,
        createdAt: b.createdAt,
        heads: headsByBoard.get(b.id) ?? [],
        totalOd: closedByBoard.get(b.id)?._sum.finalScore ?? 0,
        closedCases: closedByBoard.get(b.id)?._count._all ?? 0,
        openCases: pendingByBoard.get(b.id) ?? 0,
      }))
    );
  } catch (err) {
    console.error("GET /api/boards failed", err);
    return NextResponse.json({ error: clientMessage(err, "Failed to load boards") }, { status: 500 });
  }
}

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
    // One name per board (enforced on every later add too, see
    // members/route.ts) — a repeated name here would create two members
    // nobody could tell apart.
    const seen = new Set<string>();
    const trimmedMemberNames: string[] = [];
    for (const raw of [...memberNames, createdBy]) {
      const n = (raw ?? "").trim();
      if (!n || seen.has(n.toLowerCase())) continue;
      seen.add(n.toLowerCase());
      trimmedMemberNames.push(n);
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
      { error: clientMessage(err, "Failed to create board") },
      { status: 500 }
    );
  }
}
