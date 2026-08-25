"use client";

// Free, local alternative to calling an AI image model: instead of editing
// the person's actual expression, tint the existing photo and stamp a mood
// emoji on it — a canvas composite, done entirely in the browser, no API,
// no cost, no rate limit.
export type Mood = "happy" | "sad";

const FILTERS: Record<Mood, string> = {
  happy: "brightness(1.12) saturate(1.4) contrast(1.05)",
  sad: "brightness(0.82) saturate(0.5) hue-rotate(190deg)",
};

const BADGES: Record<Mood, string> = {
  happy: "😂",
  sad: "😭",
};

export async function generateMoodSticker(imageUrl: string, mood: Mood): Promise<string> {
  const img = await loadImage(imageUrl);

  const size = Math.max(img.naturalWidth, img.naturalHeight, 256);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser");

  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;

  ctx.filter = FILTERS[mood];
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  ctx.filter = "none";

  const badgeSize = size * 0.36;
  ctx.font = `${badgeSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = size * 0.03;
  ctx.fillText(BADGES[mood], size - size * 0.03, size - size * 0.02);

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the normal photo"));
    img.src = src;
  });
}
