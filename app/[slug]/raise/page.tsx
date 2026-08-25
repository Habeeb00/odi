"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import RaiseOdButton from "@/components/RaiseOdButton";
import IdentityPicker from "@/components/IdentityPicker";
import { useBoard } from "@/lib/useBoard";
import { apiFetch } from "@/lib/api";
import { getIdentity } from "@/lib/identity";
import type { OD } from "@/lib/types";

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 8000;

export default function RaisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { board } = useBoard(slug);
  const [allOds, setAllOds] = useState<OD[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [picking, setPicking] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const recentOds = allOds.slice(0, 12);
  // Cases this member hasn't voted on yet (and isn't the accused in) — must
  // clear these before raising a new one, same rule the server enforces.
  const pendingVotesForMe = allOds.filter(
    (od) =>
      od.status === "PENDING" &&
      memberId &&
      od.accusedId !== memberId &&
      !od.votes.some((v) => v.memberId === memberId)
  );

  useEffect(() => {
    setMemberId(getIdentity(slug));
    setIdentityChecked(true);
  }, [slug]);

  // Live feed: one request in flight at a time, with a hard timeout — see
  // the same fix on the home/display page for why that matters. The
  // leaderboard itself isn't shown here — that's the board's home page.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
      try {
        const ods = await apiFetch<OD[]>(`/api/boards/${slug}/ods`, { signal: controller.signal });
        if (stopped) return;
        setStale(false);
        setAllOds(ods);
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
      setAllOds(await apiFetch<OD[]>(`/api/boards/${slug}/ods`));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setVoting(null);
    }
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/${slug}` : "";

  // Raising and voting are for board members only — anyone with the link
  // can see the leaderboard/display, but this tab stays locked until
  // they log in with the join code.
  if (identityChecked && !memberId) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-3xl font-black tracking-tight">Odicho ningale?</h1>
        <p className="text-sm text-zinc-500">Join with the board&rsquo;s code to raise an OD.</p>
        <button
          onClick={() => setPicking(true)}
          className="mt-2 rounded-md bg-black px-5 py-2.5 text-sm font-semibold text-white"
        >
          Join with code
        </button>
        <Link href={`/${slug}`} className="text-sm underline">
          ← Back to leaderboard
        </Link>
        {picking && board && (
          <IdentityPicker
            slug={slug}
            members={board.members}
            onPicked={(id) => {
              setMemberId(id);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
            canClose
          />
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-8">
      {memberId && pendingVotesForMe.length > 0 ? (
        <div className="rounded-md border-2 border-black p-4">
          <p className="font-semibold">
            Vote on {pendingVotesForMe.length} pending case{pendingVotesForMe.length === 1 ? "" : "s"} before
            raising a new OD
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {pendingVotesForMe.map((od) => (
              <div key={od.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                <p className="font-semibold">
                  {od.accused.name} — {od.category.name}
                </p>
                <p className="mt-1 text-zinc-600">{od.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(["OD", "SMALL_OD", "REJECT"] as const).map((choice) => (
                    <button
                      key={choice}
                      disabled={voting === od.id}
                      onClick={() => vote(od.id, choice)}
                      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      {choice === "OD" ? "OD" : choice === "SMALL_OD" ? "Small OD" : "Reject"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        board && (
          <RaiseOdButton
            slug={slug}
            board={board}
            memberId={memberId}
            onRaised={() => {
              setMessage("OD raised.");
              apiFetch<OD[]>(`/api/boards/${slug}/ods`).then(setAllOds);
            }}
          />
        )
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
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/${slug}`} className="text-sm underline">
            ← Back to leaderboard
          </Link>
          <button
            onClick={() => shareUrl && navigator.clipboard.writeText(shareUrl)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium"
          >
            Copy link
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Live activity
          </h2>
          {stale && <p className="text-xs text-zinc-400">Reconnecting…</p>}
        </div>
        {message && <p className="mt-2 text-sm text-zinc-600">{message}</p>}

        <div className="mt-3 flex flex-col gap-3">
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
    </main>
  );
}
