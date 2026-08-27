// Board URLs are the board's name (e.g. "TinkerHub" -> "/tinkerhub") so people
// can find and share the public leaderboard without a join code. Uniqueness
// is handled by the caller appending "-2", "-3", etc. on collision. Reserved
// slugs must also go through that fallback so a board never shadows a real
// top-level route (they'd otherwise 404 instead of falling back to /[slug]).
export const RESERVED_SLUGS = new Set(["api", "boards", "favicon.ico"]);

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "board";
}
