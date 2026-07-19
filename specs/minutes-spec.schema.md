# Minutes Spec Schema (JSON)

Contract between the McKinsey/UI-UX agents and `scripts/build_docx.py`.
File name: `workspace/NN-mckinsey-minutesspec.json`.

## Top level

```json
{
  "meta": {
    "title": "string — meeting title",
    "date": "YYYY-MM-DD",
    "time": "string (optional)",
    "location": "string (optional)",
    "author": "string (optional)",
    "template": "string (optional) — filename in templates/, e.g. company.docx",
    "run_id": "string"
  },
  "attendees": [{"name": "..", "role": ".. (optional)", "present": true}],
  "agenda": ["item", ...],
  "sections": [
    {
      "heading": "string",
      "summary": "string — 1-3 sentence section takeaway",
      "points": [
        {"text": "string", "confidence": "H | M | L", "sources": ["file#loc"]}
      ]
    }
  ],
  "decisions": [{"text": "..", "owner": ".. (optional)"}],
  "actions": [{"text": "..", "owner": "..", "due": "YYYY-MM-DD | TBD"}],
  "review_items": [{"text": "..", "reason": "why (L)"}],
  "appendix_sources": ["original input filenames"]
}
```

## Rendering rules (`build_docx.py`)

- Template resolution: `meta.template` in `templates/` → first `templates/*.docx` → built-in clean style.
- Order: title block → attendees table → agenda → sections → decisions →
  actions table (text / owner / due) → "Needs human review" box (review_items,
  only if non-empty) → sources appendix.
- `(L)` points rendered with a trailing "(L)" marker; H/M markers omitted in
  final doc (kept in JSON for traceability).
- Hard budget: renderer counts pages after build; > 10 pages → exit non-zero
  with page count so the agent must compress and re-render.
- Source tags go to the appendix, not inline.
