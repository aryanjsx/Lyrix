import { Request, Response } from "express";
import { getDownloadStream } from "../services/downloadService";

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
    const result = await getDownloadStream(videoId);

    if (!result) {
      res.status(502).json({ error: "Unable to fetch audio stream" });
      return;
    }

    const safeName = result.title
      .replace(/[<>:"/\\|?*]+/g, "_")
      .slice(0, 200);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(safeName)}.mp3"`
    );
    res.setHeader("Content-Type", result.mimeType || "audio/mpeg");

    if (result.contentLength > 0) {
      res.setHeader("Content-Length", String(result.contentLength));
    }

    result.stream.pipe(res);

    result.stream.on("error", () => {
      if (!res.writableEnded) res.end();
    });
  } catch (err) {
    if (!res.headersSent) {
      console.error("[Download] Error:", err);
      res.status(500).json({ error: "Download failed" });
    }
  }
}
