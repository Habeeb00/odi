"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { unlockAdmin } from "@/lib/adminAuth";
import { setIdentity } from "@/lib/identity";
import type { Board } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [members, setMembers] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdBoard, setCreatedBoard] = useState<Board | null>(null);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const memberNames = members
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      const board = await apiFetch<Board>("/api/boards", {
        method: "POST",
        body: JSON.stringify({ name, createdBy, memberNames }),
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
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-6 py-16">
        <h1 className="text-2xl font-bold">Board created 🎉</h1>
        <p className="text-zinc-500">
          <strong>{createdBoard.name}</strong>&rsquo;s leaderboard is public at:
        </p>
        <div className="rounded-md border border-zinc-300 px-4 py-4 text-center font-mono text-lg">
          {typeof window !== "undefined" ? window.location.origin : ""}/{createdBoard.slug}
        </div>
        <p className="text-zinc-500">
          Share this join code with your group so they can raise and vote on ODs.
        </p>
        <div className="rounded-md border border-zinc-300 px-4 py-6 text-center font-mono text-3xl font-bold tracking-widest">
          {createdBoard.joinCode}
        </div>
        <p className="text-zinc-500">
          Keep this admin code to yourself — it&rsquo;s the only way into board settings,
          separate from the join code above.
        </p>
        <div className="rounded-md border-2 border-black px-4 py-6 text-center font-mono text-3xl font-bold tracking-widest">
          {createdBoard.adminCode}
        </div>
        <button
          onClick={() => router.push(`/${createdBoard.slug}`)}
          className="rounded-md bg-black px-4 py-3 font-semibold text-white"
        >
          Enter board
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-16 px-6 py-16">
      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-black tracking-tight">ഒടി</h1>
        <p className="text-lg text-zinc-600">
          The leaderboard for your friend circle&rsquo;s chathis.
        </p>
        <p className="text-sm text-zinc-500">
          Someone pulls an OD. The group votes on it. The board keeps score — forever, in public,
          for everyone to see.
        </p>
      </header>

      <section className="flex flex-col gap-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          How it works
        </h2>
        <ol className="flex flex-col gap-3 text-sm text-zinc-600">
          <li className="flex gap-3">
            <span className="font-mono font-bold text-black">1</span>
            <span>
              <strong className="text-black">Raise an OD</strong> — call out what someone did,
              with a description or a screenshot.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono font-bold text-black">2</span>
            <span>
              <strong className="text-black">The group votes</strong> — OD, small OD, or reject,
              within the board&rsquo;s voting window.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono font-bold text-black">3</span>
            <span>
              <strong className="text-black">The board keeps score</strong> — a public
              leaderboard everyone can watch race in real time.
            </span>
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Create a board
        </h2>
        <form onSubmit={createBoard} className="flex flex-col gap-3">
          <input
            className="border-b border-zinc-300 bg-transparent py-2 text-lg outline-none focus:border-black"
            placeholder="Board name (e.g. The Gang)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="border-b border-zinc-300 bg-transparent py-2 text-lg outline-none focus:border-black"
            placeholder="Your name"
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
            required
          />
          <input
            className="border-b border-zinc-300 bg-transparent py-2 text-lg outline-none focus:border-black"
            placeholder="Member names, comma separated"
            value={members}
            onChange={(e) => setMembers(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create board"}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Join an existing board
        </h2>
        <form onSubmit={joinBoard} className="flex gap-2">
          <input
            className="flex-1 border-b border-zinc-300 bg-transparent py-2 text-lg uppercase outline-none focus:border-black"
            placeholder="Join code (e.g. AB12CD)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button
            type="submit"
            disabled={joining}
            className="rounded-md border border-zinc-300 px-4 py-2 font-medium disabled:opacity-50"
          >
            {joining ? "Joining..." : "Join"}
          </button>
        </form>
        {joinError && <p className="text-sm text-red-600">{joinError}</p>}
      </section>
    </main>
  );
}
