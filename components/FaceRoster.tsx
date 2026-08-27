"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, fileToDataUrl } from "@/lib/api";
import { cropToFace } from "@/lib/faceCrop";
import { generateMoodSticker } from "@/lib/moodSticker";
import { HeadPile } from "@/components/HeadPile";
import type { Member } from "@/lib/types";

// Adding people is the first thing anyone does with a new board, so it isn't
// a form: you throw in a pile of photos (drop, pick, or paste), each one gets
// cut down to a face, and all that's left is typing a name under each head.
//
// A head can carry three photos — normal, laughing, crying — because the race
// swaps between them by standing. You can supply all three yourself; anything
// you skip is derived from the normal one on save.

type Slot = "normal" | "happy" | "sad";

type Draft = {
  key: string;
  name: string;
  faces: Record<Slot, string | null>;
  state: "cropping" | "ready" | "saving" | "failed";
  note?: string;
};

const SLOTS: { slot: Slot; label: string; field: string }[] = [
  { slot: "normal", label: "normal", field: "imageDataUrl" },
  { slot: "happy", label: "laughing", field: "imageHappyDataUrl" },
  { slot: "sad", label: "crying", field: "imageSadDataUrl" },
];

// Camera and app exports carry names that are worse than nothing; anything
// that looks human-typed gets offered as the member's name.
const JUNK_STEM = /^(img|dsc|dscn|pxl|photo|image|screenshot|whatsapp|signal|snapchat|fb_img|received)[-_ ]?/i;

function nameFromFile(file: File): string {
  const stem = file.name.replace(/\.[^.]+$/, "");
  if (JUNK_STEM.test(stem) || !/[a-z]{2}/i.test(stem.replace(JUNK_STEM, ""))) return "";
  return stem
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ")
    .slice(0, 40);
}

// Crop to the face when a face can be found, keep the whole photo when it
// can't — never drop what someone handed us.
async function toFace(file: File): Promise<{ face: string; note?: string }> {
  try {
    return { face: await cropToFace(file) };
  } catch {
    return { face: await fileToDataUrl(file), note: "no face found — using the whole photo" };
  }
}

let draftSeq = 0;

