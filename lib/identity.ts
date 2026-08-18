"use client";

export function identityKey(slug: string) {
  return `oddy:${slug}:memberId`;
}

export function getIdentity(slug: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(identityKey(slug));
}

export function setIdentity(slug: string, memberId: string) {
  window.localStorage.setItem(identityKey(slug), memberId);
}

export function clearIdentity(slug: string) {
  window.localStorage.removeItem(identityKey(slug));
}
