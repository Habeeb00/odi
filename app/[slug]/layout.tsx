"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useBoard } from "@/lib/useBoard";
import { apiFetch } from "@/lib/api";
import { getIdentity, setIdentity, clearIdentity } from "@/lib/identity";
import { isAdminUnlocked } from "@/lib/adminAuth";
import IdentityPicker from "@/components/IdentityPicker";

const TABS = [
  { href: "", label: "Home" },
  { href: "/raise", label: "Raise" },
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
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let cancelled = false;
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
            ഒടി
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
          <div className="flex items-center gap-3">
            <button onClick={() => setPicking(true)} className="text-xs text-zinc-500 underline">
              {memberId
                ? board.members.find((m) => m.id === memberId)?.name ?? "Who am I?"
                : "Who am I?"}
            </button>
            {memberId && (
              <button onClick={signOut} className="text-xs text-zinc-500 underline">
                Sign out
              </button>
            )}
          </div>
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
