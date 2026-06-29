import { Request, Response } from "express";
import { getAudioStream, AudioStreamResult } from "../services/downloadService";

const MAX_RETRIES = 2;

async function streamAudio(
  stream: AudioStreamResult,
  res: Response
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const audioRes = await fetch(stream.proxyUrl, {
      signal: controller.signal,
    });

    if (!audioRes.ok || !audioRes.body) return false;

    const safeName = stream.title
      .replace(/[<>:"/\\|?*]+/g, "_")
      .slice(0, 200);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(safeName)}.mp3"`
    );
    res.setHeader("Content-Type", stream.mimeType || "audio/mpeg");

    if (stream.contentLength > 0) {
      res.setHeader("Content-Length", String(stream.contentLength));
    } else {
      const cl = audioRes.headers.get("content-length");
      if (cl) res.setHeader("Content-Length", cl);
    }

    const reader = audioRes.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.writableEnded) {
        res.write(Buffer.from(value));
      }
    }

    res.end();
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleDownload(
  req: Request,
  res: Response
): Promise<void> {
  const videoId = req.params.videoId as string | undefined;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  const triedInstances: string[] = [];

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const stream = await getAudioStream(videoId, triedInstances);

      if (!stream) break;

      const instanceOrigin = new URL(stream.proxyUrl).origin;
      triedInstances.push(instanceOrigin);

      if (res.headersSent) break;

      const ok = await streamAudio(stream, res);
      if (ok) return;

      if (res.headersSent) break;
      console.warn(
        `[Download] Attempt ${attempt + 1} failed for ${videoId} via ${instanceOrigin}`
      );
    }

    if (!res.headersSent) {
      res.status(502).json({ error: "Unable to fetch audio stream" });
    }
  } catch (err) {
    if (!res.headersSent) {
      console.error("[Download] Error:", err);
      res.status(500).json({ error: "Download failed" });
    }
  }
}
