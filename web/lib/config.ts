// Runtime configuration probes. No SDK imports here so this is safe to pull
// into middleware, server components, and client components alike.

/** Auth is only enforceable when both Clerk keys are present. */
export const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

/** The owner's own Anthropic key. Optional — users can bring their own instead. */
export const ownerKeyConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

/** Comma-separated allowlist of emails permitted to use the app. */
export function allowlist(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Who pays for Claude tokens:
 *  - "owner"  — allowlist is set, so only trusted accounts run, and they may
 *               fall back to the owner's ANTHROPIC_API_KEY.
 *  - "byok"   — no allowlist and no owner key: anyone signed in may use the app
 *               but must supply their own key. The owner cannot be billed.
 *  - "closed" — no allowlist but an owner key IS set. Refused: that combination
 *               would let any stranger spend the owner's credits.
 */
export function billingMode(): "owner" | "byok" | "closed" {
  if (allowlist().length > 0) return "owner";
  return ownerKeyConfigured ? "closed" : "byok";
}
