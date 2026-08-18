"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBoard } from "@/lib/useBoard";
import { getIdentity, setIdentity } from "@/lib/identity";

const TABS = [
  { href: "", label: "Home" },
  { href: "/raise", label: "Raise OD" },
  { href: "/leaderboard", label: "Leaderboard" },
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

  useEffect(() => {
    if (board && !memberId) setPicking(true);
  }, [board, memberId]);

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

  const isDisplay = pathname.endsWith("/display");

  return (
    <div className="flex min-h-screen flex-col">
      {!isDisplay && (
        <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <Link href={`/b/${slug}`} className="text-lg font-bold">
              {board.name}
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm">
              {TABS.map((t) => {
                const href = `/b/${slug}${t.href}`;
                const active = pathname === href;
                return (
                  <Link
                    key={t.href}
                    href={href}
                    className={active ? "font-semibold underline" : "text-zinc-500 hover:text-black dark:hover:text-white"}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>
            {memberId && (
              <button
                onClick={() => setPicking(true)}
                className="text-xs text-zinc-500 underline"
              >
                {board.members.find((m) => m.id === memberId)?.name ?? "Who am I?"}
              </button>
            )}
          </div>
        </header>
      )}

      {picking && !isDisplay && (
        <IdentityPicker
          slug={slug}
          members={board.members}
          onPicked={(id) => {
            setMemberId(id);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
          canClose={!!memberId}
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Who are you?</h2>
          {canClose && (
            <button onClick={onClose} className="text-sm text-zinc-500">
              Close
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {members.length === 0 && (
            <p className="text-sm text-zinc-500">No members yet — add some in Admin.</p>
          )}
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setIdentity(slug, m.id);
                onPicked(m.id);
              }}
              className="rounded-md border border-zinc-200 px-4 py-3 text-left font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
