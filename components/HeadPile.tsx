import Link from "next/link";
import { layOutPile, type PileHead } from "@/lib/pile";

// The board's group portrait: everyone's cut-out head dumped in a pile above
// a rule, with the board's name and its numbers set underneath like a caption
// in a printed almanac. This is the one place you see the whole board at once
// — the tub — and it's the same drawing on the board page and in the rack.

export function HeadPile({
  heads,
  className = "",
  tilt = 16,
}: {
  heads: PileHead[];
  className?: string;
  tilt?: number;
}) {
  const { placements, height } = layOutPile(heads, { tilt });

  if (placements.length === 0) {
    return (
      <div
        className={`flex items-end justify-center pb-1 text-xs text-faint ${className}`}
        style={{ aspectRatio: "100 / 34" }}
      >
        No heads in the tub yet
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      className={`w-full overflow-visible ${className}`}
      role="img"
      aria-label={`${heads.length} board members`}
    >
      <defs>
        <filter id="head-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0.7" stdDeviation="0.7" floodOpacity="0.28" />
        </filter>
      </defs>
      {placements.map(({ head, x, y, size, rotate }) => {
        // Pile y is measured up from the baseline; SVG's grows downward.
        const top = height - y - size;
        const spin = `rotate(${rotate} ${x + size / 2} ${top + size / 2})`;
        return head.image ? (
          // The <title> is what a photo can't always tell you: a dark, blank,
          // or badly cropped head still names itself on hover.
          <image
            key={head.id}
            href={head.image}
            x={x}
            y={top}
            width={size}
            height={size}
            transform={spin}
            filter="url(#head-shadow)"
            preserveAspectRatio="xMidYMid meet"
          >
            <title>{head.name}</title>
          </image>
        ) : (
          <g key={head.id} transform={spin}>
            <title>{head.name}</title>
            <circle
              cx={x + size / 2}
              cy={top + size / 2}
              r={size / 2.3}
              fill="var(--surface)"
              stroke="var(--line)"
              strokeWidth={0.4}
            />
            <text
              x={x + size / 2}
              y={top + size / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.42}
              fontWeight="700"
              fill="var(--faint)"
            >
              {head.name[0]?.toUpperCase() ?? "?"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * A pile with its caption — the unit the rack is built out of. `stats` are
 * set in mono under the title, one per line, the way the reference almanac
 * pages annotate each team's pile.
 */
export function PileCard({
  heads,
  title,
  kicker,
  stats,
  href,
  tag,
}: {
  heads: PileHead[];
  title: string;
  kicker?: string;
  stats: string[];
  href?: string;
  tag?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex flex-1 items-end px-2 pt-4">
        <HeadPile heads={heads} />
      </div>
      <div className="border-t-2 border-ink px-1 pt-2">
        <p className="flex items-baseline gap-2 font-mono text-sm font-bold">
          {kicker && <span className="text-faint">{kicker}</span>}
          {kicker && <span className="text-faint">|</span>}
          <span className="min-w-0 truncate">{title}</span>
          {tag && <span className="ml-auto shrink-0">{tag}</span>}
        </p>
        {stats.map((line) => (
          <p key={line} className="font-mono text-xs text-muted">
            {line}
          </p>
        ))}
      </div>
    </>
  );

  if (!href) return <div className="flex flex-col">{body}</div>;

  return (
    <Link
      href={href}
      className="group flex flex-col transition hover:-translate-y-0.5 [&_p:first-of-type]:group-hover:text-od"
    >
      {body}
    </Link>
  );
}
