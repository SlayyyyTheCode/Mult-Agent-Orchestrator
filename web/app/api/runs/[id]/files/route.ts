import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getManifest, putRunFile, saveManifest } from "@/lib/blob";
import { fileKind } from "@/lib/extract";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const manifest = await getManifest(userId, id);
  if (!manifest) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "no files" }, { status: 400 });

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${file.name} exceeds 20 MB limit` }, { status: 413 });
    }
    const kind = fileKind(file.name);
    const buf = Buffer.from(await file.arrayBuffer());
    await putRunFile(userId, id, `inbox/${file.name}`, buf, file.type || "application/octet-stream");
    manifest.files.push({ name: file.name, size: file.size, supported: kind !== "unsupported" && kind !== "audio" });
  }
  await saveManifest(userId, id, manifest);
  return NextResponse.json({ ok: true, files: manifest.files });
}