export default function FaceRoster({
  slug,
  members,
  onChange,
}: {
  slug: string;
  members: Member[];
  onChange: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function patchDraft(key: string, patch: Partial<Draft>) {
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  async function intake(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setError(null);

    const staged: Draft[] = images.map((file) => ({
      key: `d${draftSeq++}`,
      name: nameFromFile(file),
      faces: { normal: null, happy: null, sad: null },
      state: "cropping",
    }));
    setDrafts((list) => [...list, ...staged]);

    // One at a time: the face detector is heavy enough that ten in parallel
    // locks the tab up on a phone.
    for (let i = 0; i < images.length; i++) {
      const draft = staged[i];
      try {
        const { face, note } = await toFace(images[i]);
        patchDraft(draft.key, {
          faces: { normal: face, happy: null, sad: null },
          state: "ready",
          note,
        });
      } catch {
        patchDraft(draft.key, { state: "failed", note: "couldn't read that file" });
      }
    }
  }

  // Replacing or adding one of a draft's three photos.
  async function setDraftFace(key: string, slot: Slot, file: File) {
    const { face, note } = await toFace(file);
    setDrafts((list) =>
      list.map((d) =>
        d.key === key ? { ...d, faces: { ...d.faces, [slot]: face }, note: note ?? d.note } : d
      )
    );
  }

  // Pasting a photo straight from the clipboard is the fastest path when the
  // group chat is open in the next tab.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length > 0) intake(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One name per board — the server enforces it too (409), but catching it
  // here means you fix it while the head is still in your hands.
  const taken = new Set(members.map((m) => m.name.trim().toLowerCase()));
  function clashFor(draft: Draft): string | null {
    const n = draft.name.trim().toLowerCase();
    if (!n) return null;
    if (taken.has(n)) return "already on this board";
    if (drafts.filter((d) => d.name.trim().toLowerCase() === n).length > 1) {
      return "used twice in this batch";
    }
    return null;
  }

  const ready = drafts.filter(
    (d) => d.state === "ready" && d.name.trim() && d.faces.normal && !clashFor(d)
  );
  const blocked = drafts.filter((d) => d.state === "ready" && clashFor(d)).length;
  const nameless = drafts.filter((d) => d.state === "ready" && !d.name.trim()).length;

  async function commit() {
    if (ready.length === 0) return;
    setSaving(true);
    setError(null);
    let failed = 0;

    for (const draft of ready) {
      patchDraft(draft.key, { state: "saving" });
      const normal = draft.faces.normal as string;
      try {
        // Whatever wasn't supplied is derived here rather than server-side:
        // it's a canvas composite (see lib/moodSticker.ts), no API, no cost.
        const [happy, sad] = await Promise.all([
          draft.faces.happy ?? generateMoodSticker(normal, "happy").catch(() => undefined),
          draft.faces.sad ?? generateMoodSticker(normal, "sad").catch(() => undefined),
        ]);
        await apiFetch(`/api/boards/${slug}/members`, {
          method: "POST",
          body: JSON.stringify({
            name: draft.name.trim(),
            imageDataUrl: normal,
            imageHappyDataUrl: happy,
            imageSadDataUrl: sad,
          }),
        });
        setDrafts((list) => list.filter((d) => d.key !== draft.key));
      } catch (err) {
        failed++;
        patchDraft(draft.key, {
          state: "ready",
          note: err instanceof Error ? err.message : "wouldn't save",
        });
      }
    }

    setSaving(false);
    if (failed > 0) setError(`${failed} head${failed === 1 ? "" : "s"} didn't make it onto the board.`);
    onChange();
  }

  const facelessCount = members.filter((m) => !m.image).length;

  return (
    <div className="flex flex-col gap-6">
      {/* The tub: the board as it stands, everyone in one picture. */}
      {members.length > 0 && (
        <div>
          <div className="rounded-2xl bg-paper px-4 pb-3 pt-6">
            <HeadPile heads={members} />
          </div>
          <p className="mt-2 font-mono text-xs text-faint">
            {members.length} in the tub · {members.filter((m) => m.hasPassword).length} claimed
            their name
          </p>
        </div>
      )}

      {facelessCount > 0 && (
        <p className="rounded-xl border border-od bg-od-soft px-4 py-3 text-sm leading-relaxed text-od">
          {facelessCount} head{facelessCount === 1 ? " has" : "s have"} no photo. Without one
          they&rsquo;re a blank circle in the race and impossible to pick out at login — click
          the empty circle below to fix it.
        </p>
      )}

      {/* Intake. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          intake(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${
          dragging ? "border-od bg-od-soft" : "border-line hover:border-ink"
        }`}
      >
        <p className="display text-xl leading-none">Throw the faces in</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Drop, paste, or pick as many photos as you like — one person per photo. Each gets cut
          down to the face. Then you just type names.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            intake(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {/* Staged heads waiting for names. */}
      {drafts.length > 0 && (
        <div className="rounded-2xl border-2 border-ink bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="display text-lg leading-none">Name them</p>
            <p className="font-mono text-xs text-faint">
              {nameless > 0
                ? `${nameless} still nameless`
                : blocked > 0
                  ? `${blocked} name clash${blocked === 1 ? "" : "es"}`
                  : "all named"}
            </p>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Each head can take three photos. Add a laughing and a crying one if you have them —
            skip them and they&rsquo;re derived from the normal photo.
          </p>

          <div id="draft-tray" className="mt-4 flex flex-wrap gap-5">
            {drafts.map((draft, i) => (
              <DraftHead
                key={draft.key}
                draft={draft}
                autoFocus={i === 0 && !draft.name}
                clash={clashFor(draft)}
                onName={(name) => patchDraft(draft.key, { name })}
                onFace={(slot, file) => setDraftFace(draft.key, slot, file)}
                onDiscard={() => setDrafts((list) => list.filter((d) => d.key !== draft.key))}
                onEnter={() => {
                  const inputs = Array.from(
                    document.querySelectorAll<HTMLInputElement>("#draft-tray input[type=text]")
                  );
                  const idx = inputs.findIndex((el) => el === document.activeElement);
                  if (inputs[idx + 1]) inputs[idx + 1].focus();
                  else if (ready.length > 0) commit();
                }}
              />
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-od">{error}</p>}

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={commit}
              disabled={saving || ready.length === 0}
              className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-od disabled:opacity-40"
            >
              {saving
                ? "Adding…"
                : ready.length === 0
                  ? blocked > 0
                    ? "Fix the name clash"
                    : "Name at least one"
                  : `Put ${ready.length} on the board`}
            </button>
            <button
              onClick={() => setDrafts([])}
              disabled={saving}
              className="text-sm text-muted underline decoration-line hover:text-ink"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Everyone already on the board, as heads you can edit in place. */}
      {members.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-6">
          {members.map((m) => (
            <RosterHead
              key={m.id}
              slug={slug}
              member={m}
              others={members.filter((o) => o.id !== m.id)}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DraftHead({
  draft,
  autoFocus,
  clash,
  onName,
  onFace,
  onDiscard,
  onEnter,
}: {
  draft: Draft;
  autoFocus: boolean;
  clash: string | null;
  onName: (name: string) => void;
  onFace: (slot: Slot, file: File) => void;
  onDiscard: () => void;
  onEnter: () => void;
}) {
  return (
    <div className="relative w-28">
      <button
        onClick={onDiscard}
        aria-label="Discard this face"
        className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-xs text-paper"
      >
        ×
      </button>

      <FaceSlot
        face={draft.faces.normal}
        label="normal"
        size="lg"
        pending={draft.state === "cropping"}
        dim={draft.state === "saving"}
        onPick={(file) => onFace("normal", file)}
      />

      <input
        type="text"
        value={draft.name}
        autoFocus={autoFocus}
        placeholder="name"
        disabled={draft.state === "saving"}
        onChange={(e) => onName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          onEnter();
        }}
        className={`mt-2 w-full border-b bg-transparent pb-1 text-center text-sm outline-none transition placeholder:text-faint ${
          clash ? "border-od text-od" : "border-line focus:border-ink"
        }`}
      />

      <div className="mt-2 flex justify-center gap-1.5">
        {SLOTS.filter((s) => s.slot !== "normal").map((s) => (
          <FaceSlot
            key={s.slot}
            face={draft.faces[s.slot]}
            label={s.label}
            size="sm"
            onPick={(file) => onFace(s.slot, file)}
          />
        ))}
      </div>

      {clash ? (
        <p className="mt-1 text-center text-[10px] leading-tight text-od">{clash}</p>
      ) : (
        draft.note && (
          <p className="mt-1 text-center text-[10px] leading-tight text-faint">{draft.note}</p>
        )
      )}
    </div>
  );
}

// One clickable photo well. Big for the normal photo, small for the moods.
function FaceSlot({
  face,
  label,
  size,
  pending,
  dim,
  onPick,
}: {
  face: string | null;
  label: string;
  size: "lg" | "sm";
  pending?: boolean;
  dim?: boolean;
  onPick: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const box = size === "lg" ? "h-24 w-full" : "h-8 w-8";

  return (
    <>
      <button
        type="button"
        title={face ? `${label} photo — click to replace` : `add a ${label} photo`}
        onClick={() => ref.current?.click()}
        className={`group relative flex ${box} items-center justify-center overflow-hidden rounded-full bg-paper transition hover:ring-2 hover:ring-ink`}
      >
        {pending ? (
          <span className="text-[10px] text-faint">cutting…</span>
        ) : face ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={face}
            alt={label}
            className={`h-full w-full object-contain ${dim ? "opacity-40" : ""}`}
          />
        ) : (
          <span className={`text-faint ${size === "lg" ? "text-sm" : "text-[13px] leading-none"}`}>
            {size === "lg" ? "add photo" : "+"}
          </span>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

const MOODS = [
  { field: "imageDataUrl" as const, label: "normal", pick: (m: Member) => m.image, mood: null },
  { field: "imageHappyDataUrl" as const, label: "laugh", pick: (m: Member) => m.imageHappy, mood: "happy" as const },
  { field: "imageSadDataUrl" as const, label: "cry", pick: (m: Member) => m.imageSad, mood: "sad" as const },
];

function RosterHead({
  slug,
  member,
  others,
  onChange,
}: {
  slug: string;
  member: Member;
  others: Member[];
  onChange: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    try {
      await apiFetch(`/api/boards/${slug}/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "didn't stick");
    } finally {
      setBusy(null);
    }
  }

  async function setPhoto(field: string, file: File) {
    setBusy(field);
    const { face } = await toFace(file);
    await patch({ [field]: face }, field);
  }

  async function deriveMood(mood: "happy" | "sad") {
    if (!member.image) return;
    setBusy(mood);
    try {
      const sticker = await generateMoodSticker(member.image, mood);
      await patch({ [mood === "happy" ? "imageHappyDataUrl" : "imageSadDataUrl"]: sticker }, mood);
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't derive that");
      setBusy(null);
    }
  }

  function commitName() {
    const next = name.trim();
    if (!next) return setName(member.name);
    if (next === member.name) return;
    if (others.some((o) => o.name.trim().toLowerCase() === next.toLowerCase())) {
      setError("that name is taken");
      setName(member.name);
      return;
    }
    patch({ name: next }, "name");
  }

  return (
    <div className="w-28">
      <div className="relative" title={member.name}>
        <FaceSlot
          face={member.image}
          label="normal"
          size="lg"
          dim={!!busy}
          onPick={(file) => setPhoto("imageDataUrl", file)}
        />
        {!member.image && (
          <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-od text-[10px] font-bold text-paper">
            !
          </span>
        )}
      </div>

      <input
        value={name}
        title={member.name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="mt-1.5 w-full border-b border-transparent bg-transparent pb-0.5 text-center text-sm font-semibold outline-none transition hover:border-line focus:border-ink"
      />

      <p className="mt-0.5 text-center text-[10px] text-faint">
        {member.hasPassword ? "claimed" : "unclaimed"}
      </p>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-1 w-full text-center text-[10px] text-faint underline hover:text-ink"
      >
        {open ? "hide" : "moods & more"}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-line p-2">
          <div className="flex justify-between gap-1">
            {MOODS.map((slot) => (
              <div key={slot.field} className="flex flex-col items-center gap-0.5">
                <FaceSlot
                  face={slot.pick(member)}
                  label={slot.label}
                  size="sm"
                  onPick={(file) => setPhoto(slot.field, file)}
                />
                {slot.mood ? (
                  <button
                    onClick={() => deriveMood(slot.mood as "happy" | "sad")}
                    disabled={!member.image || busy === slot.mood}
                    title={`derive the ${slot.label} photo from the normal one`}
                    className="text-[9px] text-faint underline disabled:opacity-40"
                  >
                    {busy === slot.mood ? "…" : "auto"}
                  </button>
                ) : (
                  <span className="text-[9px] text-faint">{slot.label}</span>
                )}
              </div>
            ))}
          </div>
          {member.hasPassword && (
            <button
              onClick={() => patch({ resetPassword: true }, "reset")}
              className="text-[10px] text-muted underline"
            >
              Reset password
            </button>
          )}
          <button
            onClick={async () => {
              setBusy("remove");
              try {
                await apiFetch(`/api/boards/${slug}/members/${member.id}`, { method: "DELETE" });
                onChange();
              } catch (err) {
                setError(err instanceof Error ? err.message : "wouldn't remove");
                setBusy(null);
              }
            }}
            className="text-[10px] text-od underline"
          >
            Remove from board
          </button>
        </div>
      )}

      {error && <p className="mt-1 text-center text-[10px] text-od">{error}</p>}
    </div>
  );
}
