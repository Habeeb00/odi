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
  initialCode,
}: {
  slug: string;
  members: PickableMember[];
  onPicked: (id: string) => void;
  onClose: () => void;
  canClose: boolean;
  // Pre-fills the join code when someone arrives via an invite link (see
  // ?code= on the raise page) so they only need to pick their name.
  initialCode?: string;
}) {
  const [selected, setSelected] = useState<PickableMember | null>(null);
  const [code, setCode] = useState(initialCode ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(member: PickableMember) {
    setSelected(member);
    setCode(initialCode ?? "");
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4"
      onClick={canClose ? onClose : undefined}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-sm animate-[rise-in_0.25s_ease-out] flex-col overflow-hidden rounded-2xl bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="display truncate text-xl leading-none">
              {selected ? selected.name : "Who are you?"}
            </h2>
            {!selected && (
              <p className="mt-1 text-xs text-muted">Tap your own face.</p>
            )}
          </div>
          {canClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg text-faint hover:bg-paper hover:text-ink"
            >
              ×
            </button>
          )}
        </div>

        {!selected ? (
          /* Faces, not a list of names — you point at yourself in the tub. */
          <div className="flex-1 overflow-y-auto p-4">
            {members.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted">
                No members yet — whoever runs this board needs to throw the faces in first.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-x-2 gap-y-4">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => pick(m)}
                    title={m.name}
                    className="group flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition hover:bg-paper"
                  >
                    {/* A photo can be dark, blank, or a bad crop — so the name
                        sits under every face, and rides over it on hover/focus
                        as well, where the face itself tells you nothing. */}
                    <span className="relative flex h-16 w-16 items-center justify-center">
                      {m.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image}
                          alt={m.name}
                          className="h-16 w-16 object-contain transition group-hover:scale-110"
                        />
                      ) : (
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-paper text-xl font-black text-faint transition group-hover:scale-110">
                          {m.name[0]?.toUpperCase()}
                        </span>
                      )}
                      <span className="pointer-events-none absolute inset-x-[-6px] bottom-0 truncate rounded bg-ink/85 px-1 py-0.5 text-center text-[10px] font-bold text-paper opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                        {m.name}
                      </span>
                    </span>
                    <span className="w-full truncate text-center text-xs font-semibold group-hover:text-od">
                      {m.name}
                    </span>
                    <span className="text-[10px] text-faint">
                      {m.hasPassword ? "" : "first time"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="flex-1 overflow-y-auto p-5">
            {selected.hasPassword ? (
              <label className="mb-4 flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Password
                </span>
                <input
                  autoFocus
                  type="password"
                  className="rounded-xl border border-line bg-transparent px-3.5 py-2.5 outline-none transition focus:border-ink"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            ) : (
              <>
                <p className="mb-4 text-sm leading-relaxed text-muted">
                  First time as {selected.name}.{" "}
                  {initialCode
                    ? "Your invite code is filled in — just pick a password you'll remember."
                    : "Enter the board's join code, then pick a password you'll remember."}
                </p>
                <label className="mb-4 flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Join code
                  </span>
                  <input
                    autoFocus={!initialCode}
                    className="rounded-xl border border-line bg-transparent px-3.5 py-2.5 text-center font-mono uppercase tracking-[0.18em] outline-none transition focus:border-ink"
                    placeholder="AB12CD"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <label className="mb-4 flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Choose a password
                  </span>
                  <input
                    autoFocus={!!initialCode}
                    type="password"
                    className="rounded-xl border border-line bg-transparent px-3.5 py-2.5 outline-none transition focus:border-ink"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              </>
            )}

            {error && <p className="mb-3 text-sm text-od">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-muted underline decoration-line hover:text-ink"
              >
                Not {selected.name}?
              </button>
              <button
                type="submit"
                disabled={busy}
                className="ml-auto rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-od disabled:opacity-50"
              >
                {busy ? "Checking…" : selected.hasPassword ? "Log in" : "Join"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
