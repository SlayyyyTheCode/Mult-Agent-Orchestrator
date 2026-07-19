import { del, get, list, put } from "@vercel/blob";

// All run state lives in Vercel Blob under users/{userId}/runs/{runId}/.
// Every blob is PRIVATE — content (meeting docs, deliverables) is never
// reachable by URL alone; reads go through the SDK with the store token and
// downloads are streamed through an authenticated API route.

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
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function getRunFile(userId: string, runId: string, name: string): Promise<string | null> {
  const buf = await getRunFileBuffer(userId, runId, name);
  return buf ? buf.toString("utf-8") : null;
}

export async function getRunFileBuffer(userId: string, runId: string, name: string): Promise<Buffer | null> {
  const res = await get(`${runPrefix(userId, runId)}/${name}`, { access: "private", useCache: false }).catch(() => null);
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return streamToBuffer(res.stream);
}

/** Stream a run file for download (authenticated route use only). */
export async function getRunFileStream(userId: string, runId: string, name: string) {
  const res = await get(`${runPrefix(userId, runId)}/${name}`, { access: "private", useCache: false }).catch(() => null);
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return { stream: res.stream, contentType: res.headers.get("content-type") ?? "application/octet-stream" };
}

export async function listRunFiles(userId: string, runId: string) {
  const { blobs } = await list({ prefix: `${runPrefix(userId, runId)}/` });
  return blobs;
}

export async function listRuns(userId: string) {
  // manifest.json marks a run; manifests are fetched in parallel.
  const { blobs } = await list({ prefix: `users/${userId}/runs/`, limit: 500 });
  const manifests = blobs.filter((b) => b.pathname.endsWith("/manifest.json"));
  const runs = await Promise.all(
    manifests.map(async (m) => {
      try {
        const res = await get(m.pathname, { access: "private", useCache: false });
        if (!res || res.statusCode !== 200 || !res.stream) return null;
        return JSON.parse((await streamToBuffer(res.stream)).toString("utf-8")) as RunManifest;
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
  /** name is the blob file name under deliverables/ — downloads go through /api/runs/[id]/download */
  deliverables: { mode: string; name: string; at: string }[];
  tokens_used: number;
}

export async function getManifest(userId: string, runId: string): Promise<RunManifest | null> {
  const text = await getRunFile(userId, runId, "manifest.json");
  return text ? (JSON.parse(text) as RunManifest) : null;
}

export async function saveManifest(userId: string, runId: string, manifest: RunManifest) {
  await putRunFile(userId, runId, "manifest.json", JSON.stringify(manifest, null, 2), "application/json");
}
