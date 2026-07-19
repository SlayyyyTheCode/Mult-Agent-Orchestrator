import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { deleteRun, getManifest, getRunFile } from "@/lib/blob";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const manifest = await getManifest(userId, id);
  if (!manifest) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Include the validation summary when present — powers keypoints + (L) UI.
  const validation = await getRunFile(userId, id, "03-validation.json");
  return NextResponse.json({ run: manifest, validation: validation ? JSON.parse(validation) : null });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await deleteRun(userId, id);
  return NextResponse.json({ ok: true });
}
