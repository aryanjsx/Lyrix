import { prisma, recordCall, getTodayQuota, canMakeCall } from "./quotaService";
import { refreshAccessToken } from "./authService";
import {
  getVideoDetails,
  type YouTubeVideoItem,
} from "./youtubeService";
import { filterAndScore } from "./filterService";
import { getVideoMetadataBatch } from "./innertubeService";
import type { TrackMetadata } from "./playlistService";

const TOKEN_BUFFER_MS = 60_000;

const OP_IMPORT = "import_youtube";
const OP_EXPORT = "export_youtube";
const OP_PULL = "pull_sync";

/** YouTube Data API v3 quota units */
const Q_PLAYLIST_LIST = 1;
const Q_PLAYLIST_ITEMS_LIST = 1;
const Q_PLAYLIST_INSERT = 50;
const Q_PLAYLIST_ITEM_INSERT = 50;

const EXPORT_TRACK_CAP = 50;
const EXPORT_DAILY_LIMIT = 2;
const EXPORT_QUOTA_CEILING = 9000;
const INSERT_DELAY_MS = 100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshCoverThumbnail(playlistId: string): Promise<void> {
  const first = await prisma.playlistTrack.findFirst({
    where: { playlistId },
    orderBy: { position: "asc" },
    include: { track: true },
  });
  await prisma.playlist.update({
    where: { id: playlistId },
    data: { coverThumbnail: first?.track.thumbnail ?? null },
  });
}

async function youtubeUserApiGet<T>(
  accessToken: string,
  endpoint: string,
  params: Record<string, string>,
  quotaCost: number
): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API ${endpoint} failed: ${res.status} ${text}`);
  }

  await recordCall(quotaCost);
  return (await res.json()) as T;
}

async function youtubeUserApiPost<T>(
  accessToken: string,
  endpoint: string,
  query: Record<string, string>,
  body: unknown,
  quotaCost: number
): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API ${endpoint} failed: ${res.status} ${text}`);
  }

  await recordCall(quotaCost);
  return (await res.json()) as T;
}

async function getValidAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleRefreshToken: true,
      googleAccessToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!user?.googleRefreshToken) {
    throw new Error("YOUTUBE_AUTH_REQUIRED");
  }

  const threshold = Date.now() + TOKEN_BUFFER_MS;
  if (
    user.googleAccessToken &&
    user.googleTokenExpiry &&
    user.googleTokenExpiry.getTime() > threshold
  ) {
    return user.googleAccessToken;
  }

  const token = await refreshAccessToken(userId);
  if (!token) {
    throw new Error("YOUTUBE_AUTH_REQUIRED");
  }

  return token;
}

export interface UserYouTubePlaylistSummary {
  id: string;
  title: string;
  thumbnail: string | null;
  itemCount: number | null;
}

interface PlaylistsMineResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
    };
    contentDetails?: { itemCount?: string | number };
  }>;
  nextPageToken?: string;
}

