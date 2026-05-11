import "@/styles/globals.css";
import "@/styles/nowplaying.css";
import type { AppProps, NextWebVitalsMetric } from "next/app";
import Head from "next/head";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { Inter, DM_Sans, DM_Serif_Display, Playfair_Display, DM_Mono } from "next/font/google";
import { LazyMotion, domAnimation, MotionConfig } from "framer-motion";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { PersistentPlayer } from "@/components/player/PersistentPlayer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Banner } from "@/components/ui/Banner";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ToastContainer } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { OnboardingModal, type OnboardingPrefs } from "@/components/onboarding/OnboardingModal";
import { AppBackground } from "@/components/layout/AppBackground";
import { useNetwork } from "@/hooks/useNetwork";
import { useSession } from "@/hooks/useSession";
import { usePlayer } from "@/hooks/usePlayer";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsOverlay } from "@/components/ui/KeyboardShortcutsOverlay";
import { useLoadingBar } from "@/hooks/useLoadingBar";
import { analytics, EVENTS } from "@/services/analyticsService";
import { hasSetPrefs, loadGuestPrefs, saveGuestPrefs } from "@/config/languages";
import { useLyrixStore } from "@/store";
import { DataModeProvider, useDataMode } from "@/context/DataModeContext";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-dm-serif",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-playfair",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-mono",
  display: "swap",
});

let analyticsInitialized = false;

export default function App({ Component, pageProps }: AppProps) {
  const network = useNetwork();
  const { pendingSeekPosition } = useSession();
  const { setPendingSeek } = usePlayer();
  const router = useRouter();
  const { startLoading, stopLoading } = useLoadingBar();

  const { showShortcuts, closeShortcuts } = useKeyboardShortcuts();

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const userProfileId = useLyrixStore((s) => s.user.profile?.id);

  useEffect(() => {
    if (!analyticsInitialized) {
      analyticsInitialized = true;
      analytics.init(!!isLoggedIn);
    }
    if (isLoggedIn && userProfileId) {
      analytics.identify(userProfileId);
    }
  }, [isLoggedIn, userProfileId]);

  useEffect(() => {
    analytics.page(router.pathname);
  }, [router.pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    handler({ matches: mq.matches } as MediaQueryListEvent);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (pendingSeekPosition !== null && pendingSeekPosition > 0) {
      setPendingSeek(pendingSeekPosition);
    }
  }, [pendingSeekPosition, setPendingSeek]);

  useEffect(() => {
    const onStart = () => startLoading();
    const onDone = () => stopLoading();
    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onDone);
    router.events.on("routeChangeError", onDone);
    return () => {
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onDone);
      router.events.off("routeChangeError", onDone);
    };
  }, [router.events, startLoading, stopLoading]);

  // Restore the user's page if the server fell back to "/" on refresh
  useEffect(() => {
    try {
      const savedPath = sessionStorage.getItem("lyrix_return_path");
      const params = new URLSearchParams(window.location.search);
      const isOAuthReturn = params.has("auth") || params.has("token");

      if (
        !isOAuthReturn &&
        savedPath &&
        savedPath !== "/" &&
        window.location.pathname === "/"
      ) {
        router.replace(savedPath);
      }
    } catch { /* sessionStorage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save current path on every navigation (including "/"), stripping OAuth params
  useEffect(() => {
    const savePath = (url: string) => {
      try {
        const qIdx = url.indexOf("?");
        if (qIdx !== -1) {
          const p = new URLSearchParams(url.slice(qIdx));
          p.delete("auth");
          p.delete("token");
          p.delete("reason");
          const qs = p.toString();
          url = url.slice(0, qIdx) + (qs ? `?${qs}` : "");
        }
        sessionStorage.setItem("lyrix_return_path", url);
      } catch { /* sessionStorage unavailable */ }
    };
    savePath(router.asPath);
    router.events.on("routeChangeComplete", savePath);
    return () => router.events.off("routeChangeComplete", savePath);
  }, [router]);

  useEffect(() => {
    if (router.pathname === "/preferences") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("auth") || params.has("token")) return;

    if (hasSetPrefs()) {
      const stored = loadGuestPrefs();
      if (stored.length > 0) {
        useLyrixStore.getState().setLanguagePrefs(stored);
      }
    } else {
      router.replace(`/preferences?return=${encodeURIComponent(router.asPath)}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showOnboarding = useLyrixStore((s) => s.preferences.showOnboarding);

  const handleOnboardingComplete = useCallback(
    (prefs: OnboardingPrefs) => {
      useLyrixStore.getState().setShowOnboarding(false);
      if (prefs.languages.length > 0) {
        useLyrixStore.getState().setLanguagePrefs(prefs.languages);
        saveGuestPrefs(prefs.languages);
      }
    },
    []
  );

  const disableAnimations = network.status === "slow" || prefersReducedMotion;

  return (
    <div className={`${inter.variable} ${dmSans.variable} ${dmSerif.variable} ${playfair.variable} ${dmMono.variable}`}>
      <Head>
        <title>Lyrix</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="description" content="Music and podcast streaming" />
      </Head>

      <DataModeProvider>
      <MotionConfig reducedMotion={disableAnimations ? "always" : "never"}>
        <LazyMotion features={domAnimation}>
          <AuthProvider>
            <AppBackground>
              <LowDataIndicator />
              <ProgressBar />
              <Banner
                message="You're offline. Reconnecting..."
                type="error"
                visible={network.status === "offline"}
              />
              <Banner
                message="Slow connection detected. Some features may be limited."
                type="warning"
                visible={network.status === "slow"}
              />

              {showOnboarding && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1rem",
                  }}
                >
                  <OnboardingModal onComplete={handleOnboardingComplete} />
                </div>
              )}

              <ErrorBoundary>
                <div className="pb-24">
                  <Component {...pageProps} />
                </div>
              </ErrorBoundary>

              <ErrorBoundary>
                <PersistentPlayer />
                <MiniPlayer />
                <MobileTabBar />
              </ErrorBoundary>
              <ToastContainer />
              <KeyboardShortcutsOverlay isOpen={showShortcuts} onClose={closeShortcuts} />
            </AppBackground>
          </AuthProvider>
        </LazyMotion>
      </MotionConfig>
      </DataModeProvider>
    </div>
  );
}

function LowDataIndicator() {
  const dataMode = useDataMode();
  if (dataMode === "full") return null;
  return (
    <div className="fixed bottom-20 right-4 z-[80] text-xs text-white/30 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      Low data mode
    </div>
  );
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (process.env.NODE_ENV !== "production") return;

  const m = metric as NextWebVitalsMetric & {
    rating?: "good" | "needs-improvement" | "poor";
    navigationType?: string;
  };

  analytics.track(EVENTS.WEB_VITAL, {
    name: m.name,
    value: m.value,
    id: m.id,
    startTime: m.startTime,
    ...(m.rating != null ? { rating: m.rating } : {}),
    ...(m.navigationType != null ? { navigationType: m.navigationType } : {}),
  });

  if (m.rating === "poor") {
    console.warn(`[Web Vital] Poor ${m.name}: ${m.value}`);
  }
}
