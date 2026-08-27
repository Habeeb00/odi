"use client";

import { useEffect, useState } from "react";
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

  // On first mount every bar starts at 0 and races up to its real score a
  // beat later — the CSS transition below does the animating, this just
  // withholds the real width for one frame so there's a "from zero" state
  // to transition from.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (entries.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-faint">
        No members on this board yet.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 sm:gap-9">
      {entries.map((m, i) => {
        const pct = started ? Math.min(100, (Math.max(m.score, 0) / range) * 100) : 0;
        // Staggered start so the bars feel like they're leaving the gate
        // one after another, not snapping into place all at once.
        const raceDelay = `${Math.min(i * 80, 400)}ms`;
        const flash = flashFor?.(m.id) ?? null;
        // A score bump briefly overrides whatever photoFor would normally
        // show (crying/leading/etc) with the laughing photo, and grows
        // the avatar for the same span the "+N XP" popup is on screen.
        const photo = flash !== null ? (m.imageHappy ?? m.image) : photoFor ? photoFor(m) : m.image;
        const leading = i === 0 && m.score > 0;

        return (
          <button
            key={m.id}
            onClick={() => onSelectMember(m)}
            className="group block w-full text-left [--avatar:36px] sm:[--avatar:60px]"
          >
            <div className="mb-2 flex items-baseline gap-2">
              <span
                className={`display w-5 shrink-0 text-sm leading-none ${
                  leading ? "text-od" : "text-faint"
                }`}
              >
                {i + 1}
              </span>
              <span className="truncate text-sm font-semibold group-hover:text-od sm:text-base">
                {m.name}
              </span>
              {leading && (
                <span className="shrink-0 rounded-full bg-od-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-od">
                  Leading
                </span>
              )}
              <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-muted">
                {m.score}
              </span>
            </div>

            <div className="relative h-1.5 w-full rounded-full bg-line">
              <div
                className="h-1.5 rounded-full bg-od transition-all duration-1000 ease-out"
                style={{ width: `${pct}%`, transitionDelay: raceDelay }}
              />
              <div
                className={`absolute top-1/2 h-[var(--avatar)] w-[var(--avatar)] -translate-y-1/2 transition-all duration-1000 ease-out ${
                  flash !== null ? "z-10" : ""
                }`}
                style={{
                  left: `clamp(0px, calc(${pct}% - var(--avatar) / 2), calc(100% - var(--avatar)))`,
                  transitionDelay: raceDelay,
                }}
              >
                {flash !== null && (
                  <span
                    key={flash}
                    className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full animate-[flash-up_1.6s_ease-out_forwards] whitespace-nowrap font-mono text-xs font-bold text-od sm:text-sm"
                  >
                    +{flash} XP
                  </span>
                )}
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={m.name}
                    className={`h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(20,17,15,0.25)] transition-transform duration-500 ${
                      flash !== null ? "scale-150" : ""
                    }`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-surface text-sm font-bold ring-1 ring-line sm:text-xl">
                    {m.name[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
