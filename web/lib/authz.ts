import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Access control beyond "is signed in".
 *
 * ALLOWED_EMAILS: comma-separated list of email addresses permitted to use the
 * app (the owner + invited teammates). Anyone else who manages to sign up gets
 * 403 on every API route — they can never trigger a Claude call or touch Blob.
 *
 * Fail-closed in production: if ALLOWED_EMAILS is unset on Vercel, all API
 * access is denied with a setup hint. In local dev (no VERCEL_ENV) an unset
 * allowlist permits any signed-in user.
 */
export type AuthzResult = { ok: true; userId: string } | { ok: false; status: number; error: string };

export async function requireUser(): Promise<AuthzResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, status: 401, error: "unauthorized" };

  const allowlist = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) {
    if (process.env.VERCEL_ENV === "production") {
      return { ok: false, status: 403, error: "ALLOWED_EMAILS is not configured — access is closed by default. Add your email to the ALLOWED_EMAILS env var." };
    }
    return { ok: true, userId }; // local dev convenience
  }

  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase());
  if (!emails.some((e) => allowlist.includes(e))) {
    return { ok: false, status: 403, error: "this account is not authorized to use the app" };
  }
  return { ok: true, userId };
}

/** Per-run Claude token budget — hard stop against runaway spend. */
export const MAX_TOKENS_PER_RUN = Number(process.env.MAX_TOKENS_PER_RUN ?? 300_000);
export const MAX_FILES_PER_RUN = Number(process.env.MAX_FILES_PER_RUN ?? 20);
