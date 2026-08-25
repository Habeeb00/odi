"use client";

import { use, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import CyclingAvatar from "@/components/CyclingAvatar";
import type { LeaderboardEntry, OD, Asset } from "@/lib/types";

type OdWithAsset = OD & { asset: Asset | null };

type StateResponse = {
  board: { name: string };
  leaderboard: LeaderboardEntry[];
  pendingCount: number;
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
  const [pendingCount, setPendingCount] = useState(0);
  const [screen, setScreen] = useState<Screen>("leaderboard");
  const [activeOd, setActiveOd] = useState<OdWithAsset | null>(null);
  const [stale, setStale] = useState(false);
  const [selectedMember, setSelectedMember] = useState<LeaderboardEntry | null>(null);

  const seenRaisedId = useRef<string | null | undefined>(undefined);
  const seenClosedId = useRef<string | null | undefined>(undefined);
  const animating = useRef(false);
  const idleCycles = useRef(0);

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
        setPendingCount(data.pendingCount);

        const firstLoad = seenRaisedId.current === undefined;
        if (firstLoad) {
          seenRaisedId.current = data.latestRaised?.id ?? null;
          seenClosedId.current = data.latestClosed?.id ?? null;
          setLeaderboard(data.leaderboard);
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
          setLeaderboard(data.leaderboard);
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
          setLeaderboard(nextLeaderboard);
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
        setLeaderboard(nextLeaderboard);
        animating.current = false;
      }, 6000);
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [slug]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-white p-4 sm:p-10">
      {stale && (
        <p className="absolute top-2 right-3 text-xs text-zinc-400">Reconnecting…</p>
      )}
      {screen === "leaderboard" && (
        <Leaderboard entries={leaderboard} onSelectMember={setSelectedMember} />
      )}
      {screen === "detected" && activeOd && <Detected od={activeOd} />}
      {screen === "pending" && activeOd && <PendingCase od={activeOd} />}
      {screen === "verdict" && activeOd && <Verdict od={activeOd} />}

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

// Scores usually stay within a 0-100 range; once someone breaks 100 the
// whole board "unlocks" a wider 0-500 range so bars don't all pin at 100%.
function scoreRange(entries: LeaderboardEntry[]): number {
  const actualMax = Math.max(0, ...entries.map((e) => e.score));
  return actualMax > 100 ? 500 : 100;
}

function Leaderboard({
  entries,
  onSelectMember,
}: {
  entries: LeaderboardEntry[];
  onSelectMember: (member: LeaderboardEntry) => void;
}) {
  const range = scoreRange(entries);
  return (
    <div className="w-full max-w-4xl px-4 sm:px-0">
      <div className="flex flex-col gap-8 sm:gap-12">
        {entries.map((m) => {
          const pct = Math.min(100, (Math.max(m.score, 0) / range) * 100);
          return (
            <button
              key={m.id}
              onClick={() => onSelectMember(m)}
              className="relative h-1.5 w-full rounded-full bg-zinc-200 [--avatar:44px] sm:[--avatar:72px]"
            >
              <div
                className="h-1.5 rounded-full bg-red-600 transition-all duration-1000 ease-out"
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute top-1/2 h-[var(--avatar)] w-[var(--avatar)] -translate-y-1/2 transition-all duration-1000 ease-out"
                style={{
                  left: `clamp(0px, calc(${pct}% - var(--avatar) / 2), calc(100% - var(--avatar)))`,
                }}
              >
                <CyclingAvatar
                  images={[m.image, m.imageHappy, m.imageSad]}
                  alt={m.name}
                  className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
                  fallback={
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-200 text-lg font-bold sm:text-2xl">
                      {m.name[0]?.toUpperCase()}
                    </div>
                  }
                />
              </div>
            </button>
          );
        })}
        {entries.length === 0 && (
          <p className="text-center text-zinc-500">No members yet.</p>
        )}
      </div>
    </div>
  );
}

function Detected({ od }: { od: OdWithAsset }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-2xl font-semibold text-zinc-500">🚨</p>
      <h1 className="text-4xl font-black tracking-tight sm:text-6xl">OD DETECTED</h1>
      <p className="text-2xl font-bold sm:text-3xl">{od.accused.name}</p>
    </div>
  );
}

function PendingCase({ od }: { od: OdWithAsset }) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
        OD Under Investigation
      </p>
      <h1 className="text-2xl font-black sm:text-4xl">{od.accused.name}</h1>
      <p className="text-lg text-zinc-700 sm:text-xl">{od.description}</p>
      {od.asset?.file && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={od.asset.file} alt="" className="max-h-72 rounded-md" />
      )}
      {od.asset?.dialogue && (
        <p className="text-lg italic text-zinc-500">&ldquo;{od.asset.dialogue}&rdquo;</p>
      )}
      <p className="text-sm text-zinc-500">
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
    <div className="flex w-full max-w-2xl flex-col items-center gap-5 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">OD Court</p>
      <h1 className="text-2xl font-black sm:text-4xl">{od.accused.name}</h1>
      <p className="text-base text-zinc-600 sm:text-lg">{od.description}</p>
      {od.asset?.file && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={od.asset.file} alt="" className="max-h-72 rounded-md" />
      )}
      {od.asset?.dialogue && (
        <p className="text-lg italic text-zinc-500">&ldquo;{od.asset.dialogue}&rdquo;</p>
      )}
      <p className="text-sm text-zinc-500">
        {Object.entries(counts)
          .filter(([, c]) => c > 0)
          .map(([k, c]) => `${c} ${VOTE_LABEL[k]}`)
          .join(" · ") || "No votes"}
      </p>
      <p className="text-4xl font-black sm:text-6xl">{guilty ? "GUILTY" : "NOT AN OD"}</p>
      <p className="text-2xl font-bold sm:text-3xl">+{od.finalScore ?? 0} OD</p>
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
