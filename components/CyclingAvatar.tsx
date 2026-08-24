"use client";

import { useEffect, useState } from "react";

// A member can have several photos (normal/laughing/crying). When more than
// one is actually uploaded, flip between them like a GIF instead of picking
// just one — otherwise render the single photo (or fallback) statically.
export default function CyclingAvatar({
  images,
  alt,
  fallback,
  className,
  intervalMs = 900,
}: {
  images: (string | null | undefined)[];
  alt: string;
  fallback: React.ReactNode;
  className?: string;
  intervalMs?: number;
}) {
  const frames = images.filter((src): src is string => !!src);
  const key = frames.join("|");
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
    if (frames.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % frames.length), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs]);

  if (frames.length === 0) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={frames[i]} alt={alt} className={className} />
  );
}
