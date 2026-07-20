// Schema-parity smoke test: renders Stage-1 (Python-pipeline) specs through the
// Stage-2 TypeScript renderers, proving both consume the same JSON contract.
//
//   npx tsx scripts/parity-test.ts                    # both, using default paths
//   npx tsx scripts/parity-test.ts deck <spec.json>
//   npx tsx scripts/parity-test.ts minutes <spec.json>
import { readFileSync, writeFileSync } from "node:fs";
import { deckSpec, minutesSpec } from "../lib/schemas";
import { renderDeck } from "../lib/render/pptx";
import { renderMinutes } from "../lib/render/docx";

const DEFAULT_DECK = "../workspace/05-uiux-deckspec.json";
const DEFAULT_MINUTES = "scripts/fixtures/minutes-spec.sample.json";

async function testDeck(path: string) {
  const spec = deckSpec.parse(JSON.parse(readFileSync(path, "utf-8")));
  console.log(`deck schema OK — ${spec.slides.length} slides, ${spec.charts.length} charts`);
  const { buffer, warnings } = await renderDeck(spec);
  writeFileSync(".parity-deck.pptx", buffer);
  console.log(`  rendered .parity-deck.pptx (${Math.round(buffer.length / 1024)} KB)`);
  if (warnings.length) console.log("  warnings:", warnings);
}

async function testMinutes(path: string) {
  const spec = minutesSpec.parse(JSON.parse(readFileSync(path, "utf-8")));
  console.log(`minutes schema OK — ${spec.sections.length} sections, ${spec.actions.length} actions`);
  const { buffer, estPages, overBudget } = await renderMinutes(spec);
  writeFileSync(".parity-minutes.docx", buffer);
  console.log(`  rendered .parity-minutes.docx (${Math.round(buffer.length / 1024)} KB, ~${estPages} pages${overBudget ? " — OVER BUDGET" : ""})`);
}

async function main() {
  const [which, path] = process.argv.slice(2);
  if (!which || which === "deck") await testDeck(path ?? DEFAULT_DECK);
  if (!which || which === "minutes") await testMinutes(which === "minutes" && path ? path : DEFAULT_MINUTES);
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
