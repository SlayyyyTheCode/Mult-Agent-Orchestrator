"use client";

import { useEffect, useState } from "react";
import { readKey, writeKey } from "@/lib/client-key";

/**
 * Lets a user supply their own Anthropic API key. It is held in sessionStorage
 * and sent per request — the server never stores it, so each person pays for
 * their own runs.
 */
export default function ApiKeyPanel({ required }: { required: boolean }) {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // sessionStorage is client-only, so this runs after mount — deferred a tick
    // so the state write isn't synchronous inside the effect body.
    const t = setTimeout(() => {
      const existing = readKey();
      setKey(existing);
      setSaved(Boolean(existing));
      setOpen(required && !existing);
    }, 0);
    return () => clearTimeout(t);
  }, [required]);

  function save(next: string) {
    writeKey(next.trim());
    setKey(next.trim());
    setSaved(Boolean(next.trim()));
  }

  const masked = key ? `${key.slice(0, 11)}…${key.slice(-4)}` : "";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Anthropic API key</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {saved ? (
              <>
                Using <span className="font-mono">{masked}</span> — stored in this browser tab only.
              </>
            ) : required ? (
              "Required. Your key stays in your browser and is sent only with your own pipeline runs."
            ) : (
              "Optional — add one to run on your own Anthropic account instead of the app owner's."
            )}
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="h-10 shrink-0 rounded-lg border border-zinc-300 px-4 text-sm font-medium transition hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700"
        >
          {open ? "Close" : saved ? "Change" : "Add key"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium" htmlFor="anthropic-key">
            Key from console.anthropic.com
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="anthropic-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              spellCheck={false}
              className="h-11 flex-1 rounded-lg border border-zinc-300 bg-white px-4 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              onClick={() => {
                save(key);
                setOpen(false);
              }}
              disabled={!key.trim()}
              className="h-11 rounded-lg bg-blue-600 px-5 font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            {saved && (
              <button
                onClick={() => {
                  save("");
                  setOpen(false);
                }}
                className="h-11 rounded-lg border border-zinc-300 px-5 font-medium transition hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-zinc-700"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Set a monthly spend limit in the Anthropic console. A full run typically costs $0.30–1.50.
          </p>
        </div>
      )}
    </section>
  );
}
