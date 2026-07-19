import { put, list, del } from "@vercel/blob";

// All run state lives in Vercel Blob under users/{userId}/runs/{runId}/.
// No database in MVP — the runs list is a prefix listing.

export function runPrefix(userId: string, runId: string) {
  return `users/${userId}/runs/${runId}`;
}

export async function putRunFile(
  userId: string,
  runId: string,
  name: string,
  body: string | Buffer | ArrayBuffer,
  contentType?: string
) {
  return put(`${runPrefix(userId, runId)}/${name}`, body, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function getRunFile(userId: string, runId: string, name: string): Promise<string | null> {
  const { blobs } = await list({ prefix: `${runPrefix(userId, runId)}/${name}`, limit: 1 });
  if (!blobs.length) return null;
  const res = await fetch(blobs[0].url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.text();
}

export async function listRunFiles(userId: string, runId: string) {
  const { blobs } = await list({ prefix: `${runPrefix(userId, runId)}/` });
  return blobs;
}

export async function listRuns(userId: string) {
  // manifest.json marks a run; one fetch per run keeps MVP simple.
  const { blobs } = await list({ prefix: `users/${userId}/runs/` });
  const manifests = blobs.filter((b) => b.pathname.endsWith("/manifest.json"));
  const runs = await Promise.all(
    manifests.map(async (m) => {
      try {
        const res = await fetch(m.url, { cache: "no-store" });
        return (await res.json()) as RunManifest;
      } catch {
        return null;
      }
    })
  );
  return runs
    .filter((r): r is RunManifest => r !== null)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function deleteRun(userId: string, runId: string) {
  const blobs = await listRunFiles(userId, runId);
  if (blobs.length) await del(blobs.map((b) => b.url));
}

export interface RunManifest {
  run_id: string;
  title: string;
  created_at: string; // ISO
  files: { name: string; size: number; supported: boolean }[];
  stages: Partial<Record<string, { status: "done" | "error"; at: string; detail?: string }>>;
  deliverables: { mode: string; name: string; url: string; at: string }[];
  tokens_used: number;
}

export async function getManifest(userId: string, runId: string): Promise<RunManifest | null> {
  const text = await getRunFile(userId, runId, "manifest.json");
  return text ? (JSON.parse(text) as RunManifest) : null;
}

export async function saveManifest(userId: string, runId: string, manifest: RunManifest) {
  await putRunFile(userId, runId, "manifest.json", JSON.stringify(manifest, null, 2), "application/json");
}
