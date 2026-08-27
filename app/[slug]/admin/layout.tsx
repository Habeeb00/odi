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
    <main className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col justify-center gap-3 px-6 py-16">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-od">
        Locked
      </span>
      <h1 className="display text-3xl leading-none">Admin access</h1>
      <p className="text-sm leading-relaxed text-muted">
        Enter this board&rsquo;s admin code. It went to whoever created the board and is
        separate from the join code members use.
      </p>
      <form onSubmit={submit} className="mt-2 flex flex-col gap-3">
        <input
          autoFocus
          className="rounded-xl border border-line bg-surface px-3 py-3 text-center font-mono text-lg uppercase tracking-[0.18em] outline-none transition placeholder:text-faint focus:border-ink"
          placeholder="ADMIN CODE"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        {error && <p className="text-sm text-od">{error}</p>}
        <button
          disabled={busy}
          className="rounded-xl bg-ink px-4 py-3.5 font-semibold text-paper transition hover:bg-od disabled:opacity-50"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
