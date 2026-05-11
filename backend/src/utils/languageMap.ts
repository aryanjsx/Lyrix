export const LANGUAGE_CODE_MAP: Record<string, string> = {
  hindi: "hi",
  english: "en",
  punjabi: "pa",
  tamil: "ta",
  telugu: "te",
  kannada: "kn",
  bengali: "bn",
  marathi: "mr",
  malayalam: "ml",
  gujarati: "gu",
  odia: "or",
  assamese: "as",
  urdu: "ur",
  bhojpuri: "bh",
  haryanvi: "hi",
  rajasthani: "hi",
  spanish: "es",
  french: "fr",
  korean: "ko",
  japanese: "ja",
  chinese: "zh",
  arabic: "ar",
  turkish: "tr",
  german: "de",
  portuguese: "pt",
  russian: "ru",
  italian: "it",
  default: "en",
};

export function getLanguageCode(languageName: string): string {
  const normalized = languageName.toLowerCase().trim();
  return LANGUAGE_CODE_MAP[normalized] ?? LANGUAGE_CODE_MAP.default;
}

const LANGUAGE_SEARCH_TERMS: Record<string, string> = {
  hindi: "hindi bollywood",
  english: "english",
  punjabi: "punjabi",
  tamil: "tamil",
  telugu: "telugu",
  kannada: "kannada",
  bengali: "bengali bangla",
  marathi: "marathi",
  malayalam: "malayalam",
  gujarati: "gujarati",
  odia: "odia oriya",
  assamese: "assamese",
  urdu: "urdu ghazal",
  bhojpuri: "bhojpuri",
  haryanvi: "haryanvi",
  rajasthani: "rajasthani",
  spanish: "spanish latino",
  french: "french",
  korean: "korean kpop",
  japanese: "japanese jpop",
  chinese: "chinese mandarin cpop",
  arabic: "arabic",
  turkish: "turkish",
};

export function getLanguageSearchTerm(languageName: string): string {
  const normalized = languageName.toLowerCase().trim();
  return LANGUAGE_SEARCH_TERMS[normalized] ?? normalized;
}
