"use client";

import { use, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import RaceLeaderboard from "@/components/RaceLeaderboard";
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

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-white p-3 sm:p-8">
      {stale && (
        <p className="absolute top-2 right-3 text-xs text-zinc-400">Reconnecting…</p>
      )}
      {loading ? (
        <p className="text-sm text-zinc-400">Loading leaderboard…</p>
      ) : (
        <div className="w-full max-w-4xl px-3 sm:px-0">
          <RaceLeaderboard
            entries={leaderboard}
            onSelectMember={setSelectedMember}
            photoFor={photoFor}
            flashFor={(id) => flashes[id] ?? null}
          />
        </div>
      )}

      {/* The leaderboard above stays visible the whole time — these are
          overlays, not full-screen takeovers, so the race never disappears.
          Closing (auto, on a timer) is what reveals the score bump/animation
          underneath. */}
      {screen === "detected" && activeOd && (
        <EventModal onClose={() => setScreen("leaderboard")}>
          <Detected od={activeOd} />
        </EventModal>
      )}
      {screen === "pending" && activeOd && (
        <EventModal onClose={() => setScreen("leaderboard")}>
          <PendingCase od={activeOd} />
        </EventModal>
      )}
      {screen === "verdict" && activeOd && (
        <EventModal onClose={() => setScreen("leaderboard")}>
          <Verdict od={activeOd} />
        </EventModal>
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

function EventModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100"
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
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-xl">🚨</p>
      <h1 className="text-2xl font-black tracking-tight">OD DETECTED</h1>
      <p className="text-lg font-bold">{od.accused.name}</p>
    </div>
  );
}

function PendingCase({ od }: { od: OdWithAsset }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        OD Under Investigation
      </p>
      <h1 className="text-xl font-black">{od.accused.name}</h1>
      <p className="text-sm text-zinc-700">{od.description}</p>
      {od.asset?.file && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={od.asset.file} alt="" className="max-h-48 rounded-md" />
      )}
      {od.asset?.dialogue && (
        <p className="text-sm italic text-zinc-500">&ldquo;{od.asset.dialogue}&rdquo;</p>
      )}
      <p className="text-xs text-zinc-500">
        {od.votes.length} vote{od.votes.length === 1 ? "" : "s"} received · raised by {od.raisedBy.name}
      </p>
    </div>
  );
}

function Verdict({ od }: { od: OdWithAsset }) {
  const counts = { OD: 0, SMALL_OD: 0, REJECT: 0 } as Record<string, number>;
  for (const v of od.votes) counts[v.vote] = (counts[v.vote] ?? 0) + 1;
  const guilty = (od.finalScore ?? 0) > 0;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">OD Court</p>
      <h1 className="text-xl font-black">{od.accused.name}</h1>
      <p className="text-sm text-zinc-600">{od.description}</p>
      {od.asset?.file && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={od.asset.file} alt="" className="max-h-48 rounded-md" />
      )}
      {od.asset?.dialogue && (
        <p className="text-sm italic text-zinc-500">&ldquo;{od.asset.dialogue}&rdquo;</p>
      )}
      <p className="text-xs text-zinc-500">
        {Object.entries(counts)
          .filter(([, c]) => c > 0)
          .map(([k, c]) => `${c} ${VOTE_LABEL[k]}`)
          .join(" · ") || "No votes"}
      </p>
      <p className="text-2xl font-black">{guilty ? "GUILTY" : "NOT AN OD"}</p>
      <p className="text-lg font-bold">+{od.finalScore ?? 0} OD</p>
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{member.name}&rsquo;s closed ODs</h2>
          <button onClick={onClose} className="text-sm text-zinc-500">
            Close
          </button>
        </div>

        {ods === null && <p className="mt-4 text-sm text-zinc-500">Loading...</p>}
        {ods && ods.length === 0 && (
          <p className="mt-4 text-sm text-zinc-500">No closed ODs yet.</p>
        )}
        {ods && ods.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {ods.map((od) => (
              <li key={od.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{od.category.name}</span>
                  <span className="font-mono text-zinc-500">+{od.finalScore ?? 0}</span>
                </div>
                <p className="mt-1 text-zinc-600">{od.description}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Raised by {od.raisedBy.name} &middot;{" "}
                  {new Date(od.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
