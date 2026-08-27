"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { unlockAdmin } from "@/lib/adminAuth";
import { setIdentity } from "@/lib/identity";
import CopyField from "@/components/CopyField";
import { HeadPile, PileCard } from "@/components/HeadPile";
import type { Board, BoardSummary } from "@/lib/types";

const STEPS = [
  {
    title: "Somebody does something",
    body: "You raise it on them. Category, one line about what happened, a screenshot if you have receipts.",
  },
  {
    title: "The group pulls on it",
    body: "Every open case is a rope. Vote OD and you pull one way; vote Reject and you pull the other. The knot moves as votes land.",
  },
  {
    title: "The board keeps it",
    body: "Whatever the rope settles on becomes score, in public, on a leaderboard everyone can watch race.",
  },
];

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdBoard, setCreatedBoard] = useState<Board | null>(null);
  const [rack, setRack] = useState<BoardSummary[]>([]);

  // The hero is the real wall, not a mockup — whatever boards actually exist.
  useEffect(() => {
    apiFetch<BoardSummary[]>("/api/boards")
      .then((boards) => setRack(boards.filter((b) => b.heads.length > 0)))
      .catch(() => setRack([]));
  }, []);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const board = await apiFetch<Board>("/api/boards", {
        method: "POST",
        // Members aren't typed in here — they get thrown in as photos on the
        // next screen, which is a much better first five minutes.
        body: JSON.stringify({ name, createdBy, memberNames: [] }),
      });
      setCreatedBoard(board);
      unlockAdmin(board.slug);
      // The creator is already a member of their own board (see
      // app/api/boards/route.ts) — sign them in as that member too, so
      // they don't hit the raise page's join-code/password prompt.
      if (board.creatorMemberId) setIdentity(board.slug, board.creatorMemberId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function joinBoard(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoining(true);
    try {
      const { slug } = await apiFetch<{ slug: string }>("/api/boards/join", {
        method: "POST",
        body: JSON.stringify({ code: joinCode }),
      });
      router.push(`/${slug}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Couldn't join that board");
    } finally {
      setJoining(false);
    }
  }

  if (createdBoard) {
    const boardUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${createdBoard.slug}`;
    return (
      <main className="mx-auto flex w-full max-w-md animate-[rise-in_0.4s_ease-out] flex-col gap-6 px-5 py-14">
        <header className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-od">
            {createdBoard.name} is live
          </span>
          <h1 className="display text-4xl leading-[0.95]">
            Now put
            <br />
            everyone in it
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            An empty board can&rsquo;t accuse anyone. Next screen takes a pile of photos and
            turns them into heads — no forms.
          </p>
        </header>

        <button
          onClick={() => router.push(`/${createdBoard.slug}/admin`)}
          className="rounded-xl bg-ink px-4 py-3.5 font-semibold text-paper transition hover:bg-od"
        >
          Throw the faces in
        </button>

        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            Keep these somewhere
          </p>
          <CopyField
            label="Admin code"
            value={createdBoard.adminCode ?? "—"}
            size="lg"
            tone="secret"
            hint="Yours alone. The only way back into board settings, and it won't be shown again."
          />
          <CopyField
            label="Public leaderboard"
            value={boardUrl}
            hint="Anyone with this can watch the race. No login."
          />
          <p className="text-xs leading-relaxed text-muted">
            The join code lives in the invite link — you&rsquo;ll share it from the board once
            the faces are in.
          </p>
        </div>
      </main>
    );
  }

  const featured = rack.slice(0, 1);

  return (
    // Mobile is one column; from lg the hero, the sign-up card, the featured
    // pile and the explainer sit on a 2x2 grid with explicit placement, so
    // the DOM order stays right for phones (hero → pile → card → how) while
    // desktop gets hero+card on the first row.
    <main className="mx-auto flex w-full max-w-md flex-col px-5 pb-20 lg:grid lg:max-w-6xl lg:grid-cols-2 lg:items-start lg:gap-x-16 lg:gap-y-14 lg:px-10 lg:pb-28">
      <header className="relative flex flex-col items-center gap-3 pb-10 pt-14 text-center lg:col-start-1 lg:row-start-1 lg:items-start lg:gap-5 lg:pb-0 lg:pt-24 lg:text-left">
        <div className="hatch pointer-events-none absolute inset-x-0 top-0 -z-10 h-44 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)] lg:h-72" />
        <h1 className="wordmark text-6xl lg:text-8xl">ഒടി</h1>
        <p className="display text-2xl leading-[1.05] lg:text-[3.4rem]">
          A permanent record
          <br />
          of your friends&rsquo; crimes
        </p>
        <p className="max-w-xs text-sm leading-relaxed text-muted lg:max-w-sm lg:text-base">
          Someone pulls an OD. The group votes on it by pulling a rope. The board keeps
          score — in public, forever.
        </p>
      </header>

      {/* Proof the thing is in use, and the first look at a board's portrait. */}
      {featured.length > 0 && (
        <section className="mb-10 lg:col-start-1 lg:row-start-2 lg:mb-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            On the wall right now
          </p>
          {featured.map((b) => (
            <PileCard
              key={b.slug}
              href={`/${b.slug}`}
              heads={b.heads}
              kicker={new Date(b.createdAt).getFullYear().toString()}
              title={b.name}
              stats={[
                `${b.heads.length} in the tub · ${b.totalOd} OD on record`,
                b.openCases > 0
                  ? `${b.openCases} case${b.openCases === 1 ? "" : "s"} still being pulled over`
                  : "no open cases right now",
              ]}
            />
          ))}
          <Link
            href="/boards"
            className="mt-4 inline-block text-sm text-muted underline decoration-line hover:text-ink"
          >
            See all {rack.length} board{rack.length === 1 ? "" : "s"} on the rack →
          </Link>
        </section>
      )}

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(20,17,15,0.04)] lg:col-start-2 lg:row-start-1 lg:mt-24 lg:p-7">
        <div className="flex rounded-lg bg-paper p-1">
          {(["create", "join"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
                mode === m ? "bg-ink text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {m === "create" ? "Start a board" : "I have a code"}
            </button>
          ))}
        </div>

        {mode === "create" ? (
          <form
            onSubmit={createBoard}
            key="create"
            className="mt-5 flex animate-[rise-in_0.25s_ease-out] flex-col gap-4"
          >
            <Field
              label="Board name"
              placeholder="The Gang"
              value={name}
              onChange={setName}
              required
            />
            <Field
              label="Your name"
              placeholder="Habeeb"
              value={createdBy}
              onChange={setCreatedBy}
              required
              hint="Two questions, then you're adding faces."
            />
            {error && <p className="text-sm text-od">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-xl bg-ink px-4 py-3.5 font-semibold text-paper transition hover:bg-od disabled:opacity-50"
            >
              {loading ? "Opening…" : "Open the board"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={joinBoard}
            key="join"
            className="mt-5 flex animate-[rise-in_0.25s_ease-out] flex-col gap-4"
          >
            <Field
              label="Join code"
              placeholder="AB12CD"
              value={joinCode}
              onChange={setJoinCode}
              mono
              hint="The six characters whoever made the board sent you."
            />
            {joinError && <p className="text-sm text-od">{joinError}</p>}
            <button
              type="submit"
              disabled={joining}
              className="mt-1 rounded-xl bg-ink px-4 py-3.5 font-semibold text-paper transition hover:bg-od disabled:opacity-50"
            >
              {joining ? "Looking…" : "Find my board"}
            </button>
          </form>
        )}
      </div>

      <section className="mt-14 lg:col-start-2 lg:row-start-2 lg:mt-0">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          How it works
        </h2>
        <ol className="mt-4 flex flex-col">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4 border-t border-line py-4">
              <span className="display shrink-0 text-2xl leading-none text-od">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* The rest of the rack, small, at the bottom — a wall of piles. Wider
          screens get more of the wall rather than more whitespace. */}
      {rack.length > 1 && (
        <section className="mt-14 lg:col-span-2 lg:row-start-3 lg:mt-6 lg:border-t lg:border-line lg:pt-12">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
              Other boards
            </h2>
            <Link href="/boards" className="text-xs text-muted underline decoration-line hover:text-ink">
              The rack →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:mt-6 lg:grid-cols-5 lg:gap-x-8 lg:gap-y-10">
            {rack.slice(1, 11).map((b, i) => (
              <Link
                key={b.slug}
                href={`/${b.slug}`}
                // Four is enough of a taste on a phone; a wide screen has room
                // for the whole strip.
                className={`group flex-col ${i < 4 ? "flex" : "hidden lg:flex"}`}
              >
                <HeadPile heads={b.heads.slice(0, 6)} />
                <p className="mt-1.5 border-t border-ink pt-1 font-mono text-xs font-bold group-hover:text-od">
                  {b.name}
                </p>
                <p className="font-mono text-[11px] text-faint">{b.totalOd} OD</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  hint,
  required,
  mono,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <input
        className={`w-full border-b border-line bg-transparent py-2 text-lg outline-none transition placeholder:text-faint focus:border-ink ${
          mono ? "font-mono uppercase tracking-[0.18em]" : ""
        }`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}
