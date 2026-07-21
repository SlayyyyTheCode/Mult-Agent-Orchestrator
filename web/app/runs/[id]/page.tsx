"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import type { RunManifest } from "@/lib/blob";
import type { ValidationSummary } from "@/lib/schemas";
import { pipelineHeaders, readKey } from "@/lib/client-key";
import ApiKeyPanel from "../../api-key-panel";

type Mode = "deck-csuite" | "deck-technical" | "minutes";
const ANALYZE_STAGES = ["ingest", "organize", "validate"] as const;
const DELIVER_STAGES = ["generate", "review", "render"] as const;

const STAGE_LABEL: Record<string, string> = {
  ingest: "Ingest",
  organize: "Organize",
  validate: "Validate",
  generate: "Structure",
  review: "Design review",
  render: "Render",
};

const CONF_STYLE: Record<string, string> = {
  H: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  M: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  L: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [run, setRun] = useState<RunManifest | null>(null);
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // current stage label or null
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/runs/${id}`);
    if (!res.ok) {
      setError("run not found");
      return;
    }
    const data = await res.json();
    setRun(data.run);
    setValidation(data.validation);
  }, [id]);

  useEffect(() => {
    // state is set after the tick, not synchronously in the effect body
    const t = setTimeout(() => {
      if (!readKey()) setNeedsKey(true);
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      const res = await fetch(`/api/runs/${id}/files`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? "upload failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function runStages(stages: readonly string[], mode?: Mode) {
    setError(null);
    try {
      for (const stage of stages) {
        setBusy(STAGE_LABEL[stage] ?? stage);
        const res = await fetch(`/api/pipeline/${stage}`, {
          method: "POST",
          headers: pipelineHeaders(),
          body: JSON.stringify({ runId: id, mode }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 400 && /API key/i.test(data.error ?? "")) setNeedsKey(true);
          throw new Error(`${STAGE_LABEL[stage]}: ${data.error ?? "failed"}`);
        }
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "pipeline failed");
    } finally {
      setBusy(null);
      await load();
    }
  }

  if (!run) {
    return error ? (
      <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>
    ) : (
      <div className="h-40 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" aria-label="Loading run" />
    );
  }

  const analyzed = ANALYZE_STAGES.every((s) => run.stages[s]?.status === "done");
  const lItems = validation?.review_items ?? [];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">{run.title}</h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {run.run_id} · {run.tokens_used.toLocaleString()} tokens used
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <ApiKeyPanel required={needsKey} />

      {/* 1 — files */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">1 · Meeting files</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          pptx, docx, pdf, txt, md, vtt/srt transcripts, photos of notes. Audio needs a transcript.
        </p>
        {run.files.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {run.files.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={f.supported ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"} aria-hidden>
                  {f.supported ? "✓" : "⚠"}
                </span>
                <span>{f.name}</span>
                <span className="text-xs text-zinc-400">({Math.ceil(f.size / 1024)} KB{f.supported ? "" : " — needs transcript"})</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-zinc-300 px-4 font-medium transition hover:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500 dark:border-zinc-700">
            <input
              ref={fileInput}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => upload(e.target.files)}
              accept=".pptx,.docx,.pdf,.txt,.md,.vtt,.srt,.png,.jpg,.jpeg,.gif,.webp"
            />
            {uploading ? "Uploading…" : "Add files"}
          </label>
          <button
            onClick={() => runStages(ANALYZE_STAGES)}
            disabled={!!busy || run.files.length === 0}
            className="h-11 rounded-lg bg-blue-600 px-6 font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-950"
          >
            {busy && ANALYZE_STAGES.some((s) => STAGE_LABEL[s] === busy) ? `${busy}…` : analyzed ? "Re-analyze" : "Analyze"}
          </button>
        </div>
      </section>

      {/* 2 — pipeline progress */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">2 · Pipeline</h2>
        <ol className="mt-3 flex flex-wrap gap-2" aria-label="Pipeline stages">
          {[...ANALYZE_STAGES].map((s) => {
            const st = run.stages[s];
            const active = busy === STAGE_LABEL[s];
            return (
              <li
                key={s}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-blue-600 text-white"
                    : st?.status === "done"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : st?.status === "error"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {STAGE_LABEL[s]}
                {active && "…"}
                {!active && st?.status === "done" && " ✓"}
                {!active && st?.status === "error" && " ✗"}
              </li>
            );
          })}
        </ol>
      </section>

      {/* 3 — validated keypoints + (L) review */}
      {validation && (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">3 · Validated key points</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  validation.verdict === "PASS"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                {validation.verdict}
              </span>
            </div>
            <div className="mt-4 space-y-5">
              {validation.categories.map((cat) => (
                <div key={cat.name}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{cat.name}</h3>
                  <ul className="mt-2 space-y-2">
                    {cat.points.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 inline-block w-6 shrink-0 rounded text-center text-xs font-bold ${CONF_STYLE[p.confidence]}`} title={`Confidence: ${p.confidence}`}>
                          {p.confidence}
                        </span>
                        <span>{p.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section
            className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40"
            aria-label="Needs human review"
          >
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">⚠ Needs human review ({lItems.length})</h2>
            {lItems.length === 0 ? (
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">No low-confidence items — nothing to review.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-amber-900 dark:text-amber-200">
                {lItems.map((r, i) => (
                  <li key={i}>
                    <span className="font-medium">{r.text}</span>
                    <span className="text-amber-700 dark:text-amber-400"> — {r.reason}</span>
                  </li>
                ))}
              </ul>
            )}
            {(validation.conflicts.length > 0 || validation.coverage_gaps.length > 0) && (
              <div className="mt-3 space-y-1 text-sm text-amber-800 dark:text-amber-300">
                {validation.conflicts.map((c, i) => (
                  <p key={`c${i}`}>Conflict: {c}</p>
                ))}
                {validation.coverage_gaps.map((g, i) => (
                  <p key={`g${i}`}>Gap: {g}</p>
                ))}
              </div>
            )}
          </section>

          {/* 4 — deliverables */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-semibold">4 · Generate deliverable</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Runs McKinsey structuring → independent design review → file render.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(
                [
                  ["deck-csuite", "C-suite deck (.pptx)"],
                  ["deck-technical", "Technical deck (.pptx)"],
                  ["minutes", "Meeting minutes (.docx)"],
                ] as [Mode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => runStages(DELIVER_STAGES, mode)}
                  disabled={!!busy}
                  className="h-11 rounded-lg border border-blue-600 px-5 font-medium text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950"
                >
                  {label}
                </button>
              ))}
            </div>
            {busy && DELIVER_STAGES.some((s) => STAGE_LABEL[s] === busy) && (
              <p className="mt-3 text-sm text-blue-700 dark:text-blue-400" aria-live="polite">
                {busy}… this can take a minute.
              </p>
            )}
            {run.deliverables.length > 0 && (
              <ul className="mt-4 space-y-2">
                {run.deliverables.map((d, i) => (
                  <li key={i}>
                    <a
                      href={`/api/runs/${run.run_id}/download?name=${encodeURIComponent(d.name)}`}
                      download={d.name}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      ⬇ {d.name}
                    </a>
                    <span className="ml-2 text-xs text-zinc-400">{new Date(d.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
