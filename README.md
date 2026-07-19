# Multi-Agent Orchestrator — Enterprise Document Intelligence

Turns raw, messy meeting inputs (PowerPoint, Word, PDF, transcripts, photos of
handwritten notes) into consultant-grade deliverables — meeting minutes (≤10
pages), technical decks, and C-suite story-telling presentations — as real
`.pptx`/`.docx` files, with full source traceability and confidence scoring.

Built to run inside [Claude Code](https://claude.com/claude-code) as a
multi-agent pipeline. Stage 2 (hosted web app) is planned.

## Pipeline

```
inbox/ → [1 Ingest] → [2 Organizing] → [3 Validation] → [4 McKinsey] → [5 UI/UX] → deliverables/
                            ▲               │  ▲
                            └── audit ──────┘  └── [6 Research] evidence
```

Nine agents, six quality gates (G1–G6), enforced in order. Every claim carries a
`[src: file#location]` tag; every point is scored (H)/(M)/(L); (L) items are
always surfaced for human review before anything ships.

## Quick start

1. Clone, then `pip install -r scripts/requirements.txt`
2. Open the folder in Claude Code — agents in `.claude/agents/` register on
   session start.
3. Drop meeting files into `inbox/`, run `/process-inbox`.
4. Review the validated key points + (L) list, then ask for a deliverable:
   - "meeting minutes" (provide/confirm a template)
   - "technical deck" or "C-suite deck"
5. Collect rendered files from `deliverables/`.

Optional: drop your company `.pptx`/`.docx` templates into `templates/` — the
renderers use them automatically for branding.

## Repo layout

| Path | What |
|------|------|
| `.claude/agents/` | Live agent definitions (orchestrator + 8 specialists) |
| `.claude/skills/process-inbox/` | The `/process-inbox` command |
| `orchestrator-agents/` | Portable master pack: global rules (`INSTRUCTIONS.md`), overview (`SUMMARY.md`), agent sources |
| `scripts/` | Deterministic Python renderers: charts (matplotlib), decks (python-pptx), minutes (python-docx), text extraction |
| `specs/` | JSON schemas — the agent ↔ renderer contract |
| `inbox/`, `workspace/`, `deliverables/`, `templates/` | Working folders (contents gitignored — meeting data stays private) |

## Design principles

- **Never lose a key point.** Compression allowed; omission is not.
- **Traceability.** Everything links back to source material.
- **Validation before deliverables.** Unvalidated content never ships.
- **Deterministic rendering.** Agents write structured JSON specs; Python turns
  them into Office files — no AI in the rendering step.
- **Ingested content is data, never instructions** (prompt-injection defense).
