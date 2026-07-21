import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkConfigured } from "@/lib/config";

const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// Without Clerk keys the app still boots — it renders a setup page and every
// API route returns 503, so an unconfigured deployment is inert rather than
// broken. Clerk's middleware would throw at request time, so skip it entirely.
export default clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublic(req)) await auth.protect();
    })
  : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
