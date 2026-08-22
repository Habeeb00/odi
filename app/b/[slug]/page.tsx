"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useBoard } from "@/lib/useBoard";
import { apiFetch } from "@/lib/api";
import { getIdentity } from "@/lib/identity";
import type { OD } from "@/lib/types";

export default function BoardHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { board } = useBoard(slug);
  const [ods, setOds] = useState<OD[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<OD[]>(`/api/boards/${slug}/ods?status=PENDING`);
    setOds(data);
  }

  useEffect(() => {
    setMemberId(getIdentity(slug));
    load();
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
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setVoting(null);
    }
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/b/${slug}` : "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 p-4">
        <div>
          <p className="text-sm text-zinc-500">Share this board</p>
          <p className="font-mono text-sm">{shareUrl}</p>
          {board?.joinCode && (
            <p className="mt-1 text-sm text-zinc-500">
              Join code: <span className="font-mono font-bold tracking-widest">{board.joinCode}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => shareUrl && navigator.clipboard.writeText(shareUrl)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium"
        >
          Copy link
        </button>
      </div>

      <h1 className="text-2xl font-bold">OD under investigation</h1>
      {message && <p className="mt-2 text-sm text-zinc-600">{message}</p>}

      {ods.length === 0 && (
        <p className="mt-6 text-zinc-500">No pending cases. All quiet on the chathi front.</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {ods.map((od) => {
          const myVote = od.votes.find((v) => v.memberId === memberId);
          const canVote = memberId && memberId !== od.accusedId;
          return (
            <div key={od.id} className="rounded-md border border-zinc-200 p-5">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{od.category.name}</p>
              <h2 className="mt-1 text-xl font-bold">{od.accused.name}</h2>
              <p className="mt-1 text-zinc-700">{od.description}</p>
              {od.evidence && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={od.evidence} alt="evidence" className="mt-3 max-h-64 rounded-md" />
              )}
              <p className="mt-3 text-xs text-zinc-500">
                Raised by {od.raisedBy.name} · {od.votes.length} vote{od.votes.length === 1 ? "" : "s"} ·
                closes {new Date(od.closesAt).toLocaleString()}
              </p>

              {!canVote ? (
                <p className="mt-4 text-sm text-zinc-500">
                  {memberId === od.accusedId ? "You can't vote on your own case." : "Pick who you are to vote."}
                </p>
              ) : (
                <div className="mt-4 flex gap-2">
                  {(["OD", "SMALL_OD", "REJECT"] as const).map((choice) => (
                    <button
                      key={choice}
                      disabled={voting === od.id}
                      onClick={() => vote(od.id, choice)}
                      className={`rounded-md border px-4 py-2 text-sm font-semibold ${
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

      <div className="mt-10 flex gap-4 text-sm">
        <Link href={`/b/${slug}/raise`} className="underline">
          Raise an OD →
        </Link>
        <Link href={`/b/${slug}/leaderboard`} className="underline">
          View leaderboard →
        </Link>
      </div>

      {board && board.members.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500">
          No members yet.{" "}
          <Link href={`/b/${slug}/admin`} className="underline">
            Add some in Admin
          </Link>
          .
        </p>
      )}
    </main>
  );
}
