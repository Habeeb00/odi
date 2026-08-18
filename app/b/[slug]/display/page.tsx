"use client";

import { use, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-10 dark:bg-black">
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
    <div className="w-full max-w-4xl">
      <h1 className="text-center text-5xl font-black tracking-tight">{boardName}</h1>
      {pendingCount > 0 && (
        <p className="mt-2 text-center text-sm text-zinc-500">
          {pendingCount} case{pendingCount === 1 ? "" : "s"} under investigation
        </p>
      )}
      <div className="mt-12 flex flex-col gap-6">
        {entries.map((m, i) => (
          <div key={m.id} className="flex items-center gap-6">
            <span className="w-10 text-right text-3xl font-black text-zinc-300 dark:text-zinc-700">
              {i + 1}
            </span>
            {m.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image} alt={m.name} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-2xl font-bold dark:bg-zinc-800">
                {m.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">{m.name}</span>
                <span className="font-mono text-2xl">{m.score}</span>
              </div>
              <div className="mt-2 h-4 w-full rounded-full bg-zinc-100 dark:bg-zinc-900">
                <div
                  className="h-4 rounded-full bg-black transition-all duration-1000 ease-out dark:bg-white"
                  style={{ width: `${(Math.max(m.score, 0) / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
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
      <h1 className="text-6xl font-black tracking-tight">OD DETECTED</h1>
      <p className="text-3xl font-bold">{od.accused.name}</p>
    </div>
  );
}

function PendingCase({ od }: { od: OdWithAsset }) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
        OD Under Investigation
      </p>
      <h1 className="text-4xl font-black">{od.accused.name}</h1>
      <p className="text-xl text-zinc-700 dark:text-zinc-300">{od.description}</p>
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
      <h1 className="text-4xl font-black">{od.accused.name}</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">{od.description}</p>
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
      <p className="text-6xl font-black">{guilty ? "GUILTY" : "NOT AN OD"}</p>
      <p className="text-3xl font-bold">+{od.finalScore ?? 0} OD</p>
    </div>
  );
}
