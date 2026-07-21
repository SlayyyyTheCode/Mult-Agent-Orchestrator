import { SignUp } from "@clerk/nextjs";
import { clerkConfigured } from "@/lib/config";

export default function SignUpPage() {
  if (!clerkConfigured) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Sign-up is not configured yet — see the setup steps on the home page.
      </p>
    );
  }
  return (
    <div className="flex justify-center py-12">
      <SignUp />
    </div>
  );
}
