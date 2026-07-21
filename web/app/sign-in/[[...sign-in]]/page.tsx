import { SignIn } from "@clerk/nextjs";
import { clerkConfigured } from "@/lib/config";

export default function SignInPage() {
  if (!clerkConfigured) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Sign-in is not configured yet — see the setup steps on the home page.
      </p>
    );
  }
  return (
    <div className="flex justify-center py-12">
      <SignIn />
    </div>
  );
}
