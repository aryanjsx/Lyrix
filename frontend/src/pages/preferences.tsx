import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { useLyrixStore } from "@/store";
import { LANGUAGES, saveGuestPrefs } from "@/config/languages";
import { GENRE_OPTIONS, getArtistsForLanguages } from "@/data/onboardingData";
import { saveUserPreferences } from "@/services/preferencesApi";
import { fetchWithAuth } from "@/services/fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

export default function Preferences() {
  const router = useRouter();
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const currentLangs = useLyrixStore((s) => s.preferences.languages);
  const setLanguagePrefs = useLyrixStore((s) => s.setLanguagePrefs);

  const [step, setStep] = useState(0);
  const [languages, setLanguages] = useState<string[]>(() => [...currentLangs]);
  const [genres, setGenres] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("lyrix_user_prefs");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed?.genres)) return parsed.genres;
      }
    } catch { /* ignore */ }
    return [];
  });
  const [artists, setArtists] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("lyrix_user_prefs");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed?.artists)) return parsed.artists;
      }
    } catch { /* ignore */ }
    return [];
  });
  const [artistSearch, setArtistSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const languageArtists = useMemo(
    () => getArtistsForLanguages(languages),
    [languages]
  );

  const filteredArtists = useMemo(
    () =>
      languageArtists.filter(
        (a) =>
          !artistSearch ||
          a.toLowerCase().includes(artistSearch.toLowerCase())
      ),
    [languageArtists, artistSearch]
  );

  const steps = [
    {
      title: "What languages do you listen in?",
      subtitle:
        "Pick all that apply — we'll personalize your experience",
      canProceed: languages.length >= 1,
    },
    {
      title: "What are your favourite genres?",
      subtitle: "Choose at least 3 to help us find the right music",
      canProceed: genres.length >= 3,
    },
    {
      title: "Pick some artists you love",
      subtitle: "Choose at least 3 — or search for anyone",
      canProceed: artists.length >= 3,
    },
  ];

  const current = steps[step];

  const handleSave = async () => {
    if (languages.length === 0) return;
    setSaving(true);

    try {
      setLanguagePrefs(languages);
      saveGuestPrefs(languages);

      try {
        localStorage.setItem(
          "lyrix_user_prefs",
          JSON.stringify({ languages, genres, artists })
        );
      } catch { /* ignore */ }

      if (isLoggedIn) {
        await Promise.allSettled([
          saveUserPreferences(languages),
          fetchWithAuth(`${API_URL}/api/onboarding/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ languages, genres, artists }),
          }),
        ]);
      }

      const returnTo = router.query.return as string | undefined;
      router.replace(returnTo ?? "/");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Preferences - Lyrix</title>
      </Head>

      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Header icon */}
          <div className="mb-3 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-900/30">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          </div>

          {/* Step indicator */}
          <div className="mb-6 flex justify-center gap-2">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (i < step) setStep(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= step
                    ? "w-8 bg-purple-500"
                    : "w-4 cursor-default bg-white/15"
                } ${i < step ? "cursor-pointer hover:bg-purple-400" : ""}`}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="mb-2 text-center text-2xl font-bold text-white">
                {current.title}
              </h1>
              <p className="mb-8 text-center text-sm text-zinc-400">
                {current.subtitle}
              </p>

              {/* Step 1: Languages */}
              {step === 0 && (
                <div className="mb-8 flex flex-wrap justify-center gap-3">
                  {LANGUAGES.map((lang, i) => {
                    const isSelected = languages.includes(lang.id);
                    return (
                      <motion.button
                        key={lang.id}
                        type="button"
                        onClick={() =>
                          setLanguages(toggle(languages, lang.id))
                        }
                        className={`relative rounded-full border px-5 py-2.5 text-sm font-medium transition-all ${
                          isSelected
                            ? "border-purple-500 bg-purple-500/20 text-white shadow-md shadow-purple-500/10"
                            : "border-zinc-700/60 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                        }`}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.3,
                          delay: i * 0.015,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        whileTap={{ scale: 0.93 }}
                      >
                        <span className="mr-1.5 text-xs opacity-60">
                          {lang.script}
                        </span>
                        {lang.label}
                        {isSelected && (
                          <motion.span
                            className="ml-2 inline-block text-purple-300"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 25,
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </motion.span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Step 2: Genres */}
              {step === 1 && (
                <div className="mb-8 flex flex-wrap justify-center gap-3">
                  {GENRE_OPTIONS.map((genre, i) => {
                    const isSelected = genres.includes(genre.id);
                    return (
                      <motion.button
                        key={genre.id}
                        type="button"
                        onClick={() =>
                          setGenres(toggle(genres, genre.id))
                        }
                        className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-all ${
                          isSelected
                            ? "border-purple-500 bg-purple-500/20 text-white shadow-md shadow-purple-500/10"
                            : "border-zinc-700/60 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                        }`}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.3,
                          delay: i * 0.025,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        whileTap={{ scale: 0.93 }}
                      >
                        {genre.label}
                        {isSelected && (
                          <motion.span
                            className="ml-2 inline-block text-purple-300"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 25,
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </motion.span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Step 3: Artists */}
              {step === 2 && (
                <div className="mb-8">
                  <input
                    type="text"
                    placeholder="Search artists..."
                    value={artistSearch}
                    onChange={(e) => setArtistSearch(e.target.value)}
                    className="mb-4 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-purple-500"
                    autoComplete="off"
                  />
                  <div className="flex flex-wrap justify-center gap-3">
                    {filteredArtists.map((artist, i) => {
                      const isSelected = artists.includes(artist);
                      return (
                        <motion.button
                          key={artist}
                          type="button"
                          onClick={() =>
                            setArtists(toggle(artists, artist))
                          }
                          className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-all ${
                            isSelected
                              ? "border-purple-500 bg-purple-500/20 text-white shadow-md shadow-purple-500/10"
                              : "border-zinc-700/60 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                          }`}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.3,
                            delay: i * 0.015,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          whileTap={{ scale: 0.93 }}
                        >
                          {artist}
                          {isSelected && (
                            <motion.span
                              className="ml-2 inline-block text-purple-300"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 25,
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </motion.span>
                          )}
                        </motion.button>
                      );
                    })}
                    {filteredArtists.length === 0 && (
                      <p className="py-4 text-sm text-zinc-500">
                        No artists found for &ldquo;{artistSearch}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex w-full max-w-xs items-center justify-between gap-3">
              {step > 0 ? (
                <motion.button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="rounded-full border border-zinc-700/60 px-5 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
                  whileTap={{ scale: 0.97 }}
                >
                  Back
                </motion.button>
              ) : (
                <div />
              )}

              {step < steps.length - 1 ? (
                <motion.button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!current.canProceed}
                  className="flex-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
                  whileHover={current.canProceed ? { scale: 1.03 } : {}}
                  whileTap={current.canProceed ? { scale: 0.97 } : {}}
                >
                  Continue
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleSave}
                  disabled={!current.canProceed || saving}
                  className="flex-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
                  whileHover={
                    current.canProceed && !saving ? { scale: 1.03 } : {}
                  }
                  whileTap={
                    current.canProceed && !saving ? { scale: 0.97 } : {}
                  }
                >
                  {saving ? "Saving..." : "Save preferences"}
                </motion.button>
              )}
            </div>

            {step === 0 && languages.length === 0 && (
              <p className="text-xs text-zinc-500">
                Select at least one language to continue
              </p>
            )}

            {/* Skip (only useful on first visit) */}
            {router.query.return && (
              <button
                type="button"
                onClick={() =>
                  router.replace(
                    (router.query.return as string) ?? "/"
                  )
                }
                className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
              >
                Skip for now
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
