import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Accepts a data: URL (from a <input type="file"> read client-side) and
// writes it to /public/uploads, returning the public path to store on the
// record. Kept deliberately simple — no object storage for V1.
export async function saveDataUrl(dataUrl: string, prefix: string): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid data URL");
  const [, mime, base64] = match;
  const ext = EXT_BY_MIME[mime] ?? "bin";
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(base64, "base64"));
  return `/uploads/${filename}`;
}
