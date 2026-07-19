import { z } from "zod";

// Mirrors specs/deck-spec.schema.md and specs/minutes-spec.schema.md —
// the same JSON contract the Stage-1 Python renderers consume.

export const chartSpec = z.object({
  id: z.string().min(1),
  type: z.enum(["bar", "barh", "line", "pie", "venn2", "venn3", "gantt", "swot"]),
  title: z.string(),
  data: z.record(z.string(), z.any()),
  caption: z.string().optional(),
});
export type ChartSpec = z.infer<typeof chartSpec>;

const bullet = z.union([
  z.string(),
  z.object({ text: z.string(), sub: z.array(z.string()).optional() }),
]);

const slideBase = { notes: z.string().optional(), sources: z.array(z.string()).optional() };

export const slideSpec = z.discriminatedUnion("type", [
  z.object({ type: z.literal("title"), ...slideBase }),
  z.object({ type: z.literal("agenda"), headline: z.string().optional(), items: z.array(z.string()), ...slideBase }),
  z.object({ type: z.literal("content"), headline: z.string(), bullets: z.array(bullet), ...slideBase }),
  z.object({
    type: z.literal("two_column"),
    headline: z.string(),
    left: z.object({ title: z.string(), bullets: z.array(bullet) }),
    right: z.object({ title: z.string(), bullets: z.array(bullet) }),
    ...slideBase,
  }),
  z.object({ type: z.literal("chart"), headline: z.string(), chart_id: z.string(), takeaway: z.string().optional(), ...slideBase }),
  z.object({ type: z.literal("table"), headline: z.string(), columns: z.array(z.string()), rows: z.array(z.array(z.string())), ...slideBase }),
  z.object({ type: z.literal("swot"), headline: z.string(), chart_id: z.string(), takeaway: z.string().optional(), ...slideBase }),
  z.object({ type: z.literal("closing"), headline: z.string(), call_to_action: z.string().optional(), next_steps: z.array(z.string()).optional(), ...slideBase }),
]);
export type SlideSpec = z.infer<typeof slideSpec>;

export const deckSpec = z
  .object({
    meta: z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      author: z.string().optional(),
      date: z.string().optional(),
      audience: z.enum(["c-suite", "technical"]).optional(),
      template: z.string().optional(),
      run_id: z.string().optional(),
    }),
    charts: z.array(chartSpec).default([]),
    slides: z.array(slideSpec).min(1),
  })
  .superRefine((deck, ctx) => {
    const ids = new Set(deck.charts.map((c) => c.id));
    deck.slides.forEach((s, i) => {
      if ("chart_id" in s && !ids.has(s.chart_id)) {
        ctx.addIssue({
          code: "custom",
          path: ["slides", i, "chart_id"],
          message: `slide references unknown chart_id "${s.chart_id}"`,
        });
      }
    });
  });
export type DeckSpec = z.infer<typeof deckSpec>;

export const minutesSpec = z.object({
  meta: z.object({
    title: z.string(),
    date: z.string().optional(),
    time: z.string().optional(),
    location: z.string().optional(),
    author: z.string().optional(),
    template: z.string().optional(),
    run_id: z.string().optional(),
  }),
  attendees: z
    .array(z.object({ name: z.string(), role: z.string().optional(), present: z.boolean().default(true) }))
    .default([]),
  agenda: z.array(z.string()).default([]),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        summary: z.string().optional(),
        points: z.array(
          z.object({
            text: z.string(),
            confidence: z.enum(["H", "M", "L"]),
            sources: z.array(z.string()).default([]),
          })
        ),
      })
    )
    .default([]),
  decisions: z.array(z.object({ text: z.string(), owner: z.string().optional() })).default([]),
  actions: z.array(z.object({ text: z.string(), owner: z.string().optional(), due: z.string().optional() })).default([]),
  review_items: z.array(z.object({ text: z.string(), reason: z.string().optional() })).default([]),
  appendix_sources: z.array(z.string()).default([]),
});
export type MinutesSpec = z.infer<typeof minutesSpec>;

// Validation stage output — powers the keypoints UI and the (L) review panel.
export const validationSummary = z.object({
  run_id: z.string(),
  categories: z.array(
    z.object({
      name: z.string(),
      points: z.array(
        z.object({
          text: z.string(),
          confidence: z.enum(["H", "M", "L"]),
          sources: z.array(z.string()).default([]),
        })
      ),
    })
  ),
  review_items: z.array(z.object({ text: z.string(), reason: z.string() })),
  conflicts: z.array(z.string()).default([]),
  coverage_gaps: z.array(z.string()).default([]),
  verdict: z.enum(["PASS", "FAIL"]),
});
export type ValidationSummary = z.infer<typeof validationSummary>;

export const PIPELINE_STAGES = ["ingest", "organize", "validate", "generate", "review", "render"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type DeliverableMode = "deck-csuite" | "deck-technical" | "minutes";
