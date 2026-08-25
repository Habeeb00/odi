import { parseDataUrl } from "@/lib/media";

// Turns a member's one uploaded photo into a mood variant via Gemini's
// image model, so an admin only ever has to supply the normal photo —
// laughing/crying are generated on request, not hand-picked.
const MODEL = "gemini-2.5-flash-image";

export type Mood = "happy" | "sad";

const PROMPTS: Record<Mood, string> = {
  happy:
    "Edit this photo so the person is laughing joyfully with a big genuine smile and their eyes lit up. Keep the same person, camera framing, background, lighting, and clothing exactly as they are — change only the facial expression to laughing.",
  sad:
    "Edit this photo so the person is crying, with tears and a sad, upset expression. Keep the same person, camera framing, background, lighting, and clothing exactly as they are — change only the facial expression to crying.",
};

export async function generateMoodPhoto(baseDataUrl: string, mood: Mood): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI photo generation isn't set up — GEMINI_API_KEY is missing.");
  }

  const parsed = parseDataUrl(baseDataUrl);
  if (!parsed) throw new Error("The member's normal photo is invalid");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: parsed.mime, data: parsed.buffer.toString("base64") } },
              { text: PROMPTS[mood] },
            ],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  const parts: unknown[] = json?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts
    .map((p) => (p as { inlineData?: unknown; inline_data?: unknown }))
    .map((p) => p.inlineData ?? p.inline_data)
    .find((d): d is { data: string; mimeType?: string; mime_type?: string } => !!d);

  if (!inline?.data) {
    throw new Error("Gemini didn't return an image — try again or adjust the photo");
  }

  const outMime = inline.mimeType ?? inline.mime_type ?? "image/png";
  return `data:${outMime};base64,${inline.data}`;
}
