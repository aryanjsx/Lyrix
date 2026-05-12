import { useState, useCallback } from "react";
import { useLyrixStore } from "@/store";
import { downloadTrack } from "@/services/downloadService";
import { toast } from "@/components/ui/Toast";
import { useAuth } from "./useAuth";

export function useDownload() {
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const { login } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const download = useCallback(
    async (videoId: string, title: string) => {
      if (!isLoggedIn) {
        toast("Sign in to download music", "info");
        login();
        return;
      }

      if (downloading) return;

      setDownloading(true);
      toast("Starting download…", "info");

      try {
        await downloadTrack(videoId, title);
        toast("Download complete", "success");
      } catch {
        toast("Download failed — please try again", "error");
      } finally {
        setDownloading(false);
      }
    },
    [isLoggedIn, login, downloading]
  );

  return { download, downloading };
}
