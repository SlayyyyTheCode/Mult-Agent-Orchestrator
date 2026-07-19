import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, callClaudeJson } from "@/lib/claude";
import { ingestSystem, mckinseySystem, organizeSystem, uiuxSystem, validateSystem } from "@/lib/agents/prompts";
import { getManifest, getRunFile, listRunFiles, putRunFile, saveManifest } from "@/lib/blob";
import { deckSpec, minutesSpec, validationSummary, type PipelineStage, PIPELINE_STAGES } from "@/lib/schemas";
import { extractText, fileKind, mediaTypeForImage } from "@/lib/extract";
import { renderDeck } from "@/lib/render/pptx";
import { renderMinutes } from "@/lib/render/docx";
import { z } from "zod";

export const maxDuration = 300; // needs Vercel fluid compute / pro for full length

const body = z.object({
  runId: z.string().min(1),
  mode: z.enum(["deck-csuite", "deck-technical", "minutes"]).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ stage: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { stage } = await ctx.params;
  if (!PIPELINE_STAGES.includes(stage as PipelineStage)) {
    return NextResponse.json({ error: `unknown stage '${stage}'` }, { status: 400 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request body" }, { status: 400 });
  const { runId, mode } = parsed.data;

  const manifest = await getManifest(userId, runId);
  if (!manifest) return NextResponse.json({ error: "run not found" }, { status: 404 });

  try {
    let tokens = 0;
    let result: unknown = null;

    switch (stage as PipelineStage) {
      case "ingest": {
        const blobs = await listRunFiles(userId, runId);
        const inputs = blobs.filter((b) => b.pathname.includes("/inbox/"));
        if (!inputs.length) throw new Error("no uploaded files in this run");
        const sections: string[] = [];
        for (const blob of inputs) {
          const name = blob.pathname.split("/").pop()!;
          const kind = fileKind(name);
          if (kind === "audio") {
            sections.push(`=== FILE: ${name} ===\n[UNREADABLE: audio not supported — please provide a transcript] (L)`);
            continue;
          }
          const res = await fetch(blob.url);
          const buf = Buffer.from(await res.arrayBuffer());
          if (kind === "image") {
            const claude = await callClaude({
              system: ingestSystem(),
              user: [
                { type: "image", source: { type: "base64", media_type: mediaTypeForImage(name) as "image/png", data: buf.toString("base64") } },
                { type: "text", text: `Transcribe this image of notes losslessly. Filename for source tags: ${name}` },
              ],
            });
            tokens += claude.tokens;
            sections.push(`=== FILE: ${name} (image) ===\n${claude.text}`);
          } else {
            sections.push(await extractText(name, buf));
          }
        }
        const claude = await callClaude({
          system: ingestSystem(),
          user: `run_id: ${runId}\n\nRaw extracted content follows. Convert to the source-tagged Markdown contract.\n\n${sections.join("\n\n")}`,
          maxTokens: 16000,
        });
        tokens += claude.tokens;
        await putRunFile(userId, runId, "01-ingest.md", claude.text, "text/markdown");
        result = { chars: claude.text.length };
        break;
      }

      case "organize": {
        const ingest = await getRunFile(userId, runId, "01-ingest.md");
        if (!ingest) throw new Error("ingest output missing — run ingest first");
        const claude = await callClaude({
          system: organizeSystem(),
          user: `run_id: ${runId}\n\nIngest output (lossless, source-tagged):\n\n${ingest}`,
          maxTokens: 12000,
        });
        tokens += claude.tokens;
        await putRunFile(userId, runId, "02-organizing.md", claude.text, "text/markdown");
        result = { chars: claude.text.length };
        break;
      }

      case "validate": {
        const [ingest, organizing] = await Promise.all([
          getRunFile(userId, runId, "01-ingest.md"),
          getRunFile(userId, runId, "02-organizing.md"),
        ]);
        if (!ingest || !organizing) throw new Error("missing upstream outputs — run ingest and organize first");
        const { data, tokens: t } = await callClaudeJson({
          system: validateSystem(),
          user: `run_id: ${runId}\n\nGROUND TRUTH (ingest output):\n${ingest}\n\nUNDER REVIEW (organizing output):\n${organizing}`,
          parse: (raw) => validationSummary.safeParse(raw),
          maxTokens: 12000,
        });
        tokens += t;
        await putRunFile(userId, runId, "03-validation.json", JSON.stringify(data, null, 2), "application/json");
        result = data;
        break;
      }

      case "generate": {
        if (!mode) throw new Error("mode required (deck-csuite | deck-technical | minutes)");
        const validation = await getRunFile(userId, runId, "03-validation.json");
        if (!validation) throw new Error("validation output missing — run validate first");
        const genPrompt = `run_id: ${runId}\n\nValidated key points (your ONLY content source):\n${validation}`;
        const gen =
          mode === "minutes"
            ? await callClaudeJson({
                system: mckinseySystem(mode),
                user: genPrompt,
                parse: (raw) => minutesSpec.safeParse(raw),
                maxTokens: 16000,
              })
            : await callClaudeJson({
                system: mckinseySystem(mode),
                user: genPrompt,
                parse: (raw) => deckSpec.safeParse(raw),
                maxTokens: 16000,
              });
        tokens += gen.tokens;
        await putRunFile(userId, runId, `04-spec-${mode}.json`, JSON.stringify(gen.data, null, 2), "application/json");
        result = { mode };
        break;
      }

      case "review": {
        if (!mode) throw new Error("mode required");
        const [specText, validation] = await Promise.all([
          getRunFile(userId, runId, `04-spec-${mode}.json`),
          getRunFile(userId, runId, "03-validation.json"),
        ]);
        if (!specText || !validation) throw new Error("missing spec or validation — run generate first");
        const kind = mode === "minutes" ? "minutes" : "deck";
        const schema = mode === "minutes" ? minutesSpec : deckSpec;
        const wrapper = z.object({
          review: z.array(z.object({ location: z.string(), severity: z.enum(["blocker", "major", "minor"]), issue: z.string(), fix: z.string() })),
          redesign_log: z.array(z.string()),
          spec: schema,
        });
        const { data, tokens: t } = await callClaudeJson({
          system: uiuxSystem(kind as "deck" | "minutes"),
          user: `run_id: ${runId}\n\nGround truth (validation summary):\n${validation}\n\nMcKinsey ${kind} spec under review:\n${specText}`,
          parse: (raw) => wrapper.safeParse(raw),
          maxTokens: 16000,
        });
        tokens += t;
        await putRunFile(userId, runId, `05-spec-${mode}.json`, JSON.stringify(data.spec, null, 2), "application/json");
        await putRunFile(userId, runId, `05-review-${mode}.json`, JSON.stringify({ review: data.review, redesign_log: data.redesign_log }, null, 2), "application/json");
        const blockers = data.review.filter((r) => r.severity === "blocker");
        result = { review: data.review, redesign_log: data.redesign_log, blockers: blockers.length };
        break;
      }

      case "render": {
        if (!mode) throw new Error("mode required");
        const specText = await getRunFile(userId, runId, `05-spec-${mode}.json`);
        if (!specText) throw new Error("reviewed spec missing — run review first");
        const raw = JSON.parse(specText);
        if (mode === "minutes") {
          const spec = minutesSpec.parse(raw);
          const { buffer, estPages, overBudget } = await renderMinutes(spec);
          if (overBudget) throw new Error(`minutes estimated at ${estPages} pages > 10-page budget — regenerate with compression`);
          const name = `${sanitize(spec.meta.title)}.docx`;
          const blob = await putRunFile(userId, runId, `deliverables/${name}`, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
          manifest.deliverables.push({ mode, name, url: blob.url, at: new Date().toISOString() });
          result = { name, url: blob.url, estPages };
        } else {
          const spec = deckSpec.parse(raw);
          const { buffer, warnings } = await renderDeck(spec);
          const name = `${sanitize(spec.meta.title)}.pptx`;
          const blob = await putRunFile(userId, runId, `deliverables/${name}`, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
          manifest.deliverables.push({ mode, name, url: blob.url, at: new Date().toISOString() });
          result = { name, url: blob.url, warnings };
        }
        break;
      }
    }

    manifest.stages[mode ? `${stage}:${mode}` : stage] = { status: "done", at: new Date().toISOString() };
    manifest.tokens_used += tokens;
    await saveManifest(userId, runId, manifest);
    return NextResponse.json({ ok: true, stage, tokens, result });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown error";
    manifest.stages[mode ? `${stage}:${mode}` : stage] = { status: "error", at: new Date().toISOString(), detail };
    await saveManifest(userId, runId, manifest);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

function sanitize(name: string): string {
  return name.replace(/[^\w\- ]/g, "").trim().replace(/ +/g, "-") || "deliverable";
}
