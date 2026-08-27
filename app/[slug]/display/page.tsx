"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import RaceLeaderboard from "@/components/RaceLeaderboard";
import TugOfWar from "@/components/TugOfWar";
import { HeadPile } from "@/components/HeadPile";
import type { LeaderboardEntry, OD, Asset } from "@/lib/types";

type OdWithAsset = OD & { asset: Asset | null };

type StateResponse = {
  board: { name: string };
  leaderboard: LeaderboardEntry[];
  pendingCount: number;
  pendingOds: { accusedId: string; raisedById: string }[];
  latestRaised: OdWithAsset | null;
  latestClosed: OdWithAsset | null;
};

type Screen = "leaderboard" | "detected" | "pending" | "verdict";

const VOTE_LABEL: Record<string, string> = { OD: "OD", SMALL_OD: "Small OD", REJECT: "Reject" };

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 8000;

export default function DisplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [pendingOds, setPendingOds] = useState<{ accusedId: string; raisedById: string }[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [screen, setScreen] = useState<Screen>("leaderboard");
  const [activeOd, setActiveOd] = useState<OdWithAsset | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<LeaderboardEntry | null>(null);
  const [flashes, setFlashes] = useState<Record<string, number>>({});

  const seenRaisedId = useRef<string | null | undefined>(undefined);
  const seenClosedId = useRef<string | null | undefined>(undefined);
  const animating = useRef(false);
  const idleCycles = useRef(0);
  const lastScores = useRef<Map<string, number>>(new Map());

  // Live scores move as votes land (see lib/od.ts getLeaderboard), so a
  // score going up here doesn't necessarily mean a case closed — flash a
  // "+N XP" popup on whoever's total just increased, closed or not.
  function applyLeaderboard(entries: LeaderboardEntry[]) {
    const bumped: Record<string, number> = {};
    for (const m of entries) {
      const prev = lastScores.current.get(m.id);
      if (prev !== undefined && m.score > prev) bumped[m.id] = m.score - prev;
      lastScores.current.set(m.id, m.score);
    }
    if (Object.keys(bumped).length > 0) {
      setFlashes(bumped);
      setTimeout(() => setFlashes({}), 1800);
    }
    setLeaderboard(entries);
  }

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // One request in flight at a time, with a hard timeout — a slow/hung
    // request used to overlap with the next 4s tick, piling up concurrent
    // requests against the DB's connection limit until every poll stalled.
    async function poll() {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
      try {
        const data = await apiFetch<StateResponse>(`/api/boards/${slug}/state`, {
          signal: controller.signal,
        });
        if (stopped) return;
        setStale(false);
        setLoading(false);
        setBoardName(data.board.name);
        setPendingCount(data.pendingCount);
        setPendingOds(data.pendingOds);

        const firstLoad = seenRaisedId.current === undefined;
        if (firstLoad) {
          seenRaisedId.current = data.latestRaised?.id ?? null;
          seenClosedId.current = data.latestClosed?.id ?? null;
          applyLeaderboard(data.leaderboard);
          return;
        }

        if (animating.current) return;

        if (data.latestRaised && data.latestRaised.id !== seenRaisedId.current) {
          seenRaisedId.current = data.latestRaised.id;
          runRaiseSequence(data.latestRaised, data.leaderboard);
          return;
        }

        if (data.latestClosed && data.latestClosed.id !== seenClosedId.current) {
          seenClosedId.current = data.latestClosed.id;
          runVerdictSequence(data.latestClosed, data.leaderboard);
          return;
        }

        // Nothing new — occasionally resurface a pending case (section 17).
        idleCycles.current += 1;
        if (data.pendingCount > 0 && idleCycles.current >= 6 && data.latestRaised) {
          idleCycles.current = 0;
          runPendingReminder(data.latestRaised);
        } else {
          applyLeaderboard(data.leaderboard);
        }
      } catch {
        if (!stopped) setStale(true);
      } finally {
        clearTimeout(abortTimer);
        if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    function runRaiseSequence(od: OdWithAsset, nextLeaderboard: LeaderboardEntry[]) {
      animating.current = true;
      setActiveOd(od);
      setScreen("detected");
      setTimeout(() => {
        setScreen("pending");
        setTimeout(() => {
          setScreen("leaderboard");
          applyLeaderboard(nextLeaderboard);
          animating.current = false;
        }, 6000);
      }, 2500);
    }

    function runPendingReminder(od: OdWithAsset) {
      animating.current = true;
      setActiveOd(od);
      setScreen("pending");
      setTimeout(() => {
        setScreen("leaderboard");
        animating.current = false;
      }, 5000);
    }

    function runVerdictSequence(od: OdWithAsset, nextLeaderboard: LeaderboardEntry[]) {
      animating.current = true;
      setActiveOd(od);
      setScreen("verdict");
      setTimeout(() => {
        setScreen("leaderboard");
        applyLeaderboard(nextLeaderboard);
        animating.current = false;
      }, 6000);
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [slug]);

  const cryingIds = new Set(pendingOds.map((od) => od.accusedId));
  const laughingIds = new Set(pendingOds.map((od) => od.raisedById));
  const topScore = Math.max(0, ...leaderboard.map((m) => m.score));

  function photoFor(m: LeaderboardEntry): string | null {
    // Live status wins over standing: getting judged right now shows up
    // immediately as crying, OD-ing someone right now shows up as laughing.
    if (cryingIds.has(m.id)) return m.imageSad ?? m.image;
    if (laughingIds.has(m.id)) return m.imageHappy ?? m.image;
    if (m.score > 0 && m.score === topScore) return m.imageHappy ?? m.image;
    return m.image;
  }

  const settled = leaderboard.some((m) => m.score !== 0);
  const totalOd = leaderboard.reduce((sum, m) => sum + Math.max(0, m.score), 0);

  return (
    <main className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex items-center gap-3 sm:mb-10">
        <div className="min-w-0">
          <h1 className="display text-3xl leading-none sm:text-4xl">The race</h1>
          <p className="mt-1.5 text-xs text-muted">
            {pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-[siren_1.6s_ease-in-out_infinite] rounded-full bg-od" />
                {pendingCount} case{pendingCount === 1 ? "" : "s"} under investigation
              </span>
            ) : settled ? (
              "All quiet. No open cases."
            ) : (
              "Nobody has an OD yet. Somebody has to go first."
            )}
          </p>
        </div>
        <Link
          href={`/${slug}/raise`}
          className="ml-auto shrink-0 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-od"
        >
          Raise an OD
        </Link>
      </div>

      {stale && (
        <p className="absolute right-4 top-2 text-[11px] text-faint sm:right-6">Reconnecting…</p>
      )}

      {loading ? (
        <div className="flex flex-col gap-9">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="mb-2 h-3 w-24 rounded bg-line" />
              <div className="h-1.5 w-full rounded-full bg-line" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <RaceLeaderboard
            entries={leaderboard}
            onSelectMember={setSelectedMember}
            photoFor={photoFor}
            flashFor={(id) => flashes[id] ?? null}
          />
          {leaderboard.length > 0 && (
            <p className="mt-10 text-center text-xs text-faint">
              Tap anyone to read their record.
            </p>
          )}

          {/* The tub sits under the race: the standings are what people came
              for, this is the group portrait they scroll down to. Same drawing
              as this board's card on /boards. */}
          {leaderboard.length > 0 && (
            <section className="mt-14 border-t border-line pt-10">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
                The tub
              </h2>
              <div className="mx-auto mt-4 max-w-xl px-2">
                <HeadPile heads={leaderboard} />
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t-2 border-ink pt-2">
                <p className="font-mono text-sm font-bold">{boardName ?? "This board"}</p>
                <p className="font-mono text-xs text-muted">
                  {leaderboard.length} in the tub · {totalOd} OD on record
                </p>
                <Link
                  href="/boards"
                  className="ml-auto font-mono text-xs text-faint underline hover:text-ink"
                >
                  the rack →
                </Link>
              </div>
            </section>
          )}
        </>
      )}

      {/* The leaderboard above stays visible and interactive the whole
          time — these are toast notifications, not modals: no backdrop, no
          click-catcher, nothing blocks the screen. Closing (auto, on a
          timer, or by hand) is what reveals the score bump/animation
          underneath. */}
      {screen === "detected" && activeOd && (
        <EventToast onClose={() => setScreen("leaderboard")}>
          <Detected od={activeOd} />
        </EventToast>
      )}
      {screen === "pending" && activeOd && (
        <EventToast onClose={() => setScreen("leaderboard")}>
          <PendingCase od={activeOd} members={leaderboard} />
        </EventToast>
      )}
      {screen === "verdict" && activeOd && (
        <>
          <VerdictFaces od={activeOd} />
          <EventToast onClose={() => setScreen("leaderboard")}>
            <Verdict od={activeOd} members={leaderboard} />
          </EventToast>
        </>
      )}

      {selectedMember && (
        <MemberOdsModal
          slug={slug}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </main>
  );
}

// Rendered behind the verdict toast, flush to the bottom of the screen:
// the raiser's sad photo on one side, the accused's happy photo on the
// other — win or lose the case, raising it stung and getting away with
// it feels good.
function VerdictFaces({ od }: { od: OdWithAsset }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-between px-2 sm:px-10">
      <FaceCallout name={od.raisedBy.name} photo={od.raisedBy.imageSad ?? od.raisedBy.image} />
      <FaceCallout name={od.accused.name} photo={od.accused.imageHappy ?? od.accused.image} />
    </div>
  );
}

function FaceCallout({ name, photo }: { name: string; photo: string | null }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={name}
          className="h-24 w-24 object-contain drop-shadow-[0_4px_10px_rgba(20,17,15,0.3)] sm:h-40 sm:w-40"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-line text-2xl font-bold sm:h-40 sm:w-40 sm:text-4xl">
          {name[0]?.toUpperCase()}
        </div>
      )}
      <span className="text-xs font-semibold text-muted sm:text-sm">{name}</span>
    </div>
  );
}

