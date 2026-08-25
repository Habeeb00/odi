"use client";

import { use, useEffect, useState } from "react";
import { useBoard } from "@/lib/useBoard";
import { apiFetch, fileToDataUrl } from "@/lib/api";
import { cropToFace } from "@/lib/faceCrop";
import { isAdminUnlocked, unlockAdmin } from "@/lib/adminAuth";
import type { Asset, Board, Category, Member, OD } from "@/lib/types";

export default function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { board, refetch } = useBoard(slug);
  const [unlocked, setUnlocked] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pendingOds, setPendingOds] = useState<OD[]>([]);

  useEffect(() => {
    setUnlocked(isAdminUnlocked(slug));
  }, [slug]);

  async function loadAssets() {
    setAssets(await apiFetch<Asset[]>(`/api/boards/${slug}/assets`));
  }
  async function loadPendingOds() {
    setPendingOds(await apiFetch<OD[]>(`/api/boards/${slug}/ods?status=PENDING`));
  }
  useEffect(() => {
    if (!unlocked) return;
    loadAssets();
    loadPendingOds();
  }, [slug, unlocked]);

  if (!board) return null;

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

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
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

function AdminGate({ slug, onUnlocked }: { slug: string; onUnlocked: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/boards/${slug}/admin/verify`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
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
  const [imageHappy, setImageHappy] = useState<File | null>(null);
  const [imageSad, setImageSad] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);

  async function facePhoto(file: File): Promise<string> {
    try {
      return await cropToFace(file);
    } catch {
      return fileToDataUrl(file);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const [imageDataUrl, imageHappyDataUrl, imageSadDataUrl] = await Promise.all([
        image ? facePhoto(image) : undefined,
        imageHappy ? facePhoto(imageHappy) : undefined,
        imageSad ? facePhoto(imageSad) : undefined,
      ]);
      await apiFetch(`/api/boards/${slug}/members`, {
        method: "POST",
        body: JSON.stringify({ name, imageDataUrl, imageHappyDataUrl, imageSadDataUrl }),
      });
      setName("");
      setImage(null);
      setImageHappy(null);
      setImageSad(null);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/api/boards/${slug}/members/${id}`, { method: "DELETE" });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  async function setPhoto(id: string, field: "imageDataUrl" | "imageHappyDataUrl" | "imageSadDataUrl", file: File) {
    setPhotoBusyId(id);
    setError(null);
    try {
      const dataUrl = await facePhoto(file);
      await apiFetch(`/api/boards/${slug}/members/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: dataUrl }),
      });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update photo");
    } finally {
      setPhotoBusyId(null);
    }
  }

  const PHOTO_SLOTS = [
    { field: "imageDataUrl" as const, label: "Normal", pick: (m: Member) => m.image },
    { field: "imageHappyDataUrl" as const, label: "Laughing", pick: (m: Member) => m.imageHappy },
    { field: "imageSadDataUrl" as const, label: "Crying", pick: (m: Member) => m.imageSad },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Each member can have three sticker photos — normal, laughing, and crying — shown on
        the display depending on whether they&rsquo;re winning or losing the race.
      </p>
      {members.map((m) => (
        <div
          key={m.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 px-4 py-2"
        >
          <div className="flex items-center gap-3">
            {m.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image} alt="" className="h-8 w-8 object-contain" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center bg-zinc-200 text-xs">
                {m.name[0]?.toUpperCase()}
              </span>
            )}
            <span>{m.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {PHOTO_SLOTS.map((slot) => (
              <label key={slot.field} className="text-sm text-zinc-500 underline cursor-pointer">
                {photoBusyId === m.id ? "Uploading..." : slot.pick(m) ? slot.label : `+ ${slot.label}`}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={photoBusyId === m.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPhoto(m.id, slot.field, file);
                    e.target.value = "";
                  }}
                />
              </label>
            ))}
            <button onClick={() => remove(m.id)} className="text-sm text-red-600">
              Remove
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={add} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
        <input
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
          placeholder="Member name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Normal photo
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Laughing photo (optional)
            <input type="file" accept="image/*" onChange={(e) => setImageHappy(e.target.files?.[0] ?? null)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Crying photo (optional)
            <input type="file" accept="image/*" onChange={(e) => setImageSad(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <button disabled={busy} className="self-start rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium">
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
          className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-4 py-2"
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
          <li key={c.id} className="rounded-full border border-zinc-300 px-3 py-1 text-sm">
            {c.name}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
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
          <div key={a.id} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
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

      <form onSubmit={add} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-4">
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
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 px-4 py-3">
        <span className="text-sm">Join code:</span>
        <span className="font-mono font-bold tracking-widest">{board.joinCode ?? "not set"}</span>
        <button
          onClick={regenerateJoinCode}
          disabled={regenerating}
          className="ml-auto rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {regenerating ? "Generating..." : board.joinCode ? "Regenerate" : "Generate"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 px-4 py-3">
        <span className="text-sm">Admin code:</span>
        <span className="font-mono font-bold tracking-widest">{newAdminCode ?? "hidden"}</span>
        <button
          onClick={regenerateAdminCode}
          disabled={regeneratingAdmin}
          className="ml-auto rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {regeneratingAdmin ? "Generating..." : "Regenerate"}
        </button>
      </div>
      {newAdminCode && (
        <p className="-mt-2 text-xs text-zinc-500">
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
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
