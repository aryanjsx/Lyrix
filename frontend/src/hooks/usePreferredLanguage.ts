import { useLyrixStore } from "@/store";

const STORAGE_KEY = "lyrix:preferredLanguage";

const BROWSER_LANG_MAP: Record<string, string> = {
  hi: "hindi",
  en: "english",
  pa: "punjabi",
  ta: "tamil",
  te: "telugu",
  kn: "kannada",
  bn: "bengali",
  mr: "marathi",
  ml: "malayalam",
  gu: "gujarati",
  es: "spanish",
  fr: "french",
  ko: "korean",
  ja: "japanese",
  zh: "chinese",
  ar: "arabic",
  tr: "turkish",
  de: "german",
  pt: "portuguese",
  ru: "russian",
  it: "italian",
};

function detectFromBrowser(): string {
  try {
    const browserLang = navigator.language?.split("-")[0];
    return BROWSER_LANG_MAP[browserLang] ?? "english";
  } catch {
    return "english";
  }
}

function getStoredLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch { /* localStorage unavailable */ }

  const prefLangs = useLyrixStore.getState().preferences.languages;
  if (prefLangs.length > 0) return prefLangs[0];

  return detectFromBrowser();
}

export function getPreferredLanguage(): string {
  return getStoredLanguage();
}
