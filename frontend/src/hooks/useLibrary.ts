import { useCallback } from "react";
import type { Track } from "@/store";
import { useLyrixStore } from "@/store";
import { addTrackToPlaylist as apiAddTrackToPlaylist } from "@/services/playlistApi";

export function useLibrary() {
  const playlists = useLyrixStore((s) => s.library.playlists);
  const savedTracks = useLyrixStore((s) => s.library.savedTracks);
  const savedTrackIds = useLyrixStore((s) => s.library.savedTrackIds);
  const syncInFlight = useLyrixStore((s) => s.library.syncInFlight);

  const syncLibrary = useLyrixStore((s) => s.syncLibrary);
  const saveTrackToLibrary = useLyrixStore((s) => s.saveTrackToLibrary);
  const unsaveTrackFromLibrary = useLyrixStore((s) => s.unsaveTrackFromLibrary);
  const bumpPlaylistTrackCount = useLyrixStore(
    (s) => s.bumpPlaylistTrackCount
  );

  const isTrackSaved = useCallback(
    (videoId: string) => savedTrackIds.has(videoId),
    [savedTrackIds]
  );

  const saveTrack = useCallback(
    async (track: Track) => {
      await saveTrackToLibrary(track);
    },
    [saveTrackToLibrary]
  );

  const unsaveTrack = useCallback(
    async (videoId: string) => {
      await unsaveTrackFromLibrary(videoId);
    },
    [unsaveTrackFromLibrary]
  );

  const addTrackToPlaylistEntry = useCallback(
    async (playlistId: string, track: Track) => {
      await apiAddTrackToPlaylist(playlistId, track, track.filterScore ?? 0);
      bumpPlaylistTrackCount(playlistId);
    },
    [bumpPlaylistTrackCount]
  );

  return {
    playlists,
    savedTracks,
    savedTrackIds,
    loading: syncInFlight,
    syncLibrary,
    isTrackSaved,
    saveTrack,
    unsaveTrack,
    addTrackToPlaylist: addTrackToPlaylistEntry,
  };
}
