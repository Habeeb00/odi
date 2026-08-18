"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBoard } from "@/lib/useBoard";
import { apiFetch, fileToDataUrl } from "@/lib/api";
import { getIdentity } from "@/lib/identity";
import type { OD } from "@/lib/types";

export default function RaiseOD({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { board } = useBoard(slug);
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [accusedId, setAccusedId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMemberId(getIdentity(slug));
  }, [slug]);

  useEffect(() => {
    if (board && !categoryId && board.categories[0]) setCategoryId(board.categories[0].id);
  }, [board, categoryId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId) {
      setError("Pick who you are first (top right).");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const evidenceDataUrl = evidence ? await fileToDataUrl(evidence) : undefined;
      const od = await apiFetch<OD>(`/api/boards/${slug}/ods`, {
        method: "POST",
        body: JSON.stringify({
          raisedById: memberId,
          accusedId,
          categoryId,
          description,
          evidenceDataUrl,
        }),
      });
      router.push(`/b/${slug}?raised=${od.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to raise OD");
    } finally {
      setSubmitting(false);
    }
  }

  if (!board) return null;

  return (
    <main className="mx-auto max-w-md px-6 py-8">
      <h1 className="text-2xl font-bold">Raise an OD</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Something happened. Let the group decide if it deserves one.
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Against</span>
          <select
            required
            value={accusedId}
            onChange={(e) => setAccusedId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
          >
            <option value="" disabled>
              Select a member
            </option>
            {board.members
              .filter((m) => m.id !== memberId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Category</span>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
          >
            {board.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">What happened?</span>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
            placeholder="Went for a movie without inviting us."
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Evidence (optional)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setEvidence(e.target.files?.[0] ?? null)}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-md bg-black px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Submitting..." : "Submit OD"}
        </button>
      </form>
    </main>
  );
}
