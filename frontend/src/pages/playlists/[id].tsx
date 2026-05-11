import { useRouter } from "next/router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PlaylistDetail } from "@/components/playlist/PlaylistDetail";

export default function PlaylistDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900/50 via-[var(--bg-primary)] to-[var(--bg-primary)]">
      <SiteHeader />
      <main className="px-4 pb-28 pt-6 sm:px-6 sm:pb-8 lg:px-8">
        {id ? (
          <PlaylistDetail playlistId={id} />
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        )}
      </main>
    </div>
  );
}
