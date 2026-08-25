"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { setIdentity } from "@/lib/identity";

type PickableMember = { id: string; name: string; image: string | null; hasPassword: boolean };

export default function IdentityPicker({
  slug,
  members,
  onPicked,
  onClose,
  canClose,
}: {
  slug: string;
  members: PickableMember[];
  onPicked: (id: string) => void;
  onClose: () => void;
  canClose: boolean;
}) {
  const [selected, setSelected] = useState<PickableMember | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(member: PickableMember) {
    setSelected(member);
    setCode("");
    setPassword("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    if (!selected.hasPassword && !code.trim()) {
      setError("Enter the board's join code first.");
      return;
    }
    if (!password) {
      setError("Enter a password.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/boards/${slug}/login`, {
        method: "POST",
        body: JSON.stringify({ code, memberId: selected.id, password }),
      });
      setIdentity(slug, selected.id);
      onPicked(selected.id);
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
          <h2 className="text-lg font-bold">{selected ? selected.name : "Who are you?"}</h2>
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

        {!selected ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-2">
              {members.length === 0 && (
                <p className="text-sm text-zinc-500">No members yet — add some in Admin.</p>
              )}
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => pick(m)}
                  className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-left font-medium hover:bg-zinc-50"
                >
                  {m.name}
                  {!m.hasPassword && (
                    <span className="text-xs font-normal text-zinc-400">not joined yet</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex-1 overflow-y-auto p-4">
            {selected.hasPassword ? (
              <label className="mb-4 flex flex-col gap-1">
                <span className="text-sm font-medium">Password</span>
                <input
                  autoFocus
                  type="password"
                  className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-black"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            ) : (
              <>
                <p className="mb-3 text-sm text-zinc-500">
                  First time joining as {selected.name} — enter the board&rsquo;s join code and pick a
                  password you&rsquo;ll use to log back in.
                </p>
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
                <label className="mb-4 flex flex-col gap-1">
                  <span className="text-sm font-medium">Choose a password</span>
                  <input
                    type="password"
                    className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-black"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              </>
            )}

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-zinc-500 underline"
              >
                ← Not {selected.name}?
              </button>
              <button
                type="submit"
                disabled={busy}
                className="ml-auto rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Checking..." : selected.hasPassword ? "Log in" : "Join"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
