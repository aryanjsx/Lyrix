import { toast } from "@/components/ui/Toast";

export interface ShareTarget {
  videoId: string;
  title: string;
  channel: string;
}

function buildTrackUrl(videoId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/track/${videoId}`;
}

async function copyLink(track: ShareTarget): Promise<void> {
  const url = buildTrackUrl(track.videoId);
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied", "success");
  } catch {
    const el = document.createElement("textarea");
    el.value = url;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    toast("Link copied", "success");
  }
}

async function nativeShare(track: ShareTarget): Promise<boolean> {
  if (!navigator.share) return false;

  try {
    await navigator.share({
      title: track.title,
      text: `Listen to "${track.title}" by ${track.channel} on Lyrix`,
      url: buildTrackUrl(track.videoId),
    });
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return true;
    return false;
  }
}

function shareToWhatsApp(track: ShareTarget): void {
  const url = buildTrackUrl(track.videoId);
  const text = encodeURIComponent(
    `"${track.title}" by ${track.channel} \u2014 Listen on Lyrix: ${url}`
  );
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
}

async function share(track: ShareTarget): Promise<void> {
  const usedNative = await nativeShare(track);
  if (!usedNative) {
    await copyLink(track);
  }
}

export const shareService = {
  buildTrackUrl,
  copyLink,
  nativeShare,
  shareToWhatsApp,
  share,
};
