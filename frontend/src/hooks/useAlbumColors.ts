import { useEffect, useState } from "react";
import { getPaletteSync } from "colorthief";

interface AlbumColors {
  dominant: string;
  accent: string;
}

function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function darkenHex(hex: string, factor: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function useAlbumColors(thumbnailUrl: string | null): AlbumColors | null {
  const [colors, setColors] = useState<AlbumColors | null>(null);

  useEffect(() => {
    if (!thumbnailUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = thumbnailUrl;

    let cancelled = false;

    img.onload = () => {
      if (cancelled) return;
      try {
        const palette = getPaletteSync(img, { colorCount: 3 });
        if (!palette || palette.length < 1) {
          setColors(null);
          return;
        }

        let dominant = palette[0].hex();
        let accent = (palette[1] ?? palette[0]).hex();

        const dRgb = palette[0].rgb();
        const aRgb = (palette[1] ?? palette[0]).rgb();

        if (luminance(dRgb.r, dRgb.g, dRgb.b) > 0.7) {
          dominant = darkenHex(dominant, 0.4);
        }
        if (luminance(aRgb.r, aRgb.g, aRgb.b) > 0.7) {
          accent = darkenHex(accent, 0.4);
        }

        setColors({ dominant, accent });

        const root = document.documentElement;
        root.style.setProperty("--np-dynamic-color", dominant);
        root.style.setProperty("--np-dynamic-glow", hexToRgba(dominant, 0.2));
      } catch {
        setColors(null);
      }
    };

    img.onerror = () => {
      if (!cancelled) setColors(null);
    };

    return () => {
      cancelled = true;
    };
  }, [thumbnailUrl]);

  return colors;
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
