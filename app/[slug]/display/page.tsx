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

export default function DisplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [boardName, setBoardName] = useState("Oddy Board");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [screen, setScreen] = useState<Screen>("leaderboard");
  const [activeOd, setActiveOd] = useState<OdWithAsset | null>(null);

  const seenRaisedId = useRef<string | null | undefined>(undefined);
  const seenClosedId = useRef<string | null | undefined>(undefined);
  const animating = useRef(false);
  const idleCycles = useRef(0);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const data = await apiFetch<StateResponse>(`/api/boards/${slug}/state`);
        if (stopped) return;
        setBoardName(data.board.name);
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
        // display keeps trying on the next tick
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
    const interval = setInterval(poll, 4000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [slug]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-4 sm:p-10">
      {screen === "leaderboard" && <Leaderboard boardName={boardName} entries={leaderboard} pendingCount={pendingCount} />}
      {screen === "detected" && activeOd && <Detected od={activeOd} />}
      {screen === "pending" && activeOd && <PendingCase od={activeOd} />}
      {screen === "verdict" && activeOd && <Verdict od={activeOd} />}
    </main>
  );
}

function Leaderboard({
  boardName,
  entries,
  pendingCount,
}: {
  boardName: string;
  entries: LeaderboardEntry[];
  pendingCount: number;
}) {
  const max = Math.max(1, ...entries.map((e) => e.score));
  return (
    <div className="w-full max-w-4xl px-2 sm:px-0">
      <h1 className="text-center text-3xl font-black tracking-tight sm:text-5xl">{boardName}</h1>
      {pendingCount > 0 && (
        <p className="mt-2 text-center text-sm text-zinc-500">
          {pendingCount} case{pendingCount === 1 ? "" : "s"} under investigation
        </p>
      )}
      <div className="mt-6 flex flex-col gap-5 sm:mt-12 sm:gap-8">
        {entries.map((m, i) => {
          const pct = (Math.max(m.score, 0) / max) * 100;
          return (
            <div key={m.id} className="flex items-center gap-2 sm:gap-4">
              <span className="w-6 text-right text-lg font-black text-zinc-300 sm:w-8 sm:text-2xl">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
                  <span className="truncate text-base font-bold sm:text-xl">{m.name}</span>
                  <span className="shrink-0 font-mono text-base sm:text-xl">{m.score}</span>
                </div>
                <div className="relative h-3 w-full rounded-full bg-zinc-100 [--avatar:44px] sm:[--avatar:72px]">
                  <div
                    className="h-3 rounded-full bg-black transition-all duration-1000 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
                    style={{
                      left: `clamp(0px, calc(${pct}% - var(--avatar) / 2), calc(100% - var(--avatar)))`,
                    }}
                  >
                    <CyclingAvatar
                      images={[m.image, m.imageHappy, m.imageSad]}
                      alt={m.name}
                      className="h-[var(--avatar)] w-[var(--avatar)] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
                      fallback={
                        <div className="flex h-[var(--avatar)] w-[var(--avatar)] items-center justify-center rounded-full bg-zinc-200 text-lg font-bold sm:text-2xl">
                          {m.name[0]?.toUpperCase()}
                        </div>
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
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
