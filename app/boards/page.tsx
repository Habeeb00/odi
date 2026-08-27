"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PileCard } from "@/components/HeadPile";
import type { BoardSummary } from "@/lib/types";

// Every board, hung on one wall. Each one is the same pile of heads you see
// on its own page, shrunk to a card — so scanning the rack is scanning faces,
// not reading a list of names.

const SORTS = [
  { key: "recent", label: "Newest" },
  { key: "od", label: "Most OD" },
  { key: "open", label: "Busiest" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

export default function RackPage() {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    apiFetch<BoardSummary[]>("/api/boards")
      .then(setBoards)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the rack"));
  }, []);

  const sorted = useMemo(() => {
    if (!boards) return null;
    const copy = [...boards];
    if (sort === "od") copy.sort((a, b) => b.totalOd - a.totalOd);
    if (sort === "open") copy.sort((a, b) => b.openCases - a.openCases);
    return copy;
  }, [boards, sort]);

  const totalOd = boards?.reduce((sum, b) => sum + b.totalOd, 0) ?? 0;
  const totalHeads = boards?.reduce((sum, b) => sum + b.heads.length, 0) ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <Link href="/" className="wordmark text-lg text-muted hover:text-ink">
            ഒടി
          </Link>
          <h1 className="display text-4xl leading-[0.95] sm:text-5xl">The rack</h1>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">
            Every board anyone has started. {totalHeads} heads, {totalOd} OD on record.
            Tap a pile to read that board&rsquo;s charges.
          </p>
        </div>
        <div className="flex rounded-lg bg-surface p-0.5 ring-1 ring-line">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                sort === s.key ? "bg-ink text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="mt-8 text-sm text-od">{error}</p>}

      {!sorted && !error && (
        <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="mb-2 h-24 rounded-lg bg-line/60" />
              <div className="h-3 w-2/3 rounded bg-line" />
            </div>
          ))}
        </div>
      )}

      {sorted && sorted.length === 0 && (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="display text-2xl">Nothing on the wall yet</p>
          <p className="max-w-xs text-sm text-muted">
            No boards exist. Somebody has to be first to accuse a friend.
          </p>
          <Link href="/" className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-paper">
            Start the first one
          </Link>
        </div>
      )}

      {sorted && sorted.length > 0 && (
        <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {sorted.map((b) => (
            <PileCard
              key={b.slug}
              href={`/${b.slug}`}
              heads={b.heads}
              kicker={new Date(b.createdAt).getFullYear().toString()}
              title={b.name}
              tag={
                b.openCases > 0 ? (
                  <span className="rounded-full bg-od-soft px-1.5 py-0.5 text-[10px] font-bold text-od">
                    {b.openCases} open
                  </span>
                ) : null
              }
              stats={[
                `${b.heads.length} in the tub`,
                `${b.totalOd} OD across ${b.closedCases} closed case${b.closedCases === 1 ? "" : "s"}`,
              ]}
            />
          ))}
        </div>
      )}
    </main>
  );
}
