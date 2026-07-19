# Deploying to Vercel

Prerequisite decisions are already made: Next.js app in `web/`, Clerk auth,
Vercel Blob storage, Claude API backend. One thing only you can do: create the
API keys. Steps:

## 1. Anthropic API key (the deploy gate)

1. Go to https://console.anthropic.com → API Keys → Create key.
2. **Set a monthly spend limit first** (Settings → Limits — e.g. $20/month).
3. Cost expectation: a full run (upload → analyze → deck) uses roughly
   50–150k tokens ≈ **$0.30–1.50** with `claude-sonnet-5`.

## 2. Clerk application

1. https://dashboard.clerk.com → Create application (enable Email + Google).
2. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
3. Team access later: Clerk dashboard → Users → invite.

## 3. Vercel project

1. https://vercel.com/new → Import `SlayyyyTheCode/Mult-Agent-Orchestrator`.
2. **Root Directory: `web`** (critical — the repo root is not the app).
3. Storage tab → Create **Blob** store → connect to the project
   (this injects `BLOB_READ_WRITE_TOKEN` automatically).
4. Environment variables (Project → Settings → Environment Variables):
   - `ANTHROPIC_API_KEY` = sk-ant-…
   - `CLAUDE_MODEL` = claude-sonnet-5 (optional, this is the default)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = pk_…
   - `CLERK_SECRET_KEY` = sk_…
   - `ALLOWED_EMAILS` = your@email.com (comma-separated for teammates —
     **required**: production fails closed without it, so a stranger who signs
     up can never spend your Claude tokens)
5. Deploy.

## Abuse guardrails (already enforced in code)

- **Email allowlist** (`ALLOWED_EMAILS`) — every API route checks it; unknown
  accounts get 403 before any Claude call or storage access.
- **Per-run token budget** (`MAX_TOKENS_PER_RUN`, default 300k) — a run that
  hits its budget gets 429 on further Claude stages.
- **Upload caps** — 20 MB/file, `MAX_FILES_PER_RUN` (default 20) files.
- **Private storage** — all blobs are private; deliverables download only
  through the authenticated `/api/runs/[id]/download` route.
- Also recommended: Clerk dashboard → Restrictions → disable open sign-ups
  (invite-only), and an Anthropic console monthly spend limit.

## 4. Function duration

Pipeline stages call Claude with large documents; a stage can take 1–4 minutes.
`maxDuration = 300` is set on the pipeline route. On the **Hobby plan** with
Fluid Compute (default for new projects) this is allowed; if a stage times out,
upgrade to Pro or split large uploads across runs.

## 5. Smoke test

1. Open the deployed URL → sign in.
2. New run → upload a small .docx + a .txt transcript.
3. Analyze → expect Ingest ✓ Organize ✓ Validate ✓, key points with H/M/L
   badges, and the "Needs human review" panel.
4. C-suite deck → download the .pptx → open in PowerPoint.

## Local development

```bash
cd web
cp .env.example .env.local   # fill in real values
npm run dev
```

Blob locally: create a Blob store once in Vercel, then `npx vercel env pull
.env.local` to fetch its token — or paste the token by hand.
