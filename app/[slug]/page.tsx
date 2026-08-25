"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import RaiseOdButton from "@/components/RaiseOdButton";
import RaceLeaderboard from "@/components/RaceLeaderboard";
import { useBoard } from "@/lib/useBoard";
import { apiFetch } from "@/lib/api";
import { getIdentity } from "@/lib/identity";
import type { LeaderboardEntry, OD } from "@/lib/types";

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 8000;

export default function BoardHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { board } = useBoard(slug);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recentOds, setRecentOds] = useState<OD[]>([]);
  const [selectedMember, setSelectedMember] = useState<LeaderboardEntry | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    setMemberId(getIdentity(slug));
  }, [slug]);

  // Live feed: one request in flight at a time, with a hard timeout — see
  // the same fix on /display for why that matters.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
      try {
        const [{ leaderboard: entries }, ods] = await Promise.all([
          apiFetch<{ leaderboard: LeaderboardEntry[] }>(`/api/boards/${slug}/leaderboard`, {
            signal: controller.signal,
          }),
          apiFetch<OD[]>(`/api/boards/${slug}/ods`, { signal: controller.signal }),
        ]);
        if (stopped) return;
        setStale(false);
        setLeaderboard(entries);
        setRecentOds(ods.slice(0, 12));
      } catch {
        if (!stopped) setStale(true);
      } finally {
        clearTimeout(abortTimer);
        if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [slug]);

  async function vote(odId: string, choice: string) {
    if (!memberId) return;
    setVoting(odId);
    setMessage(null);
    try {
      await apiFetch(`/api/ods/${odId}/vote`, {
        method: "POST",
        body: JSON.stringify({ memberId, vote: choice }),
      });
      setMessage("Vote recorded.");
      setRecentOds(await apiFetch<OD[]>(`/api/boards/${slug}/ods`).then((r) => r.slice(0, 12)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setVoting(null);
    }
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/${slug}` : "";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-8">
      {board && (
        <RaiseOdButton
          slug={slug}
          board={board}
          memberId={memberId}
          onRaised={() => {
            setMessage("OD raised.");
            apiFetch<OD[]>(`/api/boards/${slug}/ods`).then((r) => setRecentOds(r.slice(0, 12)));
          }}
        />
      )}

      {board && board.members.length === 0 && (
        <p className="-mt-6 text-center text-sm text-zinc-500">
          No members yet.{" "}
          <Link href={`/${slug}/admin`} className="underline">
            Add some in Admin
          </Link>
          .
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 p-4">
        <div>
          <p className="text-sm text-zinc-500">Share this board</p>
          <p className="break-all font-mono text-sm">{shareUrl}</p>
          {board?.joinCode && (
            <p className="mt-1 text-sm text-zinc-500">
              Join code: <span className="font-mono font-bold tracking-widest">{board.joinCode}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/${slug}/display`} className="text-sm underline">
            Open display →
          </Link>
          <button
            onClick={() => shareUrl && navigator.clipboard.writeText(shareUrl)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium"
          >
            Copy link
          </button>
        </div>
      </div>

      {message && <p className="-mb-4 text-sm text-zinc-600">{message}</p>}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="relative">
          {stale && (
            <p className="absolute -top-6 right-0 text-xs text-zinc-400">Reconnecting…</p>
          )}
          <RaceLeaderboard entries={leaderboard} onSelectMember={setSelectedMember} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Live activity
          </h2>
          {recentOds.length === 0 && (
            <p className="text-sm text-zinc-500">Nothing raised yet. All quiet on the chathi front.</p>
          )}
          {recentOds.map((od) => {
            const myVote = od.votes.find((v) => v.memberId === memberId);
            const canVote = od.status === "PENDING" && memberId && memberId !== od.accusedId;
            return (
              <div key={od.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                {od.status === "PENDING" ? (
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-600" />
                    {od.accused.name} is being judged — {od.category.name}
                  </p>
                ) : (
                  <p className="font-semibold">
                    {od.accused.name}{" "}
                    {(od.finalScore ?? 0) > 0 ? (
                      <span className="text-red-600">+{od.finalScore} OD</span>
                    ) : (
                      "cleared"
                    )}{" "}
                    — {od.category.name}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  Raised by {od.raisedBy.name} · {od.votes.length} vote{od.votes.length === 1 ? "" : "s"}
                </p>
                {canVote && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(["OD", "SMALL_OD", "REJECT"] as const).map((choice) => (
                      <button
                        key={choice}
                        disabled={voting === od.id}
                        onClick={() => vote(od.id, choice)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                          myVote?.vote === choice
                            ? "border-black bg-black text-white"
                            : "border-zinc-300"
                        }`}
                      >
                        {choice === "OD" ? "OD" : choice === "SMALL_OD" ? "Small OD" : "Reject"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedMember && (
        <MemberOdsModal
          slug={slug}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
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
              <li key={od.id} className="rounded-md border border-zinc-200 p-3 text-sm">
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