export async function getUserYouTubePlaylists(
  userId: string
): Promise<UserYouTubePlaylistSummary[]> {
  const token = await getValidAccessToken(userId);
  const out: UserYouTubePlaylistSummary[] = [];
  let pageToken = "";

  for (;;) {
    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      mine: "true",
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await youtubeUserApiGet<PlaylistsMineResponse>(
      token,
      "playlists",
      params,
      Q_PLAYLIST_LIST
    );

    for (const item of data.items ?? []) {
      const thumbs = item.snippet?.thumbnails;
      const thumb =
        thumbs?.high?.url ??
        thumbs?.medium?.url ??
        thumbs?.default?.url ??
        null;
      const rawCount = item.contentDetails?.itemCount;
      const itemCount =
        rawCount === undefined || rawCount === null
          ? null
          : typeof rawCount === "number"
            ? rawCount
            : parseInt(String(rawCount), 10);

      out.push({
        id: item.id,
        title: item.snippet?.title ?? "(untitled)",
        thumbnail: thumb,
        itemCount: Number.isFinite(itemCount as number) ? itemCount : null,
      });
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return out;
}

interface PlaylistByIdResponse {
  items?: Array<{ snippet: { title: string; description?: string } }>;
}

interface PlaylistItemsPage {
  items?: Array<{
    snippet?: {
      resourceId?: { kind?: string; videoId?: string };
    };
  }>;
  nextPageToken?: string;
}

async function collectPlaylistVideoIds(
  accessToken: string,
  ytPlaylistId: string
): Promise<{ ids: string[]; listUnits: number }> {
  const ids: string[] = [];
  let listUnits = 0;
  let pageToken = "";

  for (;;) {
    const params: Record<string, string> = {
      part: "snippet",
      playlistId: ytPlaylistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await youtubeUserApiGet<PlaylistItemsPage>(
      accessToken,
      "playlistItems",
      params,
      Q_PLAYLIST_ITEMS_LIST
    );
    listUnits += Q_PLAYLIST_ITEMS_LIST;

    for (const row of data.items ?? []) {
      const vid = row.snippet?.resourceId?.videoId;
      const kind = row.snippet?.resourceId?.kind;
      if (vid && (kind === "youtube#video" || !kind)) {
        ids.push(vid);
      }
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return { ids, listUnits };
}

/** Dedupe preserving order */
function uniqueOrdered(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function importYouTubePlaylist(
  userId: string,
  ytPlaylistId: string
) {
  const token = await getValidAccessToken(userId);

  const meta = await youtubeUserApiGet<PlaylistByIdResponse>(
    token,
    "playlists",
    {
      part: "snippet",
      id: ytPlaylistId,
    },
    Q_PLAYLIST_LIST
  );
  const metaItem = meta.items?.[0];
  if (!metaItem) {
    throw new Error("YOUTUBE_PLAYLIST_NOT_FOUND");
  }

  const lyrixPlaylist = await prisma.playlist.create({
    data: {
      userId,
      name: metaItem.snippet.title,
      description: metaItem.snippet.description ?? null,
      youtubePlaylistId: ytPlaylistId,
      syncEnabled: true,
    },
  });

  const metaListQuota = Q_PLAYLIST_LIST;
  let listPageQuotaTotal = 0;
  let videoListQuotaTotal = 0;
  let qVideoBaseline: number | null = null;

  try {
    const { ids: rawIds, listUnits } = await collectPlaylistVideoIds(
      token,
      ytPlaylistId
    );
    listPageQuotaTotal = listUnits;
    const videoIds = uniqueOrdered(rawIds);

    qVideoBaseline = (await getTodayQuota()).units;

    let importedTracks: Array<{ videoId: string } & TrackMetadata> = [];

    // Try YouTube Data API first, fall back to Invidious
    const allDetails: YouTubeVideoItem[] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50);
      const details = await getVideoDetails(chunk);
      allDetails.push(...details);
    }
    videoListQuotaTotal = (await getTodayQuota()).units - qVideoBaseline;

    if (allDetails.length > 0) {
      const filtered = await filterAndScore(allDetails, Number.MAX_SAFE_INTEGER);
      importedTracks = filtered.map((t) => ({
        videoId: t.videoId,
        title: t.title,
        channel: t.channel,
        duration: t.duration,
        thumbnail: t.thumbnail,
        category: t.category,
        filterScore: t.filterScore,
      }));
    } else {
      // Fallback to Invidious when YouTube Data API fails
      const fallbackMeta = await getVideoMetadataBatch(videoIds);
      importedTracks = fallbackMeta.map((m) => ({
        videoId: m.videoId,
        title: m.title,
        channel: m.channel,
        duration: m.duration,
        thumbnail: m.thumbnail,
        category: m.category,
        filterScore: m.filterScore,
      }));
    }

    await prisma.$transaction(async (tx) => {
      let pos = 0;
      for (const t of importedTracks) {
        await tx.track.upsert({
          where: { id: t.videoId },
          create: {
            id: t.videoId,
            title: t.title,
            channel: t.channel,
            duration: t.duration,
            thumbnail: t.thumbnail,
            category: t.category,
            filterScore: t.filterScore,
          },
          update: {
            title: t.title,
            channel: t.channel,
            duration: t.duration,
            thumbnail: t.thumbnail,
            category: t.category,
            filterScore: t.filterScore,
          },
        });
        await tx.playlistTrack.create({
          data: {
            playlistId: lyrixPlaylist.id,
            trackId: t.videoId,
            position: pos++,
          },
        });
      }
    });

    await refreshCoverThumbnail(lyrixPlaylist.id);

    const quotaUsed =
      metaListQuota + listPageQuotaTotal + videoListQuotaTotal;

    await prisma.syncLog.create({
      data: {
        userId,
        playlistId: lyrixPlaylist.id,
        operation: OP_IMPORT,
        quotaUsed,
        trackCount: importedTracks.length,
        status: "success",
      },
    });

    return { playlistId: lyrixPlaylist.id, trackCount: importedTracks.length };
  } catch (err) {
    if (qVideoBaseline !== null) {
      videoListQuotaTotal = (await getTodayQuota()).units - qVideoBaseline;
    }
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.create({
      data: {
        userId,
        playlistId: lyrixPlaylist.id,
        operation: OP_IMPORT,
        quotaUsed: metaListQuota + listPageQuotaTotal + videoListQuotaTotal,
        trackCount: 0,
        status: "error",
        error: message,
      },
    });
    throw err;
  }
}

async function recentExportCount(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.syncLog.count({
    where: {
      userId,
      operation: OP_EXPORT,
      status: "success",
      createdAt: { gte: since },
    },
  });
}

export async function exportToYouTube(userId: string, playlistId: string) {
  const token = await getValidAccessToken(userId);

  const quota = await getTodayQuota();
  if (quota.units >= EXPORT_QUOTA_CEILING) {
    throw new Error("EXPORT_QUOTA_BLOCKED");
  }

  if ((await recentExportCount(userId)) >= EXPORT_DAILY_LIMIT) {
    throw new Error("EXPORT_DAILY_LIMIT");
  }

  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, userId },
    include: {
      tracks: {
        orderBy: { position: "asc" },
        include: { track: true },
      },
    },
  });
  if (!playlist) throw new Error("NOT_FOUND");

  if (playlist.tracks.length > EXPORT_TRACK_CAP) {
    throw new Error("EXPORT_TRACK_LIMIT");
  }

  const n = playlist.tracks.length;
  const totalCost = Q_PLAYLIST_INSERT + Q_PLAYLIST_ITEM_INSERT * n;
  if (!(await canMakeCall(totalCost))) {
    throw new Error("QUOTA_BLOCKED");
  }

  let quotaUsed = 0;
  let youtubePlaylistId: string | null = null;

  try {
    const created = await youtubeUserApiPost<{ id: string }>(
      token,
      "playlists",
      { part: "snippet,status" },
      {
        snippet: {
          title: playlist.name,
          description: playlist.description ?? "",
        },
        status: { privacyStatus: "private" },
      },
      Q_PLAYLIST_INSERT
    );
    quotaUsed += Q_PLAYLIST_INSERT;
    youtubePlaylistId = created.id;

    let successfulInserts = 0;
    const failedTracks: string[] = [];

    for (let i = 0; i < playlist.tracks.length; i++) {
      const pt = playlist.tracks[i];
      if (i > 0) await delay(INSERT_DELAY_MS);

      if (!(await canMakeCall(Q_PLAYLIST_ITEM_INSERT))) {
        failedTracks.push(pt.trackId);
        continue;
      }

      try {
        await youtubeUserApiPost(
          token,
          "playlistItems",
          { part: "snippet" },
          {
            snippet: {
              playlistId: youtubePlaylistId,
              resourceId: { kind: "youtube#video", videoId: pt.trackId },
            },
          },
          Q_PLAYLIST_ITEM_INSERT
        );
        quotaUsed += Q_PLAYLIST_ITEM_INSERT;
        successfulInserts++;
      } catch (insertErr) {
        console.error(`[Sync] Failed to insert track ${pt.trackId}:`, insertErr);
        failedTracks.push(pt.trackId);
      }
    }

    await prisma.playlist.update({
      where: { id: playlistId },
      data: { youtubePlaylistId },
    });

    const status =
      successfulInserts === n
        ? "success"
        : successfulInserts > 0
          ? "partial"
          : "failed";

    await prisma.syncLog.create({
      data: {
        userId,
        playlistId,
        operation: OP_EXPORT,
        quotaUsed,
        trackCount: successfulInserts,
        status,
        error:
          status !== "success"
            ? `${successfulInserts}/${n} tracks exported`
            : null,
      },
    });

    return { youtubePlaylistId, tracksExported: successfulInserts, totalTracks: n, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.create({
      data: {
        userId,
        playlistId,
        operation: OP_EXPORT,
        quotaUsed,
        trackCount: 0,
        status: "error",
        error: message,
      },
    });
    throw err;
  }
}

export async function pullSync(userId: string, playlistId: string) {
  const token = await getValidAccessToken(userId);

  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, userId },
    include: {
      tracks: {
        orderBy: { position: "asc" },
        include: { track: true },
      },
    },
  });

  if (!playlist) throw new Error("NOT_FOUND");
  if (!playlist.youtubePlaylistId) throw new Error("SYNC_NOT_LINKED");

  let quotaUsed = 0;
  let addedCount = 0;

  let listQuotaPart = 0;
  let qVidBaseline: number | null = null;

  try {
    const { ids: rawYtIds, listUnits } = await collectPlaylistVideoIds(
      token,
      playlist.youtubePlaylistId
    );
    listQuotaPart = listUnits;
    const ytIds = new Set(uniqueOrdered(rawYtIds));

    const byTrackId = new Map(
      playlist.tracks.map((pt) => [pt.trackId, pt.track])
    );
    const lyrixIds = new Set(byTrackId.keys());

    const toAdd = [...ytIds].filter((id) => !lyrixIds.has(id));
    const removedFromYouTube = [...lyrixIds]
      .filter((id) => !ytIds.has(id))
      .map((id) => byTrackId.get(id)!);

    let videoQuotaPart = 0;
    if (toAdd.length > 0) {
      qVidBaseline = (await getTodayQuota()).units;

      let newTracks: Array<{ videoId: string; title: string; channel: string; duration: number; thumbnail: string; category: string; filterScore: number }> = [];

      // Try YouTube Data API first, fall back to Invidious
      const allNew: YouTubeVideoItem[] = [];
      for (let i = 0; i < toAdd.length; i += 50) {
        const chunk = toAdd.slice(i, i + 50);
        const details = await getVideoDetails(chunk);
        allNew.push(...details);
      }
      videoQuotaPart = (await getTodayQuota()).units - qVidBaseline;

      if (allNew.length > 0) {
        const filtered = await filterAndScore(allNew, Number.MAX_SAFE_INTEGER);
        newTracks = filtered;
      } else {
        const fallbackMeta = await getVideoMetadataBatch(toAdd);
        newTracks = fallbackMeta;
      }

      const agg = await prisma.playlistTrack.aggregate({
        where: { playlistId },
        _max: { position: true },
      });
      let pos = (agg._max.position ?? -1) + 1;

      await prisma.$transaction(async (tx) => {
        for (const t of newTracks) {
          await tx.track.upsert({
            where: { id: t.videoId },
            create: {
              id: t.videoId,
              title: t.title,
              channel: t.channel,
              duration: t.duration,
              thumbnail: t.thumbnail,
              category: t.category,
              filterScore: t.filterScore,
            },
            update: {
              title: t.title,
              channel: t.channel,
              duration: t.duration,
              thumbnail: t.thumbnail,
              category: t.category,
              filterScore: t.filterScore,
            },
          });
          await tx.playlistTrack.create({
            data: {
              playlistId,
              trackId: t.videoId,
              position: pos++,
            },
          });
          addedCount += 1;
        }
      });
    }

    quotaUsed = listQuotaPart + videoQuotaPart;

    await refreshCoverThumbnail(playlistId);

    await prisma.syncLog.create({
      data: {
        userId,
        playlistId,
        operation: OP_PULL,
        quotaUsed,
        trackCount: addedCount,
        status: "success",
      },
    });

    return { addedCount, removedFromYouTube };
  } catch (err) {
    const videoQuotaPartRecover =
      qVidBaseline !== null
        ? (await getTodayQuota()).units - qVidBaseline
        : 0;
    quotaUsed = listQuotaPart + videoQuotaPartRecover;
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.create({
      data: {
        userId,
        playlistId,
        operation: OP_PULL,
        quotaUsed,
        trackCount: addedCount,
        status: "error",
        error: message,
      },
    });
    throw err;
  }
}
