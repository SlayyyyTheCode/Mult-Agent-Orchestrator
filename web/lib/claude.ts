import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

export interface ClaudeResult {
  text: string;
  tokens: number;
}

export async function callClaude(opts: {
  system: string;
  user: string | Anthropic.MessageParam["content"];
  maxTokens?: number;
}): Promise<ClaudeResult> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8192,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, tokens: msg.usage.input_tokens + msg.usage.output_tokens };
}

/**
 * Call Claude expecting a JSON document; validate with `parse`.
 * On failure, retry ONCE with the validation defects appended
 * (mirrors the Stage-1 orchestrator's one-retry-with-defect-list rule).
 */
export async function callClaudeJson<T>(opts: {
  system: string;
  user: string;
  parse: (raw: unknown) => { success: true; data: T } | { success: false; error: { message: string } };
  maxTokens?: number;
}): Promise<{ data: T; tokens: number }> {
  let tokens = 0;
  let prompt = opts.user;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callClaude({ system: opts.system, user: prompt, maxTokens: opts.maxTokens });
    tokens += res.tokens;
    const raw = extractJson(res.text);
    if (raw !== null) {
      const parsed = opts.parse(raw);
      if (parsed.success) return { data: parsed.data, tokens };
      lastError = parsed.error.message;
    } else {
      lastError = "response contained no parseable JSON object";
    }
    prompt =
      opts.user +
      `\n\nYour previous response failed validation with these defects:\n${lastError}\n` +
      `Return ONLY the corrected JSON object, no prose.`;
  }
  throw new Error(`Claude JSON output failed validation after retry: ${lastError}`);
}

/** Pull the first top-level JSON object out of a response (handles ```json fences and surrounding prose). */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(c.slice(start, end + 1));
    } catch {
      /* try next candidate */
    }
  }
  return null;
}
