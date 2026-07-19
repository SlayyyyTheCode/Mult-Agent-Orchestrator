import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { listRuns, saveManifest, type RunManifest } from "@/lib/blob";
import { requireUser } from "@/lib/authz";
import { z } from "zod";

export async function GET() {
  const authz = await requireUser();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  return NextResponse.json({ runs: await listRuns(authz.userId) });
}

const createBody = z.object({ title: z.string().min(1).max(120) });

export async function POST(req: NextRequest) {
  const authz = await requireUser();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const parsed = createBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "title required" }, { status: 400 });

  const runId = `${new Date().toISOString().slice(0, 10)}-${randomBytes(9).toString("base64url")}`;
  const manifest: RunManifest = {
    run_id: runId,
    title: parsed.data.title,
    created_at: new Date().toISOString(),
    files: [],
    stages: {},
    deliverables: [],
    tokens_used: 0,
  };
  await saveManifest(authz.userId, runId, manifest);
  return NextResponse.json({ run: manifest });
}
