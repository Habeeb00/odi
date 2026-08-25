"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBoard } from "@/lib/useBoard";
import { getIdentity } from "@/lib/identity";
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
  const [memberId, setMemberId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    setMemberId(getIdentity(slug));
  }, [slug]);

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
          canClose
        />
      )}

      <div className="flex-1">{children}</div>
    </div>
  );
}
