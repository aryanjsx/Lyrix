const GENRE_KEYWORDS: Record<string, string[]> = {
  lofi: ["lofi", "lo-fi", "lo fi", "chill beats", "study beats"],
  bollywood: ["bollywood", "hindi film", "from \"", "film song"],
  "hip-hop": ["hip hop", "hip-hop", "rap", "trap", "drill"],
  classical: ["classical", "instrumental", "raag", "raga", "symphony"],
  electronic: ["electronic", "edm", "house", "techno", "trance", "dubstep"],
  rock: ["rock", "grunge", "alternative rock"],
  metal: ["metal", "heavy metal", "death metal"],
  jazz: ["jazz", "smooth jazz", "bebop"],
  "r&b": ["r&b", "rnb", "rhythm and blues"],
  indie: ["indie", "independent"],
  pop: ["pop"],
  country: ["country", "folk country"],
  reggae: ["reggae", "dancehall", "ska"],
  folk: ["folk", "acoustic"],
  punk: ["punk", "punk rock"],
  latin: ["reggaeton", "latin", "salsa", "bachata"],
  soul: ["soul", "motown"],
};

export function detectGenre(track: { title: string; channel: string; category?: string }): string {
  if (track.category && track.category !== "music" && track.category !== "podcast") {
    return track.category;
  }

  const text = `${track.title} ${track.channel}`.toLowerCase();

  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return genre;
    }
  }

  return "pop";
}

const SCRIPT_RANGES: Array<{ pattern: RegExp; language: string }> = [
  { pattern: /[\u0900-\u097F]/, language: "hindi" },
  { pattern: /[\u0A00-\u0A7F]/, language: "punjabi" },
  { pattern: /[\u0B80-\u0BFF]/, language: "tamil" },
  { pattern: /[\u0C00-\u0C7F]/, language: "telugu" },
  { pattern: /[\u0C80-\u0CFF]/, language: "kannada" },
  { pattern: /[\u0D00-\u0D7F]/, language: "malayalam" },
  { pattern: /[\u0980-\u09FF]/, language: "bengali" },
  { pattern: /[\uAC00-\uD7AF]/, language: "korean" },
  { pattern: /[\u3040-\u30FF]/, language: "japanese" },
  { pattern: /[\u4E00-\u9FFF]/, language: "japanese" },
];

const LANGUAGE_HINTS: Record<string, string[]> = {
  hindi: ["hindi", "bollywood", "from \""],
  punjabi: ["punjabi", "bhangra"],
  tamil: ["tamil", "kollywood"],
  telugu: ["telugu", "tollywood"],
  bengali: ["bengali", "bangla", "tollywood bengali"],
  marathi: ["marathi"],
  kannada: ["kannada", "sandalwood"],
  malayalam: ["malayalam", "mollywood"],
  gujarati: ["gujarati"],
  korean: ["korean", "kpop", "k-pop"],
  japanese: ["japanese", "anime", "j-pop", "jpop"],
  spanish: ["spanish", "latino", "reggaeton"],
  french: ["french", "francais"],
  arabic: ["arabic"],
  chinese: ["chinese", "mandarin", "cpop"],
  turkish: ["turkish"],
};

export function detectLanguage(
  track: { title: string; channel: string; language?: string },
  preferredLanguage?: string
): string {
  if (preferredLanguage) return preferredLanguage;

  if (track.language) return track.language;

  const title = track.title;
  for (const { pattern, language } of SCRIPT_RANGES) {
    if (pattern.test(title)) return language;
  }

  const text = `${track.title} ${track.channel}`.toLowerCase();
  for (const [language, hints] of Object.entries(LANGUAGE_HINTS)) {
    if (hints.some((h) => text.includes(h))) return language;
  }

  return "english";
}
