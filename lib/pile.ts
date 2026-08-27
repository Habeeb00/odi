// Geometry for the "tub of heads" — every board's group portrait, and the
// clusters on either end of a tug-of-war rope. Heads stack bottom-up in
// shrinking rows so the result reads as a pile someone dumped out, not a
// grid. All jitter is derived from the member id rather than Math.random so
// server and client renders agree (and a board's portrait looks the same
// every visit — it's their photo, it shouldn't reshuffle).

export type PileHead = {
  id: string;
  name: string;
  image: string | null;
};

export type Placement = {
  head: PileHead;
  // All values are in the same units as `width` (a 0-100 viewBox by default).
  x: number;
  // Distance from the baseline up to the head's bottom edge.
  y: number;
  size: number;
  rotate: number;
  z: number;
};

export type Pile = {
  placements: Placement[];
  size: number;
  height: number;
};

// How much each head overlaps its neighbour, and how tightly rows sit on
// top of each other. Both under 1 — the overlap is what makes it a pile.
const STEP_X = 0.74;
const STEP_Y = 0.5;

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function jitter(seed: string, spread: number): number {
  return (hash(seed) - 0.5) * 2 * spread;
}

/**
 * Lays heads out as a mound: the widest row on the baseline, each row above
 * one head narrower, so a big board peaks in the middle like the reference
 * pile rather than fanning out into a line.
 */
export function layOutPile(
  heads: PileHead[],
  { width = 100, maxSize, tilt = 16 }: { width?: number; maxSize?: number; tilt?: number } = {}
): Pile {
  const cap = maxSize ?? width / 3.4;
  if (heads.length === 0) return { placements: [], size: 0, height: 0 };

  const n = heads.length;
  // Smallest base row that lets a triangular stack hold everyone.
  const base = Math.max(1, Math.ceil((Math.sqrt(1 + 8 * n) - 1) / 2));

  const rows: PileHead[][] = [];
  let cursor = 0;
  let capacity = base;
  while (cursor < n) {
    const take = Math.max(1, Math.min(capacity, n - cursor));
    rows.push(heads.slice(cursor, cursor + take));
    cursor += take;
    capacity = Math.max(1, capacity - 1);
  }

  // Bottom row has to fit inside `width`; single heads get capped so a
  // two-person board doesn't render two enormous faces.
  const size = Math.min(cap, width / (STEP_X * (base - 1) + 1));

  const placements: Placement[] = [];
  rows.forEach((row, rowIndex) => {
    const rowWidth = size * (STEP_X * (row.length - 1) + 1);
    const startX = (width - rowWidth) / 2;
    row.forEach((head, i) => {
      placements.push({
        head,
        x: startX + i * STEP_X * size + jitter(`${head.id}x`, size * 0.07),
        y: rowIndex * STEP_Y * size + jitter(`${head.id}y`, size * 0.05),
        size,
        rotate: jitter(`${head.id}r`, tilt),
        // Front row paints last so the pile has a front and a back.
        z: rows.length - rowIndex,
      });
    });
  });

  const height = (rows.length - 1) * STEP_Y * size + size;
  return { placements: placements.sort((a, b) => a.z - b.z), size, height };
}
