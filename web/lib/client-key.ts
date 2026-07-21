"use client";

// The user's Anthropic key lives in sessionStorage only: it is sent as a header
// on pipeline requests, used transiently by the server, and never persisted
// server-side. Closing the tab forgets it.

export const KEY_STORAGE = "anthropic-api-key";

export function readKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function writeKey(key: string) {
  try {
    if (key) window.sessionStorage.setItem(KEY_STORAGE, key);
    else window.sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    /* private browsing — the key simply won't persist across reloads */
  }
}

/** Headers for a pipeline request, including the caller's key when they have one. */
export function pipelineHeaders(): HeadersInit {
  const key = readKey();
  return key
    ? { "Content-Type": "application/json", "x-anthropic-key": key }
    : { "Content-Type": "application/json" };
}
