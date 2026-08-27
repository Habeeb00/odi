"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, fileToDataUrl } from "@/lib/api";
import type { Board, Member, OD } from "@/lib/types";

const ITEM_WIDTH = 96;

export default function RaiseOdButton({
  slug,
  board,
  memberId,
  onRaised,
}: {
  slug: string;
  board: Board;
  memberId: string | null;
  onRaised: (od: OD) => void;
}) {
  const candidates = board.members.filter((m) => m.id !== memberId);
  const [accusedId, setAccusedId] = useState<string | null>(candidates[0]?.id ?? null);
  const [pressed, setPressed] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pickClosest() {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest: string | null = null;
    let closestDist = Infinity;
    for (const m of candidates) {
      const el = itemRefs.current[m.id];
      if (!el) continue;
      const itemCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(itemCenter - center);
      if (dist < closestDist) {
        closestDist = dist;
        closest = m.id;
      }
    }
    if (closest) setAccusedId(closest);
  }

  function onScroll() {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(pickClosest, 60);
  }

  function scrollToMember(id: string) {
    const track = trackRef.current;
    const el = itemRefs.current[id];
    if (!track || !el) return;
    track.scrollTo({
      left: el.offsetLeft + el.offsetWidth / 2 - track.clientWidth / 2,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    if (accusedId) scrollToMember(accusedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accused = candidates.find((m) => m.id === accusedId) ?? null;

  function press() {
    if (!memberId) {
      setError("Sign in first — the button in the top right.");
      return;
    }
    if (!accusedId) {
      setError("Pick who did it first.");
      return;
    }
    setError(null);
    setPressed(true);
    setTimeout(() => {
      setPressed(false);
      setTimeout(() => setOpen(true), 180);
    }, 180);
  }

  return (
    <div className="flex w-full flex-col items-center gap-5 rounded-3xl border border-line bg-surface px-4 py-8 sm:px-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          Step one
        </span>
        <p className="display text-2xl leading-none">Who did it?</p>
      </div>

      <div className="relative w-full max-w-md">
        {/* Fades the faces off both edges so the strip reads as scrollable. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-surface to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-surface to-transparent" />
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth py-3"
          style={{
            paddingInline: `calc(50% - ${ITEM_WIDTH / 2}px)`,
          }}
        >
          {candidates.map((m) => (
            <button
              key={m.id}
              type="button"
              ref={(el) => {
                itemRefs.current[m.id] = el;
              }}
              onClick={() => {
                setAccusedId(m.id);
                scrollToMember(m.id);
              }}
              title={m.name}
              className="flex shrink-0 snap-center flex-col items-center gap-2"
              style={{ width: ITEM_WIDTH }}
            >
              <span
                className={`flex h-20 w-20 items-center justify-center transition ${
                  accusedId === m.id ? "scale-110" : "opacity-40"
                }`}
              >
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image}
                    alt={m.name}
                    className={`h-20 w-20 object-contain transition ${
                      accusedId === m.id ? "drop-shadow-[0_6px_10px_rgba(216,31,42,0.35)]" : ""
                    }`}
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-paper text-2xl font-black">
                    {m.name[0]?.toUpperCase()}
                  </span>
                )}
              </span>
              <span
                className={`max-w-[90px] truncate text-xs ${
                  accusedId === m.id ? "font-bold text-ink" : "text-faint"
                }`}
              >
                {m.name}
              </span>
            </button>
          ))}
          {candidates.length === 0 && (
            <p className="text-sm text-muted">No one else on this board yet.</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={press}
        aria-label={accused ? `Raise an OD on ${accused.name}` : "Raise an OD"}
        className="group flex flex-col items-center gap-3"
      >
        <span className="relative block h-[220px] w-[223px] sm:h-[320px] sm:w-[323px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/button/button-up.svg"
            alt=""
            className={`absolute inset-0 h-full w-full transition-opacity duration-100 ${
              pressed ? "opacity-0" : "opacity-100"
            }`}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/button/button-down.svg"
            alt=""
            className={`absolute bottom-0 h-[190px] w-full transition-opacity duration-100 sm:h-[276px] ${
              pressed ? "opacity-100" : "opacity-0"
            }`}
          />
          {accused && (
            <span
              className={`absolute left-1/2 top-[32%] flex h-28 w-28 -translate-x-1/2 items-center justify-center transition-transform duration-100 sm:h-44 sm:w-44 [--press-shift:30px] sm:[--press-shift:44px] ${
                pressed ? "translate-y-[calc(-50%+var(--press-shift))] scale-95" : "-translate-y-1/2"
              }`}
            >
              {accused.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={accused.image}
                  alt={accused.name}
                  className="h-28 w-28 object-contain drop-shadow-[0_10px_16px_rgba(20,17,15,0.35)] sm:h-44 sm:w-44"
                />
              ) : (
                <span className="text-4xl font-black text-paper drop-shadow-[0_4px_6px_rgba(20,17,15,0.4)] sm:text-6xl">
                  {accused.name[0]?.toUpperCase()}
                </span>
              )}
            </span>
          )}
        </span>
        <span className="display text-xl leading-none transition group-hover:text-od sm:text-2xl">
          Raise an OD{accused ? ` on ${accused.name}` : ""}
        </span>
      </button>

      {error && <p className="text-sm text-od">{error}</p>}

      {open && accused && (
        <RaiseOdModal
          slug={slug}
          board={board}
          memberId={memberId as string}
          accused={accused}
          onClose={() => setOpen(false)}
          onRaised={(od) => {
            setOpen(false);
            onRaised(od);
          }}
        />
      )}
    </div>
  );
}

function RaiseOdModal({
  slug,
  board,
  memberId,
  accused,
  onClose,
  onRaised,
}: {
  slug: string;
  board: Board;
  memberId: string;
  accused: Member;
  onClose: () => void;
  onRaised: (od: OD) => void;
}) {
  const [categoryId, setCategoryId] = useState(board.categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function pickEvidence(file: File | null) {
    if (evidencePreview) URL.revokeObjectURL(evidencePreview);
    setEvidence(file);
    setEvidencePreview(file ? URL.createObjectURL(file) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const evidenceDataUrl = evidence ? await fileToDataUrl(evidence) : undefined;
      const od = await apiFetch<OD>(`/api/boards/${slug}/ods`, {
        method: "POST",
        body: JSON.stringify({
          raisedById: memberId,
          accusedId: accused.id,
          categoryId,
          description,
          evidenceDataUrl,
        }),
      });
      onRaised(od);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to raise OD");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md animate-[rise-in_0.25s_ease-out] flex-col overflow-hidden rounded-2xl bg-surface text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line p-5">
          {accused.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={accused.image} alt="" className="h-11 w-11 shrink-0 object-contain" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper font-bold">
              {accused.name[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="display truncate text-xl leading-none">OD on {accused.name}</h2>
            <p className="mt-1 text-xs text-muted">The group decides if it counts.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg text-faint hover:bg-paper hover:text-ink"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Category
            </legend>
            <div className="flex flex-wrap gap-2">
              {board.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    categoryId === c.id
                      ? "border-ink bg-ink text-paper"
                      : "border-line hover:border-ink"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              What happened?
            </span>
            <textarea
              required
              autoFocus
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none rounded-xl border border-line bg-transparent px-3.5 py-3 text-sm leading-relaxed outline-none transition placeholder:text-faint focus:border-ink"
              placeholder="Went for a movie without inviting us."
            />
          </label>

          <label className="flex cursor-pointer flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Evidence <span className="font-normal normal-case tracking-normal">(optional)</span>
            </span>
            {evidencePreview ? (
              <span className="relative block overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={evidencePreview} alt="" className="max-h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    pickEvidence(null);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-semibold text-paper"
                >
                  Remove
                </button>
              </span>
            ) : (
              <span className="rounded-xl border border-dashed border-line px-3.5 py-5 text-center text-sm text-faint transition hover:border-ink hover:text-muted">
                Add a screenshot
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickEvidence(e.target.files?.[0] ?? null)}
            />
          </label>

          {error && <p className="text-sm text-od">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-od px-4 py-3.5 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"
          >
            {submitting ? "Filing…" : "File the OD"}
          </button>
        </form>
      </div>
    </div>
  );
}
