"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useBoard } from "@/lib/useBoard";
import { apiFetch, fileToDataUrl } from "@/lib/api";
import FaceRoster from "@/components/FaceRoster";
import type { Asset, Board, Category, OD } from "@/lib/types";

export default function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { board, refetch } = useBoard(slug);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pendingOds, setPendingOds] = useState<OD[]>([]);

  async function loadAssets() {
    setAssets(await apiFetch<Asset[]>(`/api/boards/${slug}/assets`));
  }
  async function loadPendingOds() {
    setPendingOds(await apiFetch<OD[]>(`/api/boards/${slug}/ods?status=PENDING`));
  }
  useEffect(() => {
    loadAssets();
    loadPendingOds();
  }, [slug]);

  if (!board) return null;

  const claimed = board.members.filter((m) => m.hasPassword).length;
  // Three things stand between a fresh board and a working one. Named plainly
  // so the admin can see what's left instead of guessing which panel to open.
  const setup = [
    {
      done: board.members.length >= 2,
      label: "Get the faces in",
      hint: "Two heads minimum — you can't accuse yourself.",
    },
    {
      done: board.members.length > 0 && board.members.every((m) => m.image),
      label: "Give every head a photo",
      hint: `${board.members.filter((m) => !m.image).length} still blank — a faceless head can't be picked out of the tub.`,
    },
    {
      done: !!board.joinCode,
      label: "Share the invite",
      hint: "The link carries the join code, so nobody has to type it.",
    },
    {
      done: claimed >= 2,
      label: "Let them claim their names",
      hint: `${claimed} of ${board.members.length} have picked a password.`,
    },
  ];
  const remaining = setup.filter((s) => !s.done);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            {board.name}
          </span>
          <h1 className="display text-3xl leading-none">Back of house</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/${slug}/admin/test`}
            className="text-sm text-muted underline decoration-line hover:text-ink"
          >
            Test mode
          </Link>
          <ShareInviteButton slug={slug} board={board} />
        </div>
      </div>

      {remaining.length > 0 && (
        <ol className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
          {setup.map((step, i) => (
            <li
              key={step.label}
              className={`flex items-baseline gap-3 px-5 py-3 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span
                className={`font-mono text-xs ${step.done ? "text-clear" : "text-od"}`}
                aria-hidden
              >
                {step.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${step.done ? "text-faint line-through" : ""}`}>
                  {step.label}
                </p>
                {!step.done && <p className="mt-0.5 text-xs text-muted">{step.hint}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Section
        title="The tub"
        description="Everyone on the board. Photos become the heads that race, get judged, and pull the rope."
      >
        <FaceRoster slug={slug} members={board.members} onChange={refetch} />
      </Section>

      <Section
        title="Open cases"
        description="Close a case early instead of waiting out the voting window."
        badge={pendingOds.length || undefined}
      >
        <PendingOdList ods={pendingOds} onChange={loadPendingOds} />
      </Section>

      <Section title="Categories" description="The kinds of OD your group actually commits.">
        <CategoryList slug={slug} categories={board.categories} onChange={refetch} />
      </Section>

      <Section title="Assets" description="Images and dialogue the display shows per category.">
        <AssetManager
          slug={slug}
          categories={board.categories}
          assets={assets}
          onChange={loadAssets}
        />
      </Section>

      <Section title="Settings" description="Codes, voting window, and daily limits.">
        <SettingsForm slug={slug} board={board} onChange={refetch} />
      </Section>
    </main>
  );
}

// Bundles the join code into the raise-page link itself, so whoever opens
// it lands straight on the name picker with the code already filled in —
// no copy-pasting a code into a separate field.
function ShareInviteButton({ slug, board }: { slug: string; board: Board }) {
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!board.joinCode) return null;

  async function shareInvite() {
    const url = `${window.location.origin}/${slug}/raise?code=${board.joinCode}`;
    setError(null);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${board.name} on ഒടി`, url });
      } catch {
        // User cancelled the share sheet — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      setError("Couldn't copy the invite link");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={shareInvite}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper"
      >
        {shared ? "Copied!" : "Share invite"}
      </button>
      {error && <p className="text-xs text-od">{error}</p>}
    </div>
  );
}

