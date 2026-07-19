import { NextRequest, NextResponse } from "next/server";
import { deleteRun, getManifest, getRunFile } from "@/lib/blob";
import { requireUser } from "@/lib/authz";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authz = await requireUser();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  const { id } = await ctx.params;

  const manifest = await getManifest(authz.userId, id);
  if (!manifest) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Include the validation summary when present — powers keypoints + (L) UI.
  const validation = await getRunFile(authz.userId, id, "03-validation.json");
  return NextResponse.json({ run: manifest, validation: validation ? JSON.parse(validation) : null });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authz = await requireUser();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  const { id } = await ctx.params;
  await deleteRun(authz.userId, id);
  return NextResponse.json({ ok: true });
}
