import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Document Intelligence",
  description: "Multi-agent pipeline: meeting inputs to consultant-grade deliverables",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
              <Link href="/" className="font-semibold tracking-tight">
                Document&nbsp;Intelligence
              </Link>
              <UserButton />
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
