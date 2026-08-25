import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeJoinCode } from "@/lib/joinCode";
import { withAdmin } from "@/lib/session";

// Gates /admin separately from the member "who am I" picker used for
// raising/voting — a join code lets you participate, only this code lets
// you manage members, categories, assets, and settings.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const code = normalizeJoinCode((body.code ?? "").toString());
  if (!code) return NextResponse.json({ error: "Admin code is required" }, { status: 400 });

  const board = await prisma.board.findUnique({ where: { slug } });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  if (!board.adminCode || board.adminCode !== code) {
    return NextResponse.json({ error: "Incorrect admin code" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  withAdmin(res, req, board.id);
  return res;
}
