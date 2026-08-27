import crypto from "crypto";
import type { NextRequest } from "next/server";

// Signs the session cookie so a client can't hand-craft "I'm the admin" /
// "I'm member X" — set SESSION_SECRET in .env for real deployments; this
// fallback is fine for local dev only.
const SECRET = process.env.SESSION_SECRET || "oddy-dev-insecure-secret-change-me";

const COOKIE_NAME = "oddy_session";
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export type Session = {
  members: Record<string, string>; // boardId -> memberId
  admins: string[]; // boardIds
};

function sign(payload: string): string {
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

function unsign(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const payloadB64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return payload;
}

function emptySession(): Session {
  return { members: {}, admins: [] };
}

export function getSession(req: NextRequest): Session {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return emptySession();
  const payload = unsign(raw);
  if (!payload) return emptySession();
  try {
    const parsed = JSON.parse(payload);
    return {
      members: typeof parsed.members === "object" && parsed.members ? parsed.members : {},
      admins: Array.isArray(parsed.admins) ? parsed.admins : [],
    };
  } catch {
    return emptySession();
  }
}

export function getMemberIdForBoard(req: NextRequest, boardId: string): string | null {
  return getSession(req).members[boardId] ?? null;
}

export function isAdminForBoard(req: NextRequest, boardId: string): boolean {
  return getSession(req).admins.includes(boardId);
}

function sessionCookie(session: Session) {
  return {
    name: COOKIE_NAME,
    value: sign(JSON.stringify(session)),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

// All three take a NextResponse-like object exposing .cookies (NextResponse
// does). They're written to compose: admin/verify and board creation each
// call two of them on one response, and each has to build on what the
// previous call already wrote. Reading only from the *request* meant the
// second call silently discarded the first's grant — which is how verifying
// the admin code used to leave `admins: []` in the cookie, unlocking the
// admin UI while every admin write came back 401.
type SessionResponse = {
  cookies: {
    set: (opts: ReturnType<typeof sessionCookie>) => void;
    get: (name: string) => { value: string } | undefined;
  };
};

function pendingSession(res: SessionResponse, req: NextRequest): Session {
  const staged = res.cookies.get(COOKIE_NAME)?.value;
  if (staged) {
    const payload = unsign(staged);
    if (payload) {
      try {
        const parsed = JSON.parse(payload);
        return {
          members: typeof parsed.members === "object" && parsed.members ? parsed.members : {},
          admins: Array.isArray(parsed.admins) ? parsed.admins : [],
        };
      } catch {
        // Fall through to the request's session.
      }
    }
  }
  return getSession(req);
}

export function withMember(
  res: SessionResponse,
  req: NextRequest,
  boardId: string,
  memberId: string
) {
  const session = pendingSession(res, req);
  session.members[boardId] = memberId;
  res.cookies.set(sessionCookie(session));
}

export function withoutMember(res: SessionResponse, req: NextRequest, boardId: string) {
  const session = pendingSession(res, req);
  delete session.members[boardId];
  res.cookies.set(sessionCookie(session));
}

export function withAdmin(res: SessionResponse, req: NextRequest, boardId: string) {
  const session = pendingSession(res, req);
  if (!session.admins.includes(boardId)) session.admins.push(boardId);
  res.cookies.set(sessionCookie(session));
}
