# Deck Spec Schema (JSON)

Contract between the McKinsey/UI-UX agents and `scripts/build_pptx.py`.
File name: `workspace/NN-mckinsey-deckspec.json` (draft) → rendered from the
UI/UX-approved version.

## Top level

```json
{
  "meta": {
    "title": "string — deck title",
    "subtitle": "string (optional)",
    "author": "string (optional)",
    "date": "YYYY-MM-DD",
    "audience": "c-suite | technical",
    "template": "string (optional) — filename in templates/, e.g. company.pptx",
    "run_id": "string — pipeline run id"
  },
  "charts": [ ChartSpec, ... ],
  "slides": [ SlideSpec, ... ]
}
```

Renderer resolves `meta.template`: if set and `templates/<name>` exists, use it as
base; else first `templates/*.pptx`; else built-in neutral style.

## ChartSpec (rendered first by `build_charts.py` → PNG in `deliverables/charts/`)

```json
{
  "id": "string — unique, referenced by chart slides",
  "type": "bar | barh | line | pie | venn2 | venn3 | gantt | swot",
  "title": "string",
  "data": { ... type-specific, see below },
  "caption": "string (optional) — source note shown under chart"
}
```

Type-specific `data`:

| type | data shape |
|------|-----------|
| bar / barh / line | `{"labels": [..], "series": [{"name": "..", "values": [..]}, ..]}` |
| pie | `{"labels": [..], "values": [..]}` |
| venn2 / venn3 | `{"sets": ["A","B"(,"C")], "overlap_label": ".."}` (illustrative circles + labels, not proportional) |
| gantt | `{"tasks": [{"name": "..", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "group": ".." (optional)}]}` |
| swot | `{"strengths": [..], "weaknesses": [..], "opportunities": [..], "threats": [..]}` |

## SlideSpec

Every slide carries **one message** (`headline` = the takeaway, full sentence,
Pyramid Principle style). Types:

```json
{"type": "title"}                      // uses meta.title/subtitle/author/date
{"type": "agenda",   "items": [".."]}
{"type": "content",  "headline": "..", "bullets": ["..", {"text": "..", "sub": [".."]}], "notes": ".." }
{"type": "two_column","headline": "..", "left": {"title": "..", "bullets": [..]}, "right": {"title": "..", "bullets": [..]}}
{"type": "chart",    "headline": "..", "chart_id": "..", "takeaway": ".. (optional, below chart)"}
{"type": "table",    "headline": "..", "columns": [".."], "rows": [[".."]]}
{"type": "swot",     "headline": "..", "chart_id": "id of a swot chart"}   // rendered as native 2×2 grid, chart data reused
{"type": "closing",  "headline": "..", "call_to_action": "..", "next_steps": [".."]}
```

`notes` (optional on any slide) → speaker notes.

## Rules

- ≤ 6 bullets per slide, ≤ 12 words per bullet (renderer warns, does not block).
- Headline is a message ("Churn doubles without action"), never a label ("Churn").
- All chart_ids must exist in `charts`. Renderer fails loudly on dangling refs.
- Intermediate spec keeps `[src: ...]` tags in a per-slide `"sources": [".."]`
  array (renderer puts them in speaker notes, never on the slide face).
