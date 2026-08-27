"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import RaiseOdButton from "@/components/RaiseOdButton";
import IdentityPicker from "@/components/IdentityPicker";
import TugOfWar from "@/components/TugOfWar";
import { useBoard } from "@/lib/useBoard";
import { apiFetch } from "@/lib/api";
import { getIdentity, setIdentity } from "@/lib/identity";
import { isAdminUnlocked } from "@/lib/adminAuth";
import type { Member, OD } from "@/lib/types";

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 8000;

// Which end of the rope each vote puts you on. OD and Small OD pull the same
// way (Small OD at half strength, see components/TugOfWar.tsx); Reject pulls
// back. The buttons are laid out in that order so the choice reads as a
// position on the rope rather than a radio group.
const VOTE_CHOICES = [
  { value: "OD", label: "OD", blurb: "pull for guilty", tone: "od" },
  { value: "SMALL_OD", label: "Small OD", blurb: "half a pull", tone: "small" },
  { value: "REJECT", label: "Reject", blurb: "pull it back", tone: "clear" },
] as const;

const TONE_CLASS: Record<string, { on: string; off: string }> = {
  od: { on: "border-od bg-od text-paper", off: "border-line text-od hover:border-od" },
  small: { on: "border-small bg-small text-paper", off: "border-line text-small hover:border-small" },
  clear: { on: "border-clear bg-clear text-paper", off: "border-line text-clear hover:border-clear" },
};

