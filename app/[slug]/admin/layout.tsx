"use client";

import { use, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { isAdminUnlocked, unlockAdmin } from "@/lib/adminAuth";
import { setIdentity } from "@/lib/identity";

export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(isAdminUnlocked(slug));
  }, [slug]);

  if (!unlocked) {
    return (
      <AdminGate
        slug={slug}
        onUnlocked={() => {
          unlockAdmin(slug);
          setUnlocked(true);
        }}
      />
    );
  }

  return <>{children}</>;
}

function AdminGate({ slug, onUnlocked }: { slug: string; onUnlocked: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Verifying admin access also logs the admin in as their own member
      // (see app/api/boards/[slug]/admin/verify) — no separate join-code
      // check needed since they're already a member of their own board.
      const { memberId } = await apiFetch<{ memberId: string | null }>(
        `/api/boards/${slug}/admin/verify`,
        { method: "POST", body: JSON.stringify({ code }) }
      );
      if (memberId) setIdentity(slug, memberId);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-xl font-bold">Admin access</h1>
      <p className="text-sm text-zinc-500">
        Enter this board&rsquo;s admin code — given to whoever created it, separate from the
        join code members use.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          autoFocus
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-center font-mono text-lg uppercase tracking-widest outline-none focus:border-black"
          placeholder="ADMIN CODE"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={busy}
          className="rounded-md bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Checking..." : "Unlock"}
        </button>
      </form>
    </main>
  );
}
