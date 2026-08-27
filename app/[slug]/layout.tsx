"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useBoard } from "@/lib/useBoard";
import { apiFetch } from "@/lib/api";
import { getIdentity, setIdentity, clearIdentity } from "@/lib/identity";
import { isAdminUnlocked } from "@/lib/adminAuth";
import IdentityPicker from "@/components/IdentityPicker";

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
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAdmin(isAdminUnlocked(slug));
    const existing = getIdentity(slug);
    if (existing || !isAdminUnlocked(slug)) {
      setMemberId(existing);
      return;
    }
    // Same admin-is-already-a-member shortcut as the raise page — resolve
    // identity from the admin session instead of showing "Who am I?".
    apiFetch<{ memberId: string }>(`/api/boards/${slug}/admin/self`, { method: "POST" })
      .then(({ memberId }) => {
        if (!cancelled) {
          setIdentity(slug, memberId);
          setMemberId(memberId);
        }
      })
      .catch(() => {
        // No member linked to this admin (older board) — stays "Who am I?".
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function signOut() {
    clearIdentity(slug);
    setMemberId(null);
    try {
      await apiFetch(`/api/boards/${slug}/logout`, { method: "POST" });
    } catch {
      // Local identity is already cleared — a failed cookie clear just
      // means the next login re-signs the cookie anyway.
    }
    // The raise page keeps its own memberId state from a one-time read of
    // localStorage — a full navigation forces it to re-check, rather than
    // it staying stale on the now-signed-out member's raise UI.
    router.push(`/${slug}`);
  }

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-faint">Loading board…</p>
      </main>
    );

  if (error || !board)
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="display text-3xl">No board here</h1>
        <p className="text-sm text-muted">{error ?? "That link doesn't point at a board."}</p>
        <Link
          href="/"
          className="mt-3 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
        >
          Back to ഒടി
        </Link>
      </main>
    );

  const me = memberId ? board.members.find((m) => m.id === memberId) : null;
  // The Admin tab only appears once this browser has proved the admin code —
  // showing it to everyone just led them to a gate they couldn't open.
  // "Cases" rather than "Raise": that tab is where you vote on open ropes as
  // much as where you start a new one, and voting is the more frequent visit.
  const tabs = [
    { href: "", label: "Board" },
    { href: "/raise", label: "Cases" },
    ...(admin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href={`/${slug}`} className="flex min-w-0 items-baseline gap-2">
            <span className="wordmark text-xl">ഒടി</span>
            <span className="truncate text-sm text-muted">{board.name}</span>
          </Link>

          <nav className="ml-auto flex shrink-0 rounded-lg bg-surface p-0.5 ring-1 ring-line">
            {tabs.map((t) => {
              const href = `/${slug}${t.href}`;
              const active = pathname === href;
              return (
                <Link
                  key={t.href}
                  href={href}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                    active ? "bg-ink text-paper" : "text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          {me ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => setPicking(true)}
                title="Switch member"
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2.5"
              >
                {me.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.image} alt="" className="h-6 w-6 rounded-full object-contain" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-paper text-[10px] font-bold">
                    {me.name[0]?.toUpperCase()}
                  </span>
                )}
                <span className="max-w-[70px] truncate text-xs font-medium">{me.name}</span>
              </button>
              <button
                onClick={signOut}
                title="Sign out"
                aria-label="Sign out"
                className="text-xs text-faint hover:text-od"
              >
                ⏏
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPicking(true)}
              className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:border-ink"
            >
              Sign in
            </button>
          )}
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
          canClose
        />
      )}

      <div className="flex-1">{children}</div>
    </div>
  );
}
