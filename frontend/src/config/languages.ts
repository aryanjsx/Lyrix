export interface LanguageOption {
  id: string;
  label: string;
  script: string;
  keywords: string[];
}

export const LANGUAGES: LanguageOption[] = [
  // Top Indian Languages
  { id: "hindi", label: "Hindi", script: "हिन्दी", keywords: ["hindi", "bollywood"] },
  { id: "punjabi", label: "Punjabi", script: "ਪੰਜਾਬੀ", keywords: ["punjabi"] },
  { id: "tamil", label: "Tamil", script: "தமிழ்", keywords: ["tamil", "kollywood"] },
  { id: "telugu", label: "Telugu", script: "తెలుగు", keywords: ["telugu", "tollywood"] },
  { id: "bengali", label: "Bengali", script: "বাংলা", keywords: ["bengali", "bangla"] },
  { id: "marathi", label: "Marathi", script: "मराठी", keywords: ["marathi"] },
  { id: "kannada", label: "Kannada", script: "ಕನ್ನಡ", keywords: ["kannada"] },
  { id: "malayalam", label: "Malayalam", script: "മലയാളം", keywords: ["malayalam"] },
  { id: "gujarati", label: "Gujarati", script: "ગુજરાતી", keywords: ["gujarati"] },
  { id: "odia", label: "Odia", script: "ଓଡ଼ିଆ", keywords: ["odia", "oriya"] },
  { id: "assamese", label: "Assamese", script: "অসমীয়া", keywords: ["assamese"] },
  { id: "urdu", label: "Urdu", script: "اردو", keywords: ["urdu"] },
  { id: "bhojpuri", label: "Bhojpuri", script: "भोजपुरी", keywords: ["bhojpuri"] },
  { id: "haryanvi", label: "Haryanvi", script: "हरियाणवी", keywords: ["haryanvi"] },
  { id: "rajasthani", label: "Rajasthani", script: "राजस्थानी", keywords: ["rajasthani"] },
  { id: "maithili", label: "Maithili", script: "मैथिली", keywords: ["maithili"] },
  { id: "konkani", label: "Konkani", script: "कोंकणी", keywords: ["konkani"] },
  { id: "dogri", label: "Dogri", script: "डोगरी", keywords: ["dogri"] },
  { id: "sindhi", label: "Sindhi", script: "سنڌي", keywords: ["sindhi"] },
  { id: "kashmiri", label: "Kashmiri", script: "कॉशुर", keywords: ["kashmiri"] },
  { id: "chhattisgarhi", label: "Chhattisgarhi", script: "छत्तीसगढ़ी", keywords: ["chhattisgarhi"] },
  // International Languages
  { id: "english", label: "English", script: "English", keywords: ["english", "pop", "rock", "global"] },
  { id: "korean", label: "Korean", script: "한국어", keywords: ["kpop", "korean", "k-pop"] },
  { id: "spanish", label: "Spanish", script: "Español", keywords: ["spanish", "latin", "reggaeton"] },
  { id: "french", label: "French", script: "Français", keywords: ["french", "francais"] },
  { id: "german", label: "German", script: "Deutsch", keywords: ["german", "deutsch"] },
  { id: "portuguese", label: "Portuguese", script: "Português", keywords: ["portuguese", "brazilian"] },
  { id: "italian", label: "Italian", script: "Italiano", keywords: ["italian"] },
  { id: "arabic", label: "Arabic", script: "العربية", keywords: ["arabic"] },
  { id: "japanese", label: "Japanese", script: "日本語", keywords: ["japanese", "j-pop", "anime"] },
  { id: "chinese", label: "Chinese", script: "中文", keywords: ["chinese", "mandarin", "c-pop"] },
  { id: "turkish", label: "Turkish", script: "Türkçe", keywords: ["turkish"] },
  { id: "russian", label: "Russian", script: "Русский", keywords: ["russian"] },
  { id: "thai", label: "Thai", script: "ภาษาไทย", keywords: ["thai"] },
  { id: "indonesian", label: "Indonesian", script: "Bahasa", keywords: ["indonesian", "malay"] },
  { id: "vietnamese", label: "Vietnamese", script: "Tiếng Việt", keywords: ["vietnamese"] },
  { id: "filipino", label: "Filipino", script: "Filipino", keywords: ["filipino", "tagalog", "opm"] },
  { id: "swahili", label: "Swahili", script: "Kiswahili", keywords: ["swahili", "afrobeat"] },
];

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id);

export const PREFS_STORAGE_KEY = "lyrix_language_prefs";

export function loadGuestPrefs(): string[] {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((id: unknown) => typeof id === "string" && LANGUAGE_IDS.includes(id as string));
    }
  } catch { /* ignore */ }
  return [];
}

export function saveGuestPrefs(languages: string[]): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(languages));
  } catch { /* ignore */ }
  try {
    const value = languages.join(",");
    document.cookie = `lyrix_languages=${encodeURIComponent(value)};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
  } catch { /* ignore */ }
}

export function hasSetPrefs(): boolean {
  try {
    return localStorage.getItem(PREFS_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
