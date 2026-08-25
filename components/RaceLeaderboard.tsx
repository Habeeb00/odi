"use client";

import type { LeaderboardEntry } from "@/lib/types";

// Scores usually stay within a 0-100 range; once someone breaks 100 the
// whole board "unlocks" a wider 0-500 range so bars don't all pin at 100%.
function scoreRange(entries: LeaderboardEntry[]): number {
  const actualMax = Math.max(0, ...entries.map((e) => e.score));
  return actualMax > 100 ? 500 : 100;
}

export default function RaceLeaderboard({
  entries,
  onSelectMember,
  photoFor,
  flashFor,
}: {
  entries: LeaderboardEntry[];
  onSelectMember: (member: LeaderboardEntry) => void;
  // Only the display page needs a live, status-driven photo (crying while
  // being judged, laughing while leading/OD-ing someone) — everywhere else
  // just shows the one normal photo, so this is optional.
  photoFor?: (member: LeaderboardEntry) => string | null;
  // Optional transient "+N" popup per member id, for live score-change
  // feedback (also display-only).
  flashFor?: (memberId: string) => number | null;
}) {
  const range = scoreRange(entries);
  return (
    <div className="w-full">
      <div className="flex flex-col gap-5 sm:gap-8">
        {entries.map((m) => {
          const pct = Math.min(100, (Math.max(m.score, 0) / range) * 100);
          const photo = photoFor ? photoFor(m) : m.image;
          const flash = flashFor?.(m.id) ?? null;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMember(m)}
              className="relative h-1.5 w-full rounded-full bg-zinc-200 [--avatar:36px] sm:[--avatar:60px]"
            >
              <div
                className="h-1.5 rounded-full bg-red-600 transition-all duration-1000 ease-out"
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute top-1/2 h-[var(--avatar)] w-[var(--avatar)] -translate-y-1/2 transition-all duration-1000 ease-out"
                style={{
                  left: `clamp(0px, calc(${pct}% - var(--avatar) / 2), calc(100% - var(--avatar)))`,
                }}
              >
                {flash !== null && (
                  <span
                    key={flash}
                    className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full animate-[flash-up_1.6s_ease-out_forwards] whitespace-nowrap font-mono text-xs font-bold text-red-600 sm:text-sm"
                  >
                    +{flash} XP
                  </span>
                )}
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={m.name}
                    className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] transition-transform duration-300"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-200 text-sm font-bold sm:text-xl">
                    {m.name[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {entries.length === 0 && (
          <p className="text-center text-zinc-500">No members yet.</p>
        )}
      </div>
    </div>
  );
}
