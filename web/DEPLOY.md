# Deploying to Vercel

Next.js app in `web/`, Clerk auth, Vercel Blob storage, Claude API backend.
The app deploys and serves fine with no keys at all — it shows a setup page
until Clerk is configured. Only **step 2 (Clerk)** is required to make it usable.

## 1. Anthropic API key — who pays for Claude

There are two supported arrangements. The app picks one from your env vars:

| Arrangement | Env vars | Who pays |
|---|---|---|
| **Bring your own key** (default) | neither `ANTHROPIC_API_KEY` nor `ALLOWED_EMAILS` | Each signed-in user enters their own key in the app. It lives in their browser tab and is sent per request — the server never stores it, and **you are never billed**. |
| **Owner pays, private** | both `ANTHROPIC_API_KEY` and `ALLOWED_EMAILS` | Only the listed emails may sign in, and they may spend your credits. |

Setting `ANTHROPIC_API_KEY` **without** `ALLOWED_EMAILS` is refused at runtime —
that combination would let any stranger who signs up spend your credits.

If you do add your own key: https://console.anthropic.com → API Keys, and set a
monthly spend limit first (Settings → Limits, e.g. $20). A full run (upload →
analyze → deck) uses roughly 50–150k tokens ≈ **$0.30–1.50** with `claude-sonnet-5`.

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
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = pk_… **(required)**
   - `CLERK_SECRET_KEY` = sk_… **(required)**
   - `CLAUDE_MODEL` = claude-sonnet-5 (optional, this is the default)
   - `ANTHROPIC_API_KEY` + `ALLOWED_EMAILS` — only if you want to pay for your
     team's runs; see the table in step 1. Leave both unset for bring-your-own-key.
5. Deploy.

## Abuse guardrails (already enforced in code)

- **Bring-your-own-key by default** — with no `ANTHROPIC_API_KEY` set, there is
  no owner credential for anyone to spend; each user supplies their own, held in
  their browser and never written to the server.
- **Email allowlist** (`ALLOWED_EMAILS`) — when set, every API route checks it;
  unknown accounts get 403 before any Claude call or storage access. Required
  whenever `ANTHROPIC_API_KEY` is set.
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
