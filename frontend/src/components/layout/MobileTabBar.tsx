import Link from "next/link";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useLyrixStore } from "@/store";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { useAuth } from "@/hooks/useAuth";

const TABS = [
  {
    href: "/",
    label: "Home",
    match: (path: string) => path === "/" || path.startsWith("/?"),
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    match: (path: string) => path === "/search",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: "/playlists",
    label: "Library",
    match: (path: string) => path.startsWith("/playlists") || path === "/history",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h16M4 18h7" /><path d="M17 18V12l4-2v8" />
      </svg>
    ),
  },
];

export function MobileTabBar() {
  const router = useRouter();
  const current = useLyrixStore((s) => s.queue.current);
  const status = useLyrixStore((s) => s.player.status);
  const { isLoggedIn, login } = useAuth();
  const hasTrack = current !== null || status !== "idle";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[90] sm:hidden"
      style={{
        background: "var(--nav-bg)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderTop: "1px solid var(--nav-border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around px-2 py-1.5">
        {TABS.map((tab) => {
          const active = tab.match(router.pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              className="flex flex-col items-center gap-0.5 px-3 py-1"
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <motion.span
                animate={active ? { scale: 1 } : { scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  background: active ? "rgba(167, 139, 250, 0.12)" : "transparent",
                }}
              >
                {tab.icon()}
              </motion.span>
              <span
                className="text-[10px] font-medium"
                style={{
                  fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* 4th tab: Now Playing (logged in + track active) OR Sign In (not logged in) */}
        {!isLoggedIn ? (
          <button
            onClick={login}
            className="flex flex-col items-center gap-0.5 px-3 py-1"
            aria-label="Sign in with Google"
          >
            <motion.span
              animate={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "transparent" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </motion.span>
            <span
              className="text-[10px] font-medium"
              style={{
                fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                color: "var(--text-muted)",
              }}
            >
              Sign in
            </span>
          </button>
        ) : hasTrack ? (
          <Link
            href="/now-playing"
            prefetch={true}
            className="flex flex-col items-center gap-0.5 px-3 py-1"
            aria-label="Now Playing"
            aria-current={router.pathname === "/now-playing" ? "page" : undefined}
          >
            <motion.span
              animate={router.pathname === "/now-playing" ? { scale: 1 } : { scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden"
              style={{
                background: router.pathname === "/now-playing" ? "rgba(167, 139, 250, 0.12)" : "transparent",
              }}
            >
              {current?.thumbnail ? (
                <div className="h-6 w-6 overflow-hidden rounded-md">
                  <TrackThumbnail
                    src={current.thumbnail}
                    alt=""
                    width={24}
                    height={24}
                    style={{ objectFit: "cover" }}
                  />
                  {status === "playing" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex items-end gap-[2px]">
                        <span className="inline-block w-[2px] animate-pulse rounded-sm bg-purple-400" style={{ height: 5, animationDelay: "0ms" }} />
                        <span className="inline-block w-[2px] animate-pulse rounded-sm bg-purple-400" style={{ height: 8, animationDelay: "150ms" }} />
                        <span className="inline-block w-[2px] animate-pulse rounded-sm bg-purple-400" style={{ height: 4, animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: router.pathname === "/now-playing" ? "var(--accent)" : "var(--text-muted)" }}>
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              )}
            </motion.span>
            <span
              className="text-[10px] font-medium"
              style={{
                fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                color: router.pathname === "/now-playing" ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              Playing
            </span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
