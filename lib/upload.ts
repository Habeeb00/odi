const MAX_DATA_URL_BYTES = 3 * 1024 * 1024; // ~3MB, comfortably under Postgres text column limits

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

// Images are stored as data: URLs directly in the database (no filesystem
// writes) so uploads work identically in serverless deployments — the app
// stays a single stateless process talking to one Postgres database.
export function validateImageDataUrl(dataUrl: string): string {
  const match = /^data:([^;]+);base64,/.exec(dataUrl);
  if (!match || !ALLOWED_MIME.has(match[1])) {
    throw new Error("Unsupported image type");
  }
  if (dataUrl.length > MAX_DATA_URL_BYTES) {
    throw new Error("Image is too large (max ~2MB)");
  }
  return dataUrl;
}

const MEMBER_IMAGE_FIELDS = [
  ["imageDataUrl", "image"],
  ["imageHappyDataUrl", "imageHappy"],
  ["imageSadDataUrl", "imageSad"],
] as const;

// A member can carry three sticker photos — normal, happy, sad — shown on
// the display's race bar depending on standing. Pulls whichever of the three
// data: URLs are present in a request body and validates each.
export function parseMemberImageFields(body: Record<string, unknown>): Record<string, string> {
  const data: Record<string, string> = {};
  for (const [key, field] of MEMBER_IMAGE_FIELDS) {
    const value = body[key];
    if (typeof value === "string" && value) {
      data[field] = validateImageDataUrl(value);
    }
  }
  return data;
}
