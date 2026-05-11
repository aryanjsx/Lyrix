import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LANGUAGE_OPTIONS,
  GENRE_OPTIONS,
  getArtistsForLanguages,
} from "@/data/onboardingData";
import { fetchWithAuth } from "@/services/fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface OnboardingPrefs {
  languages: string[];
  genres: string[];
  artists: string[];
}

interface OnboardingModalProps {
  onComplete: (prefs: OnboardingPrefs) => void;
}

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

function ChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onToggle(opt.id)}
          className={`rounded-full border px-4 py-2 text-sm transition-all ${
            selected.includes(opt.id)
              ? "border-white bg-white text-black"
              : "border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:text-white/90"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [languages, setLanguages] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [artists, setArtists] = useState<string[]>([]);
  const [artistSearch, setArtistSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const languageArtists = getArtistsForLanguages(languages);
  const filteredArtists = languageArtists.filter(
    (a) =>
      !artistSearch || a.toLowerCase().includes(artistSearch.toLowerCase())
  );

  const steps = [
    {
      title: "What languages do you listen in?",
      subtitle: "Pick all that apply — we'll mix things up",
      canProceed: languages.length >= 1,
    },
    {
      title: "What are your favourite genres?",
      subtitle: "Choose at least 3",
      canProceed: genres.length >= 3,
    },
    {
      title: "Pick some artists you love",
      subtitle: "Choose at least 3 — or search for anyone",
      canProceed: artists.length >= 3,
    },
  ];

  async function handleComplete() {
    setIsSubmitting(true);
    const prefs: OnboardingPrefs = { languages, genres, artists };

    try {
      await fetchWithAuth(`${API_URL}/api/onboarding/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
    } catch {
      // fail silently — localStorage fallback in parent
    }

    try {
      localStorage.setItem("lyrix_user_prefs", JSON.stringify(prefs));
    } catch {
      // localStorage unavailable
    }

    onComplete(prefs);
  }

  const current = steps[step];

  return (
    <div
      className="flex min-h-[520px] items-center justify-center rounded-2xl p-6 sm:p-8"
      style={{
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="w-full max-w-lg">
        {/* Step dots */}
        <div className="mb-8 flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i <= step ? "w-8 bg-white" : "w-4 bg-white/20"
              }`}
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
            <h2 className="mb-1 text-center text-xl font-medium text-white">
              {current.title}
            </h2>
            <p className="mb-6 text-center text-sm text-white/40">
              {current.subtitle}
            </p>

            {step === 0 && (
              <ChipGrid
                options={LANGUAGE_OPTIONS}
                selected={languages}
                onToggle={(id) => setLanguages(toggle(languages, id))}
              />
            )}

            {step === 1 && (
              <ChipGrid
                options={GENRE_OPTIONS}
                selected={genres}
                onToggle={(id) => setGenres(toggle(genres, id))}
              />
            )}

            {step === 2 && (
              <>
                <input
                  type="text"
                  placeholder="Search artists..."
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
                  autoComplete="off"
                />
                <ChipGrid
                  options={filteredArtists.map((a) => ({ id: a, label: a }))}
                  selected={artists}
                  onToggle={(id) => setArtists(toggle(artists, id))}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-sm text-white/40 transition-colors hover:text-white/70"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!current.canProceed}
              className="rounded-xl bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={!current.canProceed || isSubmitting}
              className="rounded-xl bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isSubmitting ? "Saving..." : "Start listening"}
            </button>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => onComplete({ languages, genres, artists })}
            className="text-xs text-white/25 transition-colors hover:text-white/50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
