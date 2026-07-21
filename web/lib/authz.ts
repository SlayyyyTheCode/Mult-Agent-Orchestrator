import { auth, currentUser } from "@clerk/nextjs/server";
import { allowlist, billingMode, clerkConfigured } from "./config";

/**
 * Access control beyond "is signed in".
 *
 * Two supported deployments (see `billingMode` in config.ts):
 *  - owner mode — ALLOWED_EMAILS lists the accounts permitted to use the app;
 *    they may fall back to the owner's ANTHROPIC_API_KEY.
 *  - BYOK mode  — no allowlist and no owner key: any signed-in user may run the
 *    pipeline with their own Anthropic key, so the owner is never billed.
 *
 * The third combination — no allowlist but an owner key present — is refused,
 * because it would let any stranger who signs up spend the owner's credits.
 */
export type AuthzResult = { ok: true; userId: string } | { ok: false; status: number; error: string };

export const SETUP_REQUIRED =
  "This deployment is not configured yet. Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in the Vercel project settings, then redeploy.";

export async function requireUser(): Promise<AuthzResult> {
  if (!clerkConfigured) return { ok: false, status: 503, error: SETUP_REQUIRED };

  const { userId } = await auth();
  if (!userId) return { ok: false, status: 401, error: "unauthorized" };

  const mode = billingMode();
  if (mode === "closed") {
    return {
      ok: false,
      status: 403,
      error:
        "Access is closed: ANTHROPIC_API_KEY is set but ALLOWED_EMAILS is empty, which would let any account spend the owner's credits. Set ALLOWED_EMAILS, or remove ANTHROPIC_API_KEY to run in bring-your-own-key mode.",
    };
  }
  if (mode === "byok") return { ok: true, userId }; // no owner key exists to burn

  const emails = allowlist();
  const user = await currentUser();
  const mine = (user?.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase());
  if (!mine.some((e) => emails.includes(e))) {
    return { ok: false, status: 403, error: "this account is not authorized to use the app" };
  }
  return { ok: true, userId };
}

/**
 * Resolve which Anthropic key pays for this request.
 *
 * A user-supplied key always wins, and is used transiently — never written to
 * storage, never logged, never echoed back. The owner's env key is only a
 * fallback for allowlisted accounts (owner mode).
 */
export function resolveApiKey(headerKey: string | null): { ok: true; apiKey: string } | { ok: false; error: string } {
  const supplied = headerKey?.trim();
  if (supplied) {
    if (!supplied.startsWith("sk-ant-")) {
      return { ok: false, error: "that doesn't look like an Anthropic API key (expected it to start with 'sk-ant-')" };
    }
    return { ok: true, apiKey: supplied };
  }
  if (billingMode() === "owner" && process.env.ANTHROPIC_API_KEY) {
    return { ok: true, apiKey: process.env.ANTHROPIC_API_KEY };
  }
  return {
    ok: false,
    error: "No Anthropic API key. Add your own key in the app (it stays in your browser and is never stored on the server).",
  };
}

/** Per-run Claude token budget — hard stop against runaway spend. */
export const MAX_TOKENS_PER_RUN = Number(process.env.MAX_TOKENS_PER_RUN ?? 300_000);
export const MAX_FILES_PER_RUN = Number(process.env.MAX_FILES_PER_RUN ?? 20);
