"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-12 px-6 py-16">
      <header>
        <h1 className="text-4xl font-black tracking-tight">Oddy Board</h1>
        <p className="mt-2 text-zinc-500">
          The leaderboard for chathis. Raise an OD, let the group judge it.
        </p>
      </header>

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
