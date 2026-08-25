"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { setIdentity } from "@/lib/identity";

export default function IdentityPicker({
  slug,
  members,
  onPicked,
  onClose,
  canClose,
}: {
  slug: string;
  members: { id: string; name: string; image: string | null }[];
  onPicked: (id: string) => void;
  onClose: () => void;
  canClose: boolean;
}) {
  const [code, setCode] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(memberId: string) {
    setPickedId(memberId);
    setError(null);
    if (!code.trim()) {
      setError("Enter the board's join code first.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/boards/${slug}/login`, {
        method: "POST",
        body: JSON.stringify({ code, memberId }),
      });
      setIdentity(slug, memberId);
      onPicked(memberId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={canClose ? onClose : undefined}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-lg bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 p-4">
          <h2 className="text-lg font-bold">Who are you?</h2>
          {canClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100"
            >
              ×
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <label className="mb-4 flex flex-col gap-1">
            <span className="text-sm font-medium">Join code</span>
            <input
              autoFocus
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-center font-mono uppercase tracking-widest outline-none focus:border-black"
              placeholder="AB12CD"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2">
            {members.length === 0 && (
              <p className="text-sm text-zinc-500">No members yet — add some in Admin.</p>
            )}
            {members.map((m) => (
              <button
                key={m.id}
                disabled={busy}
                onClick={() => login(m.id)}
                className="rounded-md border border-zinc-200 px-4 py-3 text-left font-medium hover:bg-zinc-50 disabled:opacity-50"
              >
                {busy && pickedId === m.id ? "Checking..." : m.name}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
