"use client";

import * as faceapi from "face-api.js";

const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

let modelsLoaded: Promise<void> | null = null;

function loadModels(): Promise<void> {
  if (!modelsLoaded) {
    modelsLoaded = faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  }
  return modelsLoaded;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Detects the face in an uploaded photo and returns a PNG data URL cropped
 * to just the face, with everything outside a circular mask erased
 * (transparent). Throws if no face is found so the caller can fall back.
 */
export async function cropToFace(file: File): Promise<string> {
  await loadModels();
  const img = await loadImage(file);

  const detection = await faceapi.detectSingleFace(
    img,
    new faceapi.TinyFaceDetectorOptions()
  );
  URL.revokeObjectURL(img.src);

  if (!detection) {
    throw new Error("No face detected in that photo.");
  }

  const { x, y, width, height } = detection.box;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const size = Math.max(width, height) * 1.8;

  const canvas = document.createElement("canvas");
  const output = 512;
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.save();
  ctx.beginPath();
  ctx.arc(output / 2, output / 2, output / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    img,
    cx - size / 2,
    cy - size / 2,
    size,
    size,
    0,
    0,
    output,
    output
  );
  ctx.restore();

  return canvas.toDataURL("image/png");
}
