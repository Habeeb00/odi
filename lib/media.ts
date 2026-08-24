// Member photos and category assets are stored as full data: URLs in Postgres
// (see lib/upload.ts) so uploads work without filesystem writes. Embedding
// those base64 blobs directly in JSON responses made the leaderboard/display
// endpoints huge — the display page polls /state every 4s, so every pending
// case with an image/GIF asset re-shipped up to ~3MB per tick. Instead, API
// responses expose a small URL and the actual bytes are served (and cached
// by the browser) from a dedicated route.
export function memberImageUrl<T extends { id: string; image: string | null }>(
  member: T
): Omit<T, "image"> & { image: string | null } {
  return { ...member, image: member.image ? `/api/members/${member.id}/image` : null };
}

export function assetFileUrl<T extends { id: string; file: string | null }>(
  asset: T
): Omit<T, "file"> & { file: string | null } {
  return { ...asset, file: asset.file ? `/api/assets/${asset.id}/file` : null };
}

export function serializeOd<
  T extends {
    raisedBy: { id: string; image: string | null };
    accused: { id: string; image: string | null };
  },
>(od: T): T {
  return { ...od, raisedBy: memberImageUrl(od.raisedBy), accused: memberImageUrl(od.accused) };
}

export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}
