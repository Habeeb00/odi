"use client";

import { useState } from "react";

export default function CopyField({
  label,
  value,
  hint,
  tone = "neutral",
  size = "md",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "secret";
  size?: "md" | "lg";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={`rounded-xl border bg-surface p-4 ${
        tone === "secret" ? "border-ink" : "border-line"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {label}
        </span>
        <button
          onClick={copy}
          className="shrink-0 text-xs font-semibold text-od hover:underline"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p
        className={`mt-2 break-all font-mono ${
          size === "lg" ? "text-2xl font-bold tracking-[0.18em]" : "text-sm"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}
