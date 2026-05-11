import { useEffect } from "react";
import { useLyrixStore } from "@/store";
import { useAlbumColors, hexToRgba } from "@/hooks/useAlbumColors";

export function AppBackground({ children }: { children: React.ReactNode }) {
  const thumbnail = useLyrixStore((s) => s.queue.current?.thumbnail ?? null);
  const colors = useAlbumColors(thumbnail);

  useEffect(() => {
    if (!colors) return;
    const root = document.documentElement;
    root.style.setProperty("--color-dominant", colors.dominant);
    root.style.setProperty("--color-accent", colors.accent);
    root.style.setProperty(
      "--color-dominant-muted",
      hexToRgba(colors.dominant, 0.6)
    );
  }, [colors]);

  return <div className="app-background overflow-x-hidden">{children}</div>;
}
