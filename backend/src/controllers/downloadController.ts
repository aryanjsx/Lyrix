import { Request, Response } from "express";
import { getAudioStream } from "../services/downloadService";

export async function handleDownload(
  req: Request,
  res: Response
): Promise<void> {
  const videoId = req.params.videoId as string | undefined;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  try {
    const stream = await getAudioStream(videoId);

    if (!stream) {
      res.status(502).json({ error: "Unable to fetch audio stream" });
      return;
    }

    const safeName = stream.title
      .replace(/[<>:"/\\|?*]+/g, "_")
      .slice(0, 200);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const audioRes = await fetch(stream.streamUrl, {
        signal: controller.signal,
      });

      if (!audioRes.ok || !audioRes.body) {
        res.status(502).json({ error: "Audio stream unavailable" });
        return;
      }

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(safeName)}.mp3"`
      );
      res.setHeader("Content-Type", "audio/mpeg");

      const contentLength = audioRes.headers.get("content-length");
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      const reader = audioRes.body.getReader();
      const pump = async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!res.writableEnded) {
            res.write(Buffer.from(value));
          }
        }
      };

      await pump();
      res.end();
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (!res.headersSent) {
      console.error("[Download] Error:", err);
      res.status(500).json({ error: "Download failed" });
    }
  }
}
