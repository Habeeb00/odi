"use client";

// Separate from lib/identity.ts (which member you are, for voting/raising).
// This just remembers that this browser already proved it knows the
// board's admin code, so it isn't asked again every visit.
function adminKey(slug: string) {
  return `oddy:${slug}:adminUnlocked`;
}

export function isAdminUnlocked(slug: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(adminKey(slug)) === "1";
}

export function unlockAdmin(slug: string) {
  window.localStorage.setItem(adminKey(slug), "1");
}
