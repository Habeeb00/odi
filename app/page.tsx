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
  const [joinSlug, setJoinSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      router.push(`/b/${board.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function joinBoard(e: React.FormEvent) {
    e.preventDefault();
    const slug = joinSlug.trim().replace(/^.*\/b\//, "").replace(/\/.*$/, "");
    if (slug) router.push(`/b/${slug}`);
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
            className="border-b border-zinc-300 bg-transparent py-2 text-lg outline-none focus:border-black dark:focus:border-white"
            placeholder="Board name (e.g. The Gang)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="border-b border-zinc-300 bg-transparent py-2 text-lg outline-none focus:border-black dark:focus:border-white"
            placeholder="Your name"
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
            required
          />
          <input
            className="border-b border-zinc-300 bg-transparent py-2 text-lg outline-none focus:border-black dark:focus:border-white"
            placeholder="Member names, comma separated"
            value={members}
            onChange={(e) => setMembers(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-black px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
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
            className="flex-1 border-b border-zinc-300 bg-transparent py-2 text-lg outline-none focus:border-black dark:focus:border-white"
            placeholder="Board link or slug"
            value={joinSlug}
            onChange={(e) => setJoinSlug(e.target.value)}
          />
          <button type="submit" className="rounded-md border border-zinc-300 px-4 py-2 font-medium">
            Join
          </button>
        </form>
      </section>
    </main>
  );
}
