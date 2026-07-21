"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RunManifest } from "@/lib/blob";
import ApiKeyPanel from "./api-key-panel";

export default function Dashboard({ byok }: { byok: boolean }) {
  const router = useRouter();
  const [runs, setRuns] = useState<RunManifest[] | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/runs");
      if (!res.ok) throw new Error(`failed to load runs (${res.status})`);
      setRuns((await res.json()).runs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load runs");
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    // async fetch → state set after await, not synchronously in the effect
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function createRun(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "create failed");
      const { run } = await res.json();
      router.push(`/runs/${run.run_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "create failed");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Each run turns a set of meeting files into validated key points and deliverables.
        </p>
      </section>

      <ApiKeyPanel required={byok} />

      <form onSubmit={createRun} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="run-title">
          New run title
        </label>
        <input
          id="run-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Q3 steering meeting"
          className="h-11 flex-1 rounded-lg border border-zinc-300 bg-white px-4 text-base outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
          maxLength={120}
          required
        />
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="h-11 rounded-lg bg-blue-600 px-6 font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-950"
        >
          {creating ? "Creating…" : "New run"}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {runs === null ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <p className="text-lg font-medium">No runs yet</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create a run above, then upload your meeting files (pptx, docx, pdf, transcripts, note photos).
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {runs.map((r) => (
            <li key={r.run_id}>
              <button
                onClick={() => router.push(`/runs/${r.run_id}`)}
                className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left transition hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-600"
              >
                <span>
                  <span className="block font-medium">{r.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(r.created_at).toLocaleString()} · {r.files.length} file{r.files.length === 1 ? "" : "s"} ·{" "}
                    {r.deliverables.length} deliverable{r.deliverables.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span aria-hidden className="text-zinc-400">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
