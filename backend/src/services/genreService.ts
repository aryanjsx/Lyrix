import { prisma } from "./quotaService";

interface GenreRule {
  genre: string;
  patterns: RegExp[];
}

const GENRE_RULES: GenreRule[] = [
  { genre: "pop", patterns: [/\bpop\b/i] },
  {
    genre: "rock",
    patterns: [/\b(rock|punk\s?rock|alt[\s-]?rock|grunge)\b/i],
  },
  {
    genre: "hip-hop",
    patterns: [/\b(hip[\s-]?hop|rap|trap)\b/i],
  },
  {
    genre: "r&b",
    patterns: [/\b(r\s*&?\s*b|r\.?n\.?b|soul|neo[\s-]?soul)\b/i],
  },
  {
    genre: "electronic",
    patterns: [
      /\b(edm|electronic|house|techno|trance|dubstep|dnb|drum\s?and\s?bass)\b/i,
    ],
  },
  {
    genre: "jazz",
    patterns: [/\b(jazz|swing|bebop|smooth\s?jazz)\b/i],
  },
  {
    genre: "classical",
    patterns: [/\b(classical|symphony|concerto|sonata|orchestr)/i],
  },
  {
    genre: "country",
    patterns: [/\b(country|bluegrass|honky\s?tonk|nashville\s?sound)\b/i],
  },
  {
    genre: "latin",
    patterns: [/\b(latin|reggaeton|salsa|bachata|cumbia|corrido)\b/i],
  },
  {
    genre: "k-pop",
    patterns: [
      /\b(k-?pop|kpop|bts|blackpink|twice|stray\s?kids|aespa|newjeans)\b/i,
    ],
  },
  {
    genre: "indie",
    patterns: [/\b(indie|bedroom\s?pop|dream\s?pop)\b/i],
  },
  {
    genre: "metal",
    patterns: [/\b(metal|death\s?metal|black\s?metal|thrash|doom)\b/i],
  },
  {
    genre: "folk",
    patterns: [/\b(folk|acoustic|singer[\s-]?songwriter)\b/i],
  },
  {
    genre: "blues",
    patterns: [/\b(blues|delta\s?blues|chicago\s?blues)\b/i],
  },
  {
    genre: "reggae",
    patterns: [/\b(reggae|dancehall|ska|dub)\b/i],
  },
  {
    genre: "punk",
    patterns: [/\b(punk|hardcore|post[\s-]?punk|emo)\b/i],
  },
  { genre: "soul", patterns: [/\bsoul\b/i] },
  {
    genre: "lo-fi",
    patterns: [/\b(lo[\s-]?fi|lofi|chillhop)\b/i],
  },
  {
    genre: "ambient",
    patterns: [/\b(ambient|drone|atmospheric)\b/i],
  },
];

function detectGenres(title: string, channel: string): string[] {
  const text = `${title} ${channel}`.toLowerCase();
  const matched = new Set<string>();
  for (const rule of GENRE_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        matched.add(rule.genre);
        break;
      }
    }
  }
  if (matched.size === 0) matched.add("other");
  return Array.from(matched);
}

export async function tagTrack(
  trackId: string,
  title: string,
  channel: string,
  category?: string
): Promise<void> {
  const genres =
    category === "podcast" ? ["podcast"] : detectGenres(title, channel);
  await Promise.all(
    genres.map((genre) =>
      prisma.trackGenre
        .upsert({
          where: { trackId_genre: { trackId, genre } },
          create: { trackId, genre },
          update: {},
        })
        .catch(() => {})
    )
  );
}
