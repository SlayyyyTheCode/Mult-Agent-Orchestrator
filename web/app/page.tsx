import { clerkConfigured, ownerKeyConfigured } from "@/lib/config";
import Dashboard from "./dashboard";

// Rendered per request so newly-added environment variables take effect on the
// next request rather than being baked into a prerendered page.
export const dynamic = "force-dynamic";

/**
 * A deployment with no Clerk keys still serves this page — it explains what is
 * missing instead of crashing, so the URL is live from the first deploy.
 */
function SetupRequired() {
  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: "Create a Clerk application",
      body: (
        <>
          At <span className="font-mono">dashboard.clerk.com</span>, create an application and enable Email
          and Google. Copy the publishable key and the secret key.
        </>
      ),
    },
    {
      title: "Add both keys in Vercel",
      body: (
        <>
          Project → Settings → Environment Variables:
          <span className="mt-2 block font-mono text-xs">
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_…
            <br />
            CLERK_SECRET_KEY = sk_…
          </span>
        </>
      ),
    },
    {
      title: "Redeploy",
      body: <>Deployments → latest → Redeploy. This page is replaced by the app.</>,
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Setup required</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          The app is deployed and healthy — it just needs sign-in configured before anyone can use it.
        </p>
      </section>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {i + 1}
            </span>
            <span>
              <span className="block font-medium">{s.title}</span>
              <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <section className="rounded-xl border border-blue-300 bg-blue-50 p-5 text-sm dark:border-blue-900 dark:bg-blue-950/40">
        <p className="font-medium text-blue-900 dark:text-blue-200">About Claude API costs</p>
        <p className="mt-1 text-blue-800 dark:text-blue-300">
          You do not need to add an Anthropic key. With none set, the app runs in bring-your-own-key mode:
          each signed-in user supplies their own key, it is held in their browser, and the owner is never
          billed. Add <span className="font-mono">ANTHROPIC_API_KEY</span> only alongside{" "}
          <span className="font-mono">ALLOWED_EMAILS</span>, which limits who can spend it.
        </p>
      </section>
    </div>
  );
}

export default function Home() {
  if (!clerkConfigured) return <SetupRequired />;
  // With no owner key configured, every user must supply their own.
  return <Dashboard byok={!ownerKeyConfigured} />;
}
