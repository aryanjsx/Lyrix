import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { motion } from "framer-motion";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-800/60">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-500"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-zinc-100">Page not found</h1>
          <p className="mb-6 max-w-sm text-sm text-zinc-400">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link
            href="/"
            className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            Go home
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
