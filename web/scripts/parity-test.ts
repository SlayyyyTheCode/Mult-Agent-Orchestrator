// Schema-parity smoke test: renders a Stage-1 (Python-pipeline) deck spec
// through the Stage-2 TS renderer. Usage:
//   npx tsx scripts/parity-test.ts [path-to-deckspec.json]
import { readFileSync, writeFileSync } from "node:fs";
import { deckSpec } from "../lib/schemas";
import { renderDeck } from "../lib/render/pptx";

async function main() {
  const specPath = process.argv[2] ?? "../workspace/05-uiux-deckspec.json";
  const raw = JSON.parse(readFileSync(specPath, "utf-8"));
  const spec = deckSpec.parse(raw);
  console.log("schema: OK —", spec.slides.length, "slides,", spec.charts.length, "charts");
  const { buffer, warnings } = await renderDeck(spec);
  const out = ".parity-test.pptx";
  writeFileSync(out, buffer);
  console.log("rendered:", out, `(${Math.round(buffer.length / 1024)} KB)`);
  if (warnings.length) console.log("warnings:", warnings);
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
