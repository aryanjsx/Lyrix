import Link from "next/link";

interface SimilarArtist {
  name: string;
  slug: string;
  thumbnail: string | null;
}

interface SimilarArtistsProps {
  artists: SimilarArtist[];
}

export default function SimilarArtists({ artists }: SimilarArtistsProps) {
  return (
    <section aria-label="Similar artists">
      <h2 className="mb-4 text-base font-medium text-white">Fans also like</h2>

      <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-hide">
        {artists.map((artist) => (
          <Link
            key={artist.slug}
            href={`/artist/${artist.slug}`}
            className="group w-28 flex-shrink-0 text-center"
          >
            <div className="relative mx-auto mb-2 h-20 w-20 overflow-hidden rounded-full bg-white/5 ring-2 ring-transparent transition-all group-hover:ring-white/20">
              {artist.thumbnail ? (
                <img
                  src={artist.thumbnail}
                  alt={artist.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600/40 to-blue-600/40">
                  <span className="text-xl font-bold text-white/60">
                    {artist.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>
            <p className="truncate text-xs text-white/70 transition-colors group-hover:text-white">
              {artist.name}
            </p>
            <p className="mt-0.5 text-xs text-white/30">Artist</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