function Section({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description?: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="display text-lg leading-none">{title}</h2>
          {badge !== undefined && (
            <span className="rounded-full bg-od-soft px-2 py-0.5 text-[11px] font-bold text-od">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function PendingOdList({ ods, onChange }: { ods: OD[]; onChange: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function close(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/api/ods/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "close" }),
      });
      onChange();
    } finally {
      setBusyId(null);
    }
  }

  if (ods.length === 0) {
    return <p className="text-sm text-muted">No pending ODs.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {ods.map((od) => (
        <div
          key={od.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-2"
        >
          <div>
            <p className="text-sm">
              <strong>{od.raisedBy.name}</strong> vs <strong>{od.accused.name}</strong> — {od.category.name}
            </p>
            <p className="text-xs text-muted">{od.description}</p>
          </div>
          <button
            onClick={() => close(od.id)}
            disabled={busyId === od.id}
            className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-medium"
          >
            Close now
          </button>
        </div>
      ))}
    </div>
  );
}

function CategoryList({
  slug,
  categories,
  onChange,
}: {
  slug: string;
  categories: Category[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/boards/${slug}/categories`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <li key={c.id} className="rounded-full border border-line px-3 py-1 text-sm">
            {c.name}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-od">{error}</p>}
      <form onSubmit={add} className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-line bg-transparent px-3 py-2"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="rounded-lg border border-line px-3 py-2 text-sm font-medium">Add</button>
      </form>
    </div>
  );
}

function AssetManager({
  slug,
  categories,
  assets,
  onChange,
}: {
  slug: string;
  categories: Category[];
  assets: Asset[];
  onChange: () => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [dialogue, setDialogue] = useState("");
  const [severity, setSeverity] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fileDataUrl = file ? await fileToDataUrl(file) : undefined;
      await apiFetch(`/api/boards/${slug}/assets`, {
        method: "POST",
        body: JSON.stringify({ categoryId, dialogue, severity: severity || undefined, fileDataUrl }),
      });
      setDialogue("");
      setFile(null);
      setSeverity("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add asset");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await apiFetch(`/api/boards/${slug}/assets/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="flex flex-col gap-4">
      {assets.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
          No assets yet. The display just shows the description on its own.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {assets.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
            {a.file && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.file} alt="" className="h-32 w-full rounded-lg object-cover" />
            )}
            {a.dialogue && <p className="text-sm italic">&ldquo;{a.dialogue}&rdquo;</p>}
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{a.severity ?? "any severity"}</span>
              <button onClick={() => remove(a.id)} className="text-od">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="flex flex-col gap-2 rounded-lg border border-line p-4">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-line bg-transparent px-3 py-2"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <input
          className="rounded-lg border border-line bg-transparent px-3 py-2"
          placeholder="Dialogue (optional)"
          value={dialogue}
          onChange={(e) => setDialogue(e.target.value)}
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg border border-line bg-transparent px-3 py-2"
        >
          <option value="">Any severity</option>
          <option value="MILD">Mild</option>
          <option value="MEDIUM">Medium</option>
          <option value="SEVERE">Severe</option>
        </select>
        {error && <p className="text-sm text-od">{error}</p>}
        <button disabled={busy} className="rounded-lg border border-line px-3 py-2 text-sm font-medium">
          Add asset
        </button>
      </form>
    </div>
  );
}

function SettingsForm({
  slug,
  board,
  onChange,
}: {
  slug: string;
  board: Board;
  onChange: () => void;
}) {
  const [votingDurationHours, setVotingDurationHours] = useState(board.votingDurationHours);
  const [dailyOdLimit, setDailyOdLimit] = useState(board.dailyOdLimit);
  const [saved, setSaved] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingAdmin, setRegeneratingAdmin] = useState(false);
  const [newAdminCode, setNewAdminCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/boards/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ votingDurationHours, dailyOdLimit }),
      });
      setSaved(true);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  }

  async function regenerateJoinCode() {
    setRegenerating(true);
    setError(null);
    try {
      await apiFetch(`/api/boards/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ regenerateJoinCode: true }),
      });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate join code");
    } finally {
      setRegenerating(false);
    }
  }

  async function regenerateAdminCode() {
    setRegeneratingAdmin(true);
    setError(null);
    try {
      const updated = await apiFetch<Board>(`/api/boards/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ regenerateAdminCode: true }),
      });
      setNewAdminCode(updated.adminCode ?? null);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate admin code");
    } finally {
      setRegeneratingAdmin(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3">
        <span className="text-sm">Join code:</span>
        <span className="font-mono font-bold tracking-widest">{board.joinCode ?? "not set"}</span>
        <button
          onClick={regenerateJoinCode}
          disabled={regenerating}
          className="ml-auto rounded-lg border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {regenerating ? "Generating..." : board.joinCode ? "Regenerate" : "Generate"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3">
        <span className="text-sm">Admin code:</span>
        <span className="font-mono font-bold tracking-widest">{newAdminCode ?? "hidden"}</span>
        <button
          onClick={regenerateAdminCode}
          disabled={regeneratingAdmin}
          className="ml-auto rounded-lg border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {regeneratingAdmin ? "Generating..." : "Regenerate"}
        </button>
      </div>
      {newAdminCode && (
        <p className="-mt-2 text-xs text-muted">
          Save this now — it won&rsquo;t be shown again after you leave this page.
        </p>
      )}

      <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Voting duration (hours)</span>
          <input
            type="number"
            min={1}
            value={votingDurationHours}
            onChange={(e) => setVotingDurationHours(Number(e.target.value))}
            className="rounded-lg border border-line bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Daily OD limit per member</span>
          <input
            type="number"
            min={1}
            value={dailyOdLimit}
            onChange={(e) => setDailyOdLimit(Number(e.target.value))}
            className="rounded-lg border border-line bg-transparent px-3 py-2"
          />
        </label>
        <button className="rounded-lg border border-line px-3 py-2 text-sm font-medium">Save</button>
        {saved && <span className="text-sm text-muted">Saved.</span>}
      </form>
      {error && <p className="text-sm text-od">{error}</p>}
    </div>
  );
}
