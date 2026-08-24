"use client";

import { use, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import CyclingAvatar from "@/components/CyclingAvatar";
import type { Board, LeaderboardEntry, OD } from "@/lib/types";

export default function LeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [board, setBoard] = useState<Board | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);

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
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-black sm:text-3xl">{board?.name ?? "Leaderboard"}</h1>
      <p className="text-sm text-zinc-500">Ranked by total OD score</p>

      <div className="mt-6 flex flex-col gap-4 sm:mt-8">
        {leaderboard.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setSelected(m)}
            className="flex items-center gap-3 rounded-md text-left transition-opacity hover:opacity-70 sm:gap-4"
          >
            <span className="w-5 text-right text-base font-bold text-zinc-400 sm:w-6 sm:text-lg">
              {i + 1}
            </span>
            <CyclingAvatar
              images={[m.image, m.imageHappy, m.imageSad]}
              alt={m.name}
              className="h-10 w-10 object-contain sm:h-12 sm:w-12"
              fallback={
                <div className="flex h-10 w-10 items-center justify-center bg-zinc-200 text-base font-bold sm:h-12 sm:w-12 sm:text-lg">
                  {m.name[0]?.toUpperCase()}
                </div>
              }
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold underline decoration-dotted underline-offset-4">
                  {m.name}
                </span>
                <span className="shrink-0 font-mono text-sm text-zinc-500">{m.score}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-zinc-100">
                <div
                  className="h-2 rounded-full bg-black transition-all duration-700"
                  style={{ width: `${(Math.max(m.score, 0) / max) * 100}%` }}
                />
              </div>
            </div>
          </button>
        ))}
        {leaderboard.length === 0 && <p className="text-zinc-500">No members yet.</p>}
      </div>

      {selected && (
        <MemberOdsModal slug={slug} member={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}

function MemberOdsModal({
  slug,
  member,
  onClose,
}: {
  slug: string;
  member: LeaderboardEntry;
  onClose: () => void;
}) {
  const [ods, setOds] = useState<OD[] | null>(null);

  useEffect(() => {
    setOds(null);
    apiFetch<OD[]>(`/api/boards/${slug}/ods?status=CLOSED&accusedId=${member.id}`).then(setOds);
  }, [slug, member.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{member.name}&rsquo;s closed ODs</h2>
          <button onClick={onClose} className="text-sm text-zinc-500">
            Close
          </button>
        </div>

        {ods === null && <p className="mt-4 text-sm text-zinc-500">Loading...</p>}
        {ods && ods.length === 0 && (
          <p className="mt-4 text-sm text-zinc-500">No closed ODs yet.</p>
        )}
        {ods && ods.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {ods.map((od) => (
              <li
                key={od.id}
                className="rounded-md border border-zinc-200 p-3 text-sm"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{od.category.name}</span>
                  <span className="font-mono text-zinc-500">+{od.finalScore ?? 0}</span>
                </div>
                <p className="mt-1 text-zinc-600">{od.description}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Raised by {od.raisedBy.name} &middot;{" "}
                  {new Date(od.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
