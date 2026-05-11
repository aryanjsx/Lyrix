import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback } from "react";
import { useLyrixStore } from "@/store";
import { LoginButton } from "@/components/auth/LoginButton";
import { UserAvatar } from "@/components/auth/UserAvatar";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    match: (path: string) => path === "/" || path.startsWith("/?"),
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: "/playlists",
    label: "Library",
    match: (path: string) => path.startsWith("/playlists") || path === "/history",
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h16M4 18h7" /><path d="M17 18V12l4-2v8" />
      </svg>
    ),
  },
];

function LogoIcon() {
  return (
    <img
      src="/logo.png"
      alt="Lyrix"
      width={24}
      height={24}
      className="logo-icon rounded-sm"
    />
  );
}

export function SiteHeader() {
  const router = useRouter();
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const prefetchRoute = useCallback(
    (href: string) => { void router.prefetch(href); },
    [router]
  );

  return (
    <>
      {/* Desktop + Tablet Top Bar */}
      <header
        className="fixed left-0 right-0 top-0 z-[100]"
        style={{
          height: 56,
          background: "var(--nav-bg)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderBottom: "1px solid var(--nav-border)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div className="mx-auto flex h-full max-w-[1920px] items-center px-6">
          {/* ZONE 1 — Logo (220px on desktop, auto on mobile) */}
          <div className="flex flex-shrink-0 items-center sm:w-[220px]">
            <Link
              href="/"
              className="group flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-lg"
            >
              <span
                className="transition-all duration-250"
                style={{ filter: "drop-shadow(0 0 6px var(--accent-glow))" }}
              >
                <LogoIcon />
              </span>
              <span
                className="hidden text-lg font-bold tracking-tight lg:inline"
                style={{
                  fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                  color: "var(--text-primary)",
                  letterSpacing: "-0.02em",
                }}
              >
                Lyrix
              </span>
            </Link>
          </div>

          {/* Mobile center — Logo text */}
          <div className="flex flex-1 items-center justify-center sm:hidden">
            <span
              className="text-lg font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Lyrix
            </span>
          </div>

          {/* ZONE 2 — Nav Links (centered, flex-1, hidden on mobile) */}
          <nav className="hidden flex-1 items-center justify-center gap-1 sm:flex" role="navigation" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const active = item.match(router.pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className="relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150"
                  style={{
                    fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    background: active ? "var(--nav-hover-bg)" : "transparent",
                  }}
                  aria-current={active ? "page" : undefined}
                  onMouseEnter={(e) => {
                    prefetchRoute(item.href);
                    if (!active) {
                      e.currentTarget.style.color = "var(--text-primary)";
                      e.currentTarget.style.background = "var(--nav-hover-bg)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.color = "var(--text-secondary)";
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <span className="hidden lg:inline">{item.icon()}</span>
                  <span className="lg:hidden">{item.icon()}</span>
                  <span className="hidden lg:inline">{item.label}</span>
                  {active && (
                    <span
                      className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ZONE 3 — Actions (hidden on mobile, sign-in is in tab bar) */}
          <div className="hidden flex-shrink-0 items-center justify-end gap-2 sm:flex">
            {isLoggedIn ? <UserAvatar /> : <LoginButton />}
          </div>

          {/* Mobile right — avatar only (when logged in) */}
          <div className="flex flex-shrink-0 items-center sm:hidden">
            {isLoggedIn && <UserAvatar />}
          </div>
        </div>
      </header>

      {/* Spacer to prevent content from going under fixed header */}
      <div className="hidden h-14 sm:block" />

      {/* Mobile bottom tab bar is in MobileTabBar.tsx */}
    </>
  );
}
