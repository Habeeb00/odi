"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useBoard } from "@/lib/useBoard";
import { apiFetch } from "@/lib/api";
import type { LeaderboardEntry, OD } from "@/lib/types";

const SCORE_STEPS = [10, 50, -10, -50];

export default function TestModePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { board } = useBoard(slug);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pendingOds, setPendingOds] = useState<OD[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function loadLeaderboard() {
    const data = await apiFetch<{ leaderboard: LeaderboardEntry[] }>(
      `/api/boards/${slug}/leaderboard`
    );
    setLeaderboard(data.leaderboard);
  }
  async function loadPendingOds() {
    setPendingOds(await apiFetch<OD[]>(`/api/boards/${slug}/ods?status=PENDING`));
  }
  useEffect(() => {
    loadLeaderboard();
    loadPendingOds();
  }, [slug]);

  async function adjustScore(memberId: string, delta: number) {
    setBusy(`score-${memberId}-${delta}`);
    setError(null);
    try {
      await apiFetch(`/api/boards/${slug}/debug/score`, {
        method: "POST",
        body: JSON.stringify({ memberId, delta }),
      });
      await loadLeaderboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust score");
    } finally {
      setBusy(null);
    }
  }

  async function resolve(odId: string, finalScore: number) {
    setBusy(`resolve-${odId}`);
    setError(null);
    try {
      await apiFetch(`/api/ods/${odId}/debug/resolve`, {
        method: "POST",
        body: JSON.stringify({ finalScore }),
      });
      await Promise.all([loadPendingOds(), loadLeaderboard()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve OD");
    } finally {
      setBusy(null);
    }
  }

  if (!board) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Test mode</h1>
        <Link href={`/${slug}/admin`} className="text-sm underline">
          ← Back to admin
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Nudge scores and trigger OD sequences directly, without waiting on real votes —
        for designing interactions and animations. Nothing here is visible to members.
      </p>
      {error && <p className="mt-3 text-sm text-od">{error}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Section title="Scores">
            <div className="flex flex-col gap-2">
              {leaderboard.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                >
                  <span className="font-medium">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-right font-mono text-sm text-muted">
                      {m.score}
                    </span>
                    {SCORE_STEPS.map((delta) => (
                      <button
                        key={delta}
                        disabled={busy === `score-${m.id}-${delta}`}
                        onClick={() => adjustScore(m.id, delta)}
                        className="rounded-lg border border-line px-2 py-1 text-xs font-semibold disabled:opacity-50"
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-sm text-muted">No members yet.</p>
              )}
            </div>
          </Section>

          <Section title="Raise an OD">
            <RaiseForm
              slug={slug}
              members={board.members}
              categories={board.categories}
              onRaised={loadPendingOds}
            />
          </Section>

          <Section title="Pending → resolve">
            <div className="flex flex-col gap-3">
              {pendingOds.map((od) => (
                <div key={od.id} className="rounded-lg border border-line p-3">
                  <p className="text-sm">
                    <strong>{od.accused.name}</strong> — {od.category.name}
                  </p>
                  <p className="text-xs text-muted">{od.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      disabled={busy === `resolve-${od.id}`}
                      onClick={() => resolve(od.id, 10)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Guilty (+10)
                    </button>
                    <button
                      disabled={busy === `resolve-${od.id}`}
                      onClick={() => resolve(od.id, 5)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Small OD (+5)
                    </button>
                    <button
                      disabled={busy === `resolve-${od.id}`}
                      onClick={() => resolve(od.id, 0)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Not an OD (0)
                    </button>
                  </div>
                </div>
              ))}
              {pendingOds.length === 0 && (
                <p className="text-sm text-muted">No pending ODs — raise one above.</p>
              )}
            </div>
          </Section>

          <Section title="Assets & dialogues">
            <p className="text-sm text-muted">
              Category images, GIFs, and dialogue lines shown during the detected/pending/
              verdict screens are managed from{" "}
              <Link href={`/${slug}/admin`} className="underline">
                Admin → Assets
              </Link>
              . Upload a few per category and severity to see them rotate in below.
            </p>
          </Section>
        </div>

        <div>
          <Section title="Live display preview">
            <p className="mb-2 text-sm text-muted">
              Reflects real-time — trigger something on the left and watch it play out here.
            </p>
            <iframe
              src={`/${slug}/display`}
              className="h-[700px] w-full rounded-lg border border-line"
              title="Display preview"
            />
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RaiseForm({
  slug,
  members,
  categories,
  onRaised,
}: {
  slug: string;
  members: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  onRaised: () => void;
}) {
  const [raisedById, setRaisedById] = useState(members[0]?.id ?? "");
  const [accusedId, setAccusedId] = useState(members[1]?.id ?? members[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("Testing the raise sequence");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/boards/${slug}/debug/raise`, {
        method: "POST",
        body: JSON.stringify({ raisedById, accusedId, categoryId, description }),
      });
      onRaised();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to raise OD");
    } finally {
      setBusy(false);
    }
  }

  if (members.length === 0) {
    return <p className="text-sm text-muted">Add members in Admin first.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={raisedById}
          onChange={(e) => setRaisedById(e.target.value)}
          className="flex-1 rounded-lg border border-line bg-transparent px-2 py-1.5 text-sm"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              Raised by {m.name}
            </option>
          ))}
        </select>
        <select
          value={accusedId}
          onChange={(e) => setAccusedId(e.target.value)}
          className="flex-1 rounded-lg border border-line bg-transparent px-2 py-1.5 text-sm"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              Against {m.name}
            </option>
          ))}
        </select>
      </div>
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-sm"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-sm"
        placeholder="Description"
      />
      {error && <p className="text-sm text-od">{error}</p>}
      <button
        disabled={busy}
        className="self-start rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-paper disabled:opacity-50"
      >
        {busy ? "Raising..." : "Raise it"}
      </button>
    </form>
  );
}
