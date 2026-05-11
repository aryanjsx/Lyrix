export const GENRE_TOPIC_MAP: Record<string, string | null> = {
  pop: "/m/064t9",
  "hip-hop": "/m/0glt670",
  rock: "/m/06by7",
  electronic: "/m/02lkt",
  classical: "/m/0ggq0m",
  jazz: "/m/03_d0",
  "r&b": "/m/06cqb",
  bollywood: "/m/01st9f",
  indie: "/m/03mb9",
  metal: "/m/05r6t",
  lofi: "/m/02lkt",
  country: "/m/01lyv",
  reggae: "/m/06j6l",
  folk: "/m/028sqc",
  punk: "/m/05r6t",
  blues: "/m/06by7",
  soul: "/m/06cqb",
  latin: "/m/0g293",
  default: null,
};

export function getGenreTopicId(genreName: string): string | null {
  const normalized = genreName.toLowerCase().trim();
  return GENRE_TOPIC_MAP[normalized] ?? GENRE_TOPIC_MAP.default ?? null;
}

const GENRE_SEARCH_TERMS: Record<string, string> = {
  pop: "pop music",
  "hip-hop": "hip hop rap",
  rock: "rock music",
  electronic: "electronic EDM",
  classical: "classical instrumental",
  jazz: "jazz music",
  "r&b": "r&b soul",
  bollywood: "bollywood hindi film",
  indie: "indie music",
  metal: "metal heavy",
  lofi: "lofi chill beats",
  country: "country music",
  reggae: "reggae music",
  folk: "folk acoustic",
  punk: "punk rock",
  blues: "blues music",
  soul: "soul music",
  latin: "latin reggaeton",
};

export function getGenreSearchTerm(genreName: string): string {
  const normalized = genreName.toLowerCase().trim();
  return GENRE_SEARCH_TERMS[normalized] ?? normalized;
}
