"use client";

import { use, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Board, LeaderboardEntry } from "@/lib/types";

export default function LeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [board, setBoard] = useState<Board | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    apiFetch<{ board: Board; leaderboard: LeaderboardEntry[] }>(
      `/api/boards/${slug}/leaderboard`
    ).then((data) => {
      setBoard(data.board);
      setLeaderboard(data.leaderboard);
    });
  }, [slug]);

  const max = Math.max(1, ...leaderboard.map((m) => m.score));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-black">{board?.name ?? "Leaderboard"}</h1>
      <p className="text-sm text-zinc-500">Ranked by total OD score</p>

      <div className="mt-8 flex flex-col gap-4">
        {leaderboard.map((m, i) => (
          <div key={m.id} className="flex items-center gap-4">
            <span className="w-6 text-right text-lg font-bold text-zinc-400">{i + 1}</span>
            {m.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image} alt={m.name} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-bold dark:bg-zinc-800">
                {m.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{m.name}</span>
                <span className="font-mono text-sm text-zinc-500">{m.score}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-2 rounded-full bg-black transition-all duration-700 dark:bg-white"
                  style={{ width: `${(Math.max(m.score, 0) / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        {leaderboard.length === 0 && <p className="text-zinc-500">No members yet.</p>}
      </div>
    </main>
  );
}