function closesIn(closesAt: string): string {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "closing now";
  const hours = Math.floor(ms / 3600000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}

export default function RaisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { board } = useBoard(slug);
  const [allOds, setAllOds] = useState<OD[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [picking, setPicking] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [copied, setCopied] = useState(false);

  const openOds = allOds.filter((od) => od.status === "PENDING");
  const closedOds = allOds.filter((od) => od.status === "CLOSED").slice(0, 10);
  // Cases this member hasn't voted on yet (and isn't the accused in) — must
  // clear these before raising a new one, same rule the server enforces.
  const pendingVotesForMe = openOds.filter(
    (od) =>
      memberId &&
      od.accusedId !== memberId &&
      !od.votes.some((v) => v.memberId === memberId)
  );
  const locked = !!memberId && pendingVotesForMe.length > 0;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const existing = getIdentity(slug);
      if (existing) {
        setMemberId(existing);
        setIdentityChecked(true);
        return;
      }

      // An admin is already a member of their own board — if this browser
      // already proved admin access, resolve straight to that membership
      // instead of asking for a join code/password too.
      if (isAdminUnlocked(slug)) {
        try {
          const { memberId } = await apiFetch<{ memberId: string }>(
            `/api/boards/${slug}/admin/self`,
            { method: "POST" }
          );
          if (!cancelled) {
            setIdentity(slug, memberId);
            setMemberId(memberId);
            setIdentityChecked(true);
            return;
          }
        } catch {
          // Not linked to a member (older board) — fall through to the
          // normal locked flow below.
        }
      }
      if (cancelled) return;
      setIdentityChecked(true);

      // Arriving via a share/invite link (?code=...) skips straight to the
      // name picker with the join code pre-filled — no separate "Join with
      // code" click needed.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        setInviteCode(code);
        setPicking(true);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Live feed: one request in flight at a time, with a hard timeout — see
  // the same fix on the home/display page for why that matters. The
  // leaderboard itself isn't shown here — that's the board's home page.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
      try {
        const ods = await apiFetch<OD[]>(`/api/boards/${slug}/ods`, { signal: controller.signal });
        if (stopped) return;
        setStale(false);
        setAllOds(ods);
      } catch {
        if (!stopped) setStale(true);
      } finally {
        clearTimeout(abortTimer);
        if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [slug]);

  async function vote(odId: string, choice: string) {
    if (!memberId) return;
    setVoting(odId);
    setMessage(null);
    try {
      await apiFetch(`/api/ods/${odId}/vote`, {
        method: "POST",
        body: JSON.stringify({ memberId, vote: choice }),
      });
      setAllOds(await apiFetch<OD[]>(`/api/boards/${slug}/ods`));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setVoting(null);
    }
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/${slug}` : "";

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  // Raising and voting are for board members only — anyone with the link
  // can see the leaderboard/display, but this tab stays locked until
  // they log in with the join code.
  if (identityChecked && !memberId) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 px-5 py-20 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-od">
          Members only
        </span>
        <h1 className="display text-4xl leading-none">Odicho ningale?</h1>
        <p className="text-sm leading-relaxed text-muted">
          Raising and voting is for people on this board. Watching the race is open to anyone.
        </p>
        <button
          onClick={() => setPicking(true)}
          className="mt-3 w-full rounded-xl bg-ink px-5 py-3.5 font-semibold text-paper transition hover:bg-od"
        >
          Sign in with the join code
        </button>
        <Link
          href={`/${slug}`}
          className="mt-1 text-sm text-muted underline decoration-line hover:text-ink"
        >
          Just show me the leaderboard
        </Link>
        <p className="mt-10 w-full border-t border-line pt-5 text-sm text-muted">
          Not on this board?{" "}
          <Link href="/" className="font-medium text-ink underline decoration-line">
            Start one for your own circle
          </Link>
        </p>
        {picking && board && (
          <IdentityPicker
            slug={slug}
            members={board.members}
            initialCode={inviteCode ?? undefined}
            onPicked={(id) => {
              setMemberId(id);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
            canClose
          />
        )}
      </main>
    );
  }

  const members: Member[] = board?.members ?? [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-6 sm:px-6 sm:py-10">
      {/* Open ropes first: an unvoted case is the one thing that blocks
          everything else, so it can't be below the fold. */}
      <section>
        <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
          <h2 className="display text-xl leading-none">
            Ropes in play
            {openOds.length > 0 && (
              <span className="ml-2 font-mono text-sm text-faint">{openOds.length}</span>
            )}
          </h2>
          {stale && <p className="font-mono text-[11px] text-faint">reconnecting…</p>}
        </div>

        {message && <p className="mt-3 text-sm text-od">{message}</p>}

        {openOds.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-faint">
            No open cases. All quiet on the chathi front.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-5">
            {openOds.map((od) => (
              <CaseCard
                key={od.id}
                od={od}
                members={members}
                memberId={memberId}
                busy={voting === od.id}
                onVote={(choice) => vote(od.id, choice)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Raise. Locked while this member still owes a verdict — visible, so
          the reason is obvious, instead of the button simply not being there. */}
      <section>
        {locked && (
          <p className="mb-4 rounded-xl border border-od bg-od-soft px-4 py-3 text-sm leading-relaxed text-od">
            You owe {pendingVotesForMe.length} verdict
            {pendingVotesForMe.length === 1 ? "" : "s"}. Pull on those ropes above and this
            unlocks.
          </p>
        )}
        {board && (
          <div className={locked ? "pointer-events-none opacity-35 saturate-0" : ""}>
            <RaiseOdButton
              slug={slug}
              board={board}
              memberId={memberId}
              onRaised={() => {
                setMessage(null);
                apiFetch<OD[]>(`/api/boards/${slug}/ods`).then(setAllOds);
              }}
            />
          </div>
        )}
        {board && board.members.length < 2 && (
          <p className="mt-4 text-center text-sm text-muted">
            Only one head in the tub.{" "}
            <Link href={`/${slug}/admin`} className="underline decoration-line">
              Throw more faces in
            </Link>{" "}
            — you can&rsquo;t accuse yourself.
          </p>
        )}
      </section>

      {/* Settled cases, compact — the record, not the action. */}
      {closedOds.length > 0 && (
        <section>
          <h2 className="border-b border-line pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            Settled
          </h2>
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {closedOds.map((od) => {
              const guilty = (od.finalScore ?? 0) > 0;
              return (
                <li key={od.id} className="flex items-baseline gap-3 py-2.5 text-sm">
                  <span className="font-semibold">{od.accused.name}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{od.description}</span>
                  <span
                    className={`shrink-0 font-mono text-xs font-bold ${guilty ? "text-od" : "text-clear"}`}
                  >
                    {guilty ? `+${od.finalScore}` : "cleared"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Board link
          </p>
          <p className="truncate font-mono text-xs text-faint">{shareUrl}</p>
        </div>
        <button
          onClick={copyShareUrl}
          className="ml-auto shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold transition hover:border-ink"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </section>
    </main>
  );
}

function CaseCard({
  od,
  members,
  memberId,
  busy,
  onVote,
}: {
  od: OD;
  members: Member[];
  memberId: string | null;
  busy: boolean;
  onVote: (choice: string) => void;
}) {
  const myVote = od.votes.find((v) => v.memberId === memberId);
  const isAccused = memberId === od.accusedId;
  const canVote = !!memberId && !isAccused;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-surface ${
        canVote && !myVote ? "border-2 border-ink" : "border-line"
      }`}
    >
      <div className="flex items-start gap-3 px-5 pt-4">
        {od.accused.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={od.accused.image} alt="" className="h-10 w-10 shrink-0 object-contain" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-bold">
            {od.accused.name[0]?.toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
            {od.accused.name}
            <span className="font-normal text-faint">{od.category.name}</span>
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{od.description}</p>
          <p className="mt-1.5 font-mono text-[11px] text-faint">
            raised by {od.raisedBy.name} · {closesIn(od.closesAt)}
          </p>
        </div>
      </div>

      {od.evidence && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={od.evidence}
          alt="Evidence"
          className="mt-3 max-h-56 w-full border-y border-line object-cover"
        />
      )}

      <div className="px-4 pt-3">
        <TugOfWar votes={od.votes} members={members} />
      </div>

      {isAccused ? (
        <p className="border-t border-line px-5 py-3 text-center font-mono text-xs text-faint">
          your rope — you don&rsquo;t get a pull
        </p>
      ) : canVote ? (
        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line p-3">
          {VOTE_CHOICES.map((choice) => {
            const active = myVote?.vote === choice.value;
            const tone = TONE_CLASS[choice.tone];
            return (
              <button
                key={choice.value}
                disabled={busy}
                onClick={() => onVote(choice.value)}
                className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-2.5 transition disabled:opacity-50 ${
                  active ? tone.on : tone.off
                }`}
              >
                <span className="text-sm font-bold leading-none">{choice.label}</span>
                <span className={`text-[10px] leading-tight ${active ? "opacity-80" : "text-faint"}`}>
                  {choice.blurb}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="border-t border-line px-5 py-3 text-center font-mono text-xs text-faint">
          sign in to pull
        </p>
      )}
    </article>
  );
}
