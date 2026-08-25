"use client";

import CyclingAvatar from "@/components/CyclingAvatar";
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
}: {
  entries: LeaderboardEntry[];
  onSelectMember: (member: LeaderboardEntry) => void;
}) {
  const range = scoreRange(entries);
  return (
    <div className="w-full">
      <div className="flex flex-col gap-8 sm:gap-12">
        {entries.map((m) => {
          const pct = Math.min(100, (Math.max(m.score, 0) / range) * 100);
          return (
            <button
              key={m.id}
              onClick={() => onSelectMember(m)}
              className="relative h-1.5 w-full rounded-full bg-zinc-200 [--avatar:44px] sm:[--avatar:72px]"
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
                <CyclingAvatar
                  images={[m.image, m.imageHappy, m.imageSad]}
                  alt={m.name}
                  className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
                  fallback={
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-200 text-lg font-bold sm:text-2xl">
                      {m.name[0]?.toUpperCase()}
                    </div>
                  }
                />
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
