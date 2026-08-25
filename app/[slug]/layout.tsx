"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBoard } from "@/lib/useBoard";
import { apiFetch } from "@/lib/api";
import { getIdentity, setIdentity } from "@/lib/identity";

const TABS = [
  { href: "", label: "Home" },
  { href: "/display", label: "Display" },
  { href: "/admin", label: "Admin" },
];

export default function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { board, loading, error } = useBoard(slug);
  const pathname = usePathname();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    setMemberId(getIdentity(slug));
  }, [slug]);

  const isDisplay = pathname.endsWith("/display");

  useEffect(() => {
    // Don't force the login prompt open on the display screen — a passive
    // viewer shouldn't get blocked by it; they can still tap "Who am I?" in
    // the header to log in from there when they want to raise/vote.
    if (board && !memberId && !isDisplay) setPicking(true);
  }, [board, memberId, isDisplay]);

  if (loading) return <main className="p-8 text-zinc-500">Loading board...</main>;
  if (error || !board)
    return (
      <main className="p-8">
        <p className="text-red-600">{error ?? "Board not found"}</p>
        <Link href="/" className="mt-4 inline-block underline">
          Back home
        </Link>
      </main>
    );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 px-6 py-4">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <Link href={`/${slug}`} className="text-lg font-bold">
            Odi
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {TABS.map((t) => {
              const href = `/${slug}${t.href}`;
              const active = pathname === href;
              return (
                <Link
                  key={t.href}
                  href={href}
                  className={active ? "font-semibold underline" : "text-zinc-500 hover:text-black"}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <button onClick={() => setPicking(true)} className="text-xs text-zinc-500 underline">
            {memberId
              ? board.members.find((m) => m.id === memberId)?.name ?? "Who am I?"
              : "Who am I?"}
          </button>
        </div>
      </header>

      {picking && (
        <IdentityPicker
          slug={slug}
          members={board.members}
          onPicked={(id) => {
            setMemberId(id);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
          canClose={!!memberId || isDisplay}
        />
      )}

      <div className="flex-1">{children}</div>
    </div>
  );
}

function IdentityPicker({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Who are you?</h2>
          {canClose && (
            <button onClick={onClose} className="text-sm text-zinc-500">
              Close
            </button>
          )}
        </div>
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
  );
}