function EventToast({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 sm:bottom-6">
      <div className="pointer-events-auto relative w-full max-w-sm animate-[toast-in-bottom_0.3s_ease-out] rounded-2xl border border-line bg-surface p-5 shadow-[0_8px_30px_rgba(20,17,15,0.14)]">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-base text-faint hover:bg-paper hover:text-ink"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function Detected({ od }: { od: OdWithAsset }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-od">
        <span className="h-1.5 w-1.5 animate-[siren_1.2s_ease-in-out_infinite] rounded-full bg-od" />
        OD detected
      </span>
      <p className="display text-3xl leading-none">{od.accused.name}</p>
      <p className="text-xs text-muted">Raised by {od.raisedBy.name}</p>
    </div>
  );
}

function PendingCase({ od, members }: { od: OdWithAsset; members: LeaderboardEntry[] }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Under investigation
      </span>
      <p className="display text-2xl leading-none">{od.accused.name}</p>
      <p className="text-sm leading-relaxed text-ink">{od.description}</p>
      {od.asset?.file && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={od.asset.file} alt="" className="max-h-32 max-w-full rounded-lg" />
      )}
      {od.asset?.dialogue && (
        <p className="text-sm italic text-muted">&ldquo;{od.asset.dialogue}&rdquo;</p>
      )}
      {/* Where the case actually stands: who's pulling, and how hard. */}
      <TugOfWar votes={od.votes} members={members} className="w-full" />
      <p className="text-xs text-faint">raised by {od.raisedBy.name}</p>
    </div>
  );
}

