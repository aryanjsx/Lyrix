import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useLyrixStore, type Track } from "@/store";
import { deslugify } from "@/lib/slugify";
import { radioService } from "@/services/radioService";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ArtistHero } from "@/components/artist/ArtistHero";
import { ArtistTrackList } from "@/components/artist/ArtistTrackList";
import { ArtistPageSkeleton } from "@/components/skeletons/ArtistPageSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";

const ArtistDiscography = dynamic(
  () => import("@/components/artist/ArtistDiscography"),
  { ssr: false }
);
const SimilarArtists = dynamic(
  () => import("@/components/artist/SimilarArtists"),
  { ssr: false }
);
const ArtistAppearsOn = dynamic(
  () => import("@/components/artist/ArtistAppearsOn"),
  { ssr: false }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ArtistTrack {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  filterScore: number;
}

interface SimilarArtistData {
  name: string;
  slug: string;
  thumbnail: string | null;
}

interface ArtistPageData {
  slug: string;
  name: string;
  avatar: string | null;
  bannerImage: string | null;
  popularSongs: ArtistTrack[];
  albums: { id: string; title: string; thumbnail: string }[];
  appearsOn: ArtistTrack[];
  similarArtists: SimilarArtistData[];
  fetchedAt: string;
}

export default function ArtistPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);
  const setPlayerContext = useLyrixStore((s) => s.setPlayerContext);

  const [artist, setArtist] = useState<ArtistPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/artist/page/${encodeURIComponent(slug)}`);
        if (res.ok && !cancelled) {
          const data: ArtistPageData = await res.json();
          setArtist(data);
        } else if (!cancelled) {
          setError(true);
          setArtist(null);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setArtist(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading || !slug) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-4xl">
          <ArtistPageSkeleton />
        </main>
      </div>
    );
  }

  if (error || !artist || !artist.popularSongs.length) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <EmptyState
            icon="ti-user-off"
            title={`No results for "${deslugify(slug)}"`}
            description="We couldn't find music for this artist on YouTube."
            action={{
              label: "Back",
              icon: "ti-arrow-left",
              onClick: () => router.back(),
            }}
            size="lg"
          />
        </main>
      </div>
    );
  }

  function toStoreTrack(t: ArtistTrack): Track {
    return {
      videoId: t.videoId,
      title: t.title,
      channel: t.channel,
      duration: t.duration,
      thumbnail: t.thumbnail,
      category: t.category === "podcast" ? "podcast" : "music",
      filterScore: t.filterScore,
    };
  }

  function handlePlayAll() {
    if (!artist?.popularSongs.length) return;
    const tracks = artist.popularSongs.map(toStoreTrack);
    playTrack(tracks[0]);
    tracks.slice(1).forEach((t) => addToQueue(t));
    setPlayerContext({ type: "queue", label: artist.name });
  }

  function handleShuffle() {
    if (!artist?.popularSongs.length) return;
    const shuffled = [...artist.popularSongs]
      .sort(() => Math.random() - 0.5)
      .map(toStoreTrack);
    playTrack(shuffled[0]);
    shuffled.slice(1).forEach((t) => addToQueue(t));
    setPlayerContext({ type: "queue", label: `${artist.name} (Shuffle)` });
  }

  function handleRadio() {
    if (!artist?.popularSongs.length) return;
    const firstTrack = toStoreTrack(artist.popularSongs[0]);
    radioService.start({
      type: "artist",
      id: firstTrack.videoId,
      label: artist.name,
    });
    setPlayerContext({ type: "radio", label: `Radio — ${artist.name}` });
    playTrack(firstTrack);
    radioService
      .fetchNextBatch()
      .then((tracks) => {
        tracks.forEach((t) => addToQueue(t));
      })
      .catch(() => {});
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-4xl pb-32"
      >
        <ArtistHero
          name={artist.name}
          avatar={artist.avatar}
          bannerImage={artist.bannerImage}
          trackCount={artist.popularSongs.length}
          onPlayAll={handlePlayAll}
          onShuffle={handleShuffle}
          onRadio={handleRadio}
        />

        <div className="mt-8 px-6">
          <ArtistTrackList
            tracks={artist.popularSongs}
            artistName={artist.name}
          />
        </div>

        {artist.albums.length > 0 && (
          <div className="mt-10 px-6">
            <ArtistDiscography
              albums={artist.albums}
              artistName={artist.name}
            />
          </div>
        )}

        {artist.appearsOn.length > 0 && (
          <div className="mt-10 px-6">
            <ArtistAppearsOn tracks={artist.appearsOn} />
          </div>
        )}

        {artist.similarArtists.length > 0 && (
          <div className="mt-10 px-6">
            <SimilarArtists artists={artist.similarArtists} />
          </div>
        )}
      </motion.main>
    </div>
  );
}
