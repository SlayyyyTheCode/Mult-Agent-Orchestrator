import { NextRequest, NextResponse } from "next/server";
import { getManifest, putRunFile, saveManifest } from "@/lib/blob";
import { fileKind } from "@/lib/extract";
import { MAX_FILES_PER_RUN, requireUser } from "@/lib/authz";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file

/** Neutralize path tricks: strip directories, keep a safe charset, cap length. */
function safeName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w\-. ()]/g, "_").replace(/\.{2,}/g, ".").slice(0, 120);
  return cleaned || "file";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authz = await requireUser();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  const { id } = await ctx.params;

  const manifest = await getManifest(authz.userId, id);
  if (!manifest) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "no files" }, { status: 400 });
  if (manifest.files.length + files.length > MAX_FILES_PER_RUN) {
    return NextResponse.json({ error: `max ${MAX_FILES_PER_RUN} files per run` }, { status: 413 });
  }

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${file.name} exceeds 20 MB limit` }, { status: 413 });
    }
    const name = safeName(file.name);
    const kind = fileKind(name);
    const buf = Buffer.from(await file.arrayBuffer());
    await putRunFile(authz.userId, id, `inbox/${name}`, buf, file.type || "application/octet-stream");
    // re-upload of the same name replaces its entry instead of duplicating
    manifest.files = manifest.files.filter((f) => f.name !== name);
    manifest.files.push({ name, size: file.size, supported: kind !== "unsupported" && kind !== "audio" });
  }
  await saveManifest(authz.userId, id, manifest);
  return NextResponse.json({ ok: true, files: manifest.files });
}
