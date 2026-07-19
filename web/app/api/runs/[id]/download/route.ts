import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getRunFileStream } from "@/lib/blob";

// Streams a deliverable to the signed-in owner. Blobs are private, so this
// authenticated route is the only way file content leaves the store.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authz = await requireUser();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  const { id } = await ctx.params;

  const name = req.nextUrl.searchParams.get("name") ?? "";
  // strict allowlist on the file name — no separators, deliverables only
  if (!/^[\w\-. ]+\.(pptx|docx)$/.test(name)) {
    return NextResponse.json({ error: "invalid file name" }, { status: 400 });
  }

  const file = await getRunFileStream(authz.userId, id, `deliverables/${name}`);
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
