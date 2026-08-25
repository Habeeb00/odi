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
      setError("Pick who you are first (top right).");
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
    <div className="flex w-full flex-col items-center gap-6 rounded-3xl bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-lg font-bold">Who did it?</p>
        <p className="text-xs text-zinc-500">Scroll or tap a face to pick them</p>
      </div>

      <div className="relative w-full max-w-md">
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
              className="flex shrink-0 snap-center flex-col items-center gap-2"
              style={{ width: ITEM_WIDTH }}
            >
              <span
                className={`flex h-20 w-20 items-center justify-center transition ${
                  accusedId === m.id ? "scale-110" : "opacity-50"
                }`}
              >
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image}
                    alt={m.name}
                    className={`h-20 w-20 object-contain transition ${
                      accusedId === m.id ? "drop-shadow-[0_6px_10px_rgba(220,38,38,0.35)]" : ""
                    }`}
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-black text-zinc-700">
                    {m.name[0]?.toUpperCase()}
                  </span>
                )}
              </span>
              <span
                className={`max-w-[90px] truncate text-xs ${
                  accusedId === m.id ? "font-bold text-zinc-900" : "text-zinc-400"
                }`}
              >
                {m.name}
              </span>
            </button>
          ))}
          {candidates.length === 0 && (
            <p className="text-sm text-zinc-500">No one else on this board yet.</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={press}
        aria-label="Raise an OD"
        className="group mt-2 flex flex-col items-center gap-4"
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
                  className="h-28 w-28 object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.35)] sm:h-44 sm:w-44"
                />
              ) : (
                <span className="text-4xl font-black text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)] sm:text-6xl">
                  {accused.name[0]?.toUpperCase()}
                </span>
              )}
            </span>
          )}
        </span>
        <span className="text-base font-bold text-zinc-800 sm:text-lg">
          Raise an OD{accused ? ` on ${accused.name}` : ""}
        </span>
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">OD on {accused.name}</h2>
          <button onClick={onClose} className="text-sm text-zinc-500">
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Something happened. Let the group decide if it deserves one.
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Category</span>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
            >
              {board.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">What happened?</span>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
              placeholder="Went for a movie without inviting us."
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Evidence (optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEvidence(e.target.files?.[0] ?? null)}
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-md bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit OD"}
          </button>
        </form>
      </div>
    </div>
  );
}
