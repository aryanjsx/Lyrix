import { useLyrixStore, type Track } from "@/store";

interface DiscographyAlbum {
  id: string;
  title: string;
  thumbnail: string;
}

interface ArtistDiscographyProps {
  albums: DiscographyAlbum[];
  artistName: string;
}

export default function ArtistDiscography({ albums, artistName }: ArtistDiscographyProps) {
  const playTrack = useLyrixStore((s) => s.playTrack);

  function handleAlbumClick(album: DiscographyAlbum) {
    const track: Track = {
      videoId: album.id,
      title: album.title,
      channel: artistName,
      duration: 0,
      thumbnail: album.thumbnail,
      category: "music",
    };
    playTrack(track);
  }

  return (
    <section aria-label={`${artistName} discography`}>
      <h2 className="mb-4 text-base font-medium text-white">Discography</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {albums.map((album) => (
          <button
            key={album.id}
            type="button"
            onClick={() => handleAlbumClick(album)}
            className="group text-left"
          >
            <div className="relative mb-2 aspect-square overflow-hidden rounded-xl bg-white/5">
              {album.thumbnail ? (
                <img
                  src={album.thumbnail}
                  alt={album.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="black" className="ml-0.5">
                    <polygon points="6,3 20,12 6,21" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="truncate text-sm text-white/80 transition-colors group-hover:text-white">
              {album.title}
            </p>
            <p className="mt-0.5 text-xs text-white/35">Song</p>
          </button>
        ))}
      </div>
    </section>
  );
}
