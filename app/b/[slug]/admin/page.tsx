"use client";

import { use, useEffect, useState } from "react";
import { useBoard } from "@/lib/useBoard";
import { apiFetch, fileToDataUrl } from "@/lib/api";
import type { Asset, Board, Category, Member, OD } from "@/lib/types";

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-bold">Board admin</h1>

      <Section title="Members">
        <MemberList slug={slug} members={board.members} onChange={refetch} />
      </Section>

      <Section title="Pending ODs">
        <PendingOdList ods={pendingOds} onChange={loadPendingOds} />
      </Section>

      <Section title="Categories">
        <CategoryList slug={slug} categories={board.categories} onChange={refetch} />
      </Section>

      <Section title="Assets">
        <AssetManager
          slug={slug}
          categories={board.categories}
          assets={assets}
          onChange={loadAssets}
        />
      </Section>

      <Section title="Settings">
        <SettingsForm slug={slug} board={board} onChange={refetch} />
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MemberList({
  slug,
  members,
  onChange,
}: {
  slug: string;
  members: Member[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const imageDataUrl = image ? await fileToDataUrl(image) : undefined;
      await apiFetch(`/api/boards/${slug}/members`, {
        method: "POST",
        body: JSON.stringify({ name, imageDataUrl }),
      });
      setName("");
      setImage(null);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await apiFetch(`/api/boards/${slug}/members/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="flex flex-col gap-3">
      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <span>{m.name}</span>
          <button onClick={() => remove(m.id)} className="text-sm text-red-600">
            Remove
          </button>
        </div>
      ))}
      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <input
          className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2"
          placeholder="Member name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        <button disabled={busy} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium">
          Add
        </button>
      </form>
    </div>
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
    return <p className="text-sm text-zinc-500">No pending ODs.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {ods.map((od) => (
        <div
          key={od.id}
          className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-4 py-2 dark:border-zinc-800"
        >
          <div>
            <p className="text-sm">
              <strong>{od.raisedBy.name}</strong> vs <strong>{od.accused.name}</strong> — {od.category.name}
            </p>
            <p className="text-xs text-zinc-500">{od.description}</p>
          </div>
          <button
            onClick={() => close(od.id)}
            disabled={busyId === od.id}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium"
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch(`/api/boards/${slug}/categories`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setName("");
    onChange();
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <li key={c.id} className="rounded-full border border-zinc-300 px-3 py-1 text-sm">
            {c.name}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium">Add</button>
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
      <p className="text-sm text-zinc-500">
        Upload the developer-provided images/dialogues shown on the display for each category.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {assets.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            {a.file && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.file} alt="" className="h-32 w-full rounded-md object-cover" />
            )}
            {a.dialogue && <p className="text-sm italic">&ldquo;{a.dialogue}&rdquo;</p>}
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{a.severity ?? "any severity"}</span>
              <button onClick={() => remove(a.id)} className="text-red-600">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <input
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
          placeholder="Dialogue (optional)"
          value={dialogue}
          onChange={(e) => setDialogue(e.target.value)}
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
        >
          <option value="">Any severity</option>
          <option value="MILD">Mild</option>
          <option value="MEDIUM">Medium</option>
          <option value="SEVERE">Severe</option>
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium">
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch(`/api/boards/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ votingDurationHours, dailyOdLimit }),
    });
    setSaved(true);
    onChange();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Voting duration (hours)</span>
        <input
          type="number"
          min={1}
          value={votingDurationHours}
          onChange={(e) => setVotingDurationHours(Number(e.target.value))}
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Daily OD limit per member</span>
        <input
          type="number"
          min={1}
          value={dailyOdLimit}
          onChange={(e) => setDailyOdLimit(Number(e.target.value))}
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
        />
      </label>
      <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium">Save</button>
      {saved && <span className="text-sm text-zinc-500">Saved.</span>}
    </form>
  );
}
