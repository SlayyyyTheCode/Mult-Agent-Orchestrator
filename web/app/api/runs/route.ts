import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { listRuns, saveManifest, type RunManifest } from "@/lib/blob";
import { z } from "zod";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ runs: await listRuns(userId) });
}

const createBody = z.object({ title: z.string().min(1).max(120) });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "title required" }, { status: 400 });

  const runId = `${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`;
  const manifest: RunManifest = {
    run_id: runId,
    title: parsed.data.title,
    created_at: new Date().toISOString(),
    files: [],
    stages: {},
    deliverables: [],
    tokens_used: 0,
  };
  await saveManifest(userId, runId, manifest);
  return NextResponse.json({ run: manifest });
}