function Verdict({ od, members }: { od: OdWithAsset; members: LeaderboardEntry[] }) {
  const counts = { OD: 0, SMALL_OD: 0, REJECT: 0 } as Record<string, number>;
  for (const v of od.votes) counts[v.vote] = (counts[v.vote] ?? 0) + 1;
  const guilty = (od.finalScore ?? 0) > 0;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Verdict
      </span>
      <p className="display text-2xl leading-none">{od.accused.name}</p>
      <p className="text-sm leading-relaxed text-muted">{od.description}</p>
      {od.asset?.file && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={od.asset.file} alt="" className="max-h-32 max-w-full rounded-lg" />
      )}
      {od.asset?.dialogue && (
        <p className="text-sm italic text-muted">&ldquo;{od.asset.dialogue}&rdquo;</p>
      )}
      {/* Where the rope finished. */}
      <TugOfWar votes={od.votes} members={members} className="w-full" />
      <p className="text-xs text-faint">
        {Object.entries(counts)
          .filter(([, c]) => c > 0)
          .map(([k, c]) => `${c} ${VOTE_LABEL[k]}`)
          .join(" · ") || "No votes"}
      </p>
      <div className="mt-1 w-full border-t border-line pt-3">
        <p className={`display text-3xl leading-none ${guilty ? "text-od" : "text-clear"}`}>
          {guilty ? "Guilty" : "Not an OD"}
        </p>
        {guilty && (
          <p className="mt-1 font-mono text-sm font-bold tabular-nums">
            +{od.finalScore} to {od.accused.name}
          </p>
        )}
      </div>
    </div>
  );
}

function MemberOdsModal({
  slug,
  member,
  onClose,
}: {
  slug: string;
  member: LeaderboardEntry;
  onClose: () => void;
}) {
  const [ods, setOds] = useState<OD[] | null>(null);

  useEffect(() => {
    setOds(null);
    apiFetch<OD[]>(`/api/boards/${slug}/ods?status=CLOSED&accusedId=${member.id}`).then(setOds);
  }, [slug, member.id]);

  const convictions = ods?.filter((od) => (od.finalScore ?? 0) > 0).length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg animate-[rise-in_0.25s_ease-out] flex-col overflow-hidden rounded-2xl bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-line p-5">
          {member.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.image} alt="" className="h-11 w-11 shrink-0 object-contain" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper font-bold">
              {member.name[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="display truncate text-xl leading-none">{member.name}</h2>
            <p className="mt-1 text-xs text-muted">
              {member.score} OD · {convictions} conviction{convictions === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg text-faint hover:bg-paper hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {ods === null && <p className="text-sm text-faint">Pulling the record…</p>}
          {ods && ods.length === 0 && (
            <p className="text-sm text-muted">
              Clean sheet. Nothing has been proved against {member.name} yet.
            </p>
          )}
          {ods && ods.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {ods.map((od) => {
                const guilty = (od.finalScore ?? 0) > 0;
                return (
                  <li key={od.id} className="rounded-xl border border-line p-3.5 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{od.category.name}</span>
                      <span
                        className={`shrink-0 font-mono text-xs font-bold tabular-nums ${
                          guilty ? "text-od" : "text-clear"
                        }`}
                      >
                        {guilty ? `+${od.finalScore}` : "cleared"}
                      </span>
                    </div>
                    <p className="mt-1 leading-relaxed text-muted">{od.description}</p>
                    <p className="mt-1.5 text-xs text-faint">
                      Raised by {od.raisedBy.name} ·{" "}
                      {new Date(od.createdAt).toLocaleDateString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
