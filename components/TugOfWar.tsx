"use client";

import { layOutPile, type PileHead } from "@/lib/pile";

// A case is a rope, not a poll. Everyone who voted OD stands on the left and
// pulls; everyone who voted Reject stands on the right and pulls back. The
// knot's distance from the centre line is the case's standing, so an open
// case is a picture you can read across the room instead of three tallies.
//
// A Small OD vote pulls with the OD side, at half the strength.

export type TugVote = { memberId: string; vote: string };

const ROPE_Y = 27;
const GROUND_Y = 47;
const SHOULDER_Y = 31;
const KNOT_TRAVEL = 21;

export default function TugOfWar({
  votes,
  members,
  className = "",
}: {
  votes: TugVote[];
  // Any list the voters can be resolved against — the board's members, or a
  // leaderboard, anything carrying id/name/image.
  members: PileHead[];
  className?: string;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const resolve = (v: TugVote) => byId.get(v.memberId);

  const guilty = votes.filter((v) => v.vote === "OD" || v.vote === "SMALL_OD");
  const clear = votes.filter((v) => v.vote === "REJECT");
  const smallCount = votes.filter((v) => v.vote === "SMALL_OD").length;

  const guiltyPull = guilty.length - smallCount * 0.5;
  const clearPull = clear.length;
  const total = guiltyPull + clearPull;
  // Positive = the OD side is winning, so the knot travels left toward them.
  const pull = total > 0 ? (guiltyPull - clearPull) / total : 0;
  const knotX = 50 - pull * KNOT_TRAVEL;

  const guiltyHeads = guilty.map(resolve).filter(Boolean) as PileHead[];
  const clearHeads = clear.map(resolve).filter(Boolean) as PileHead[];

  return (
    <div className={className}>
      <svg viewBox={`0 0 100 ${GROUND_Y + 1}`} className="w-full" role="img"
        aria-label={`${guilty.length} pulling for OD, ${clear.length} pulling to reject`}>
        {/* Centre line — the knot's offset from this is the whole story. */}
        <line
          x1="50"
          y1="6"
          x2="50"
          y2={GROUND_Y}
          stroke="var(--faint)"
          strokeWidth="0.4"
          strokeDasharray="1.6 1.4"
        />
        <text x="50" y="4" textAnchor="middle" fontSize="3.2" fill="var(--faint)" className="font-mono">
          even
        </text>

        {/* The rope, with the winning side's stretch inked in. */}
        <line x1="20" y1={ROPE_Y} x2="80" y2={ROPE_Y} stroke="var(--ink)" strokeWidth="0.7" />
        {total > 0 && Math.abs(pull) > 0.01 && (
          <line
            x1="50"
            y1={ROPE_Y}
            x2={knotX}
            y2={ROPE_Y}
            stroke={pull > 0 ? "var(--od)" : "var(--clear)"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        <circle
          cx={knotX}
          cy={ROPE_Y}
          r="2"
          fill={total === 0 ? "var(--faint)" : pull > 0 ? "var(--od)" : "var(--clear)"}
          className="transition-all duration-700 ease-out"
          style={{ transitionProperty: "cx, fill" }}
        />

        <Puller heads={guiltyHeads} side="left" tone="var(--od)" />
        <Puller heads={clearHeads} side="right" tone="var(--clear)" />
      </svg>

      <div className="flex items-start justify-between gap-3 font-mono text-[11px]">
        <p className="text-od">
          OD · {guilty.length}
          {smallCount > 0 && <span className="text-faint"> ({smallCount} small)</span>}
        </p>
        <p className="text-center text-faint">
          {total === 0
            ? "nobody pulling"
            : Math.abs(pull) < 0.05
              ? "dead even"
              : pull > 0
                ? "leaning guilty"
                : "leaning clear"}
        </p>
        <p className="text-clear">{clear.length} · Reject</p>
      </div>
    </div>
  );
}

// One side's team: a stick body with everyone's heads piled on its shoulders,
// arms out to the rope. Empty side = a slack rope end, nobody there.
function Puller({
  heads,
  side,
  tone,
}: {
  heads: PileHead[];
  side: "left" | "right";
  tone: string;
}) {
  const bodyX = side === "left" ? 17 : 83;
  const gripX = side === "left" ? 21 : 79;
  const dir = side === "left" ? 1 : -1;

  if (heads.length === 0) {
    return (
      <text
        x={bodyX}
        y={ROPE_Y + 5}
        textAnchor="middle"
        fontSize="3.4"
        fill="var(--faint)"
        className="font-mono"
      >
        empty
      </text>
    );
  }

  const pile = layOutPile(heads, { width: 30, maxSize: 11, tilt: 12 });
  const pileLeft = bodyX - 15;

  return (
    <g>
      {/* Torso, legs braced against the pull, arms on the rope. */}
      <path
        d={`M ${bodyX} ${SHOULDER_Y} L ${bodyX} ${GROUND_Y - 7}
            M ${bodyX} ${GROUND_Y - 7} L ${bodyX - 3 * dir} ${GROUND_Y}
            M ${bodyX} ${GROUND_Y - 7} L ${bodyX + 2.5 * dir} ${GROUND_Y}
            M ${bodyX} ${SHOULDER_Y + 1} L ${gripX} ${ROPE_Y}
            M ${bodyX} ${SHOULDER_Y + 2.5} L ${gripX} ${ROPE_Y + 0.6}`}
        stroke="var(--ink)"
        strokeWidth="0.7"
        strokeLinecap="round"
        fill="none"
      />
      {pile.placements.map(({ head, x, y, size, rotate }) => {
        const top = SHOULDER_Y - y - size;
        const cx = pileLeft + x + size / 2;
        const spin = `rotate(${rotate} ${cx} ${top + size / 2})`;
        return head.image ? (
          <image
            key={head.id}
            href={head.image}
            x={pileLeft + x}
            y={top}
            width={size}
            height={size}
            transform={spin}
            preserveAspectRatio="xMidYMid meet"
          >
            <title>{head.name} — pulling to {side === "left" ? "convict" : "clear"}</title>
          </image>
        ) : (
          <g key={head.id} transform={spin}>
            <title>{head.name} — pulling to {side === "left" ? "convict" : "clear"}</title>
            <circle cx={cx} cy={top + size / 2} r={size / 2.4} fill="var(--surface)" stroke={tone} strokeWidth="0.4" />
            <text
              x={cx}
              y={top + size / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.45}
              fontWeight="700"
              fill={tone}
            >
              {head.name[0]?.toUpperCase() ?? "?"}
            </text>
          </g>
        );
      })}
    </g>
  );
}
