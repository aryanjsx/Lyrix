import { useState } from "react";
import Image, { type ImageProps } from "next/image";

const YTIMG_PATTERN = /\/vi\/([a-zA-Z0-9_-]{11})\//;

function fallbackUrl(src: string): string {
  const match = src.match(YTIMG_PATTERN);
  if (match) return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
  return "";
}

const ALLOWED_HOSTS = new Set([
  "img.youtube.com",
  "i.ytimg.com",
  "lh3.googleusercontent.com",
  "music.youtube.com",
]);

function isAllowedHost(src: string): boolean {
  try {
    return ALLOWED_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

interface TrackThumbnailProps extends Omit<ImageProps, "onError" | "src" | "unoptimized"> {
  src: string;
}

export function TrackThumbnail({ src, alt, ...rest }: TrackThumbnailProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [errored, setErrored] = useState(false);

  const handleError = () => {
    if (errored) return;
    setErrored(true);
    const fb = fallbackUrl(src);
    if (fb && fb !== currentSrc) {
      setCurrentSrc(fb);
    }
  };

  if (errored && !fallbackUrl(src)) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(99,102,241,0.2))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      {...rest}
      src={currentSrc}
      alt={alt}
      unoptimized={!isAllowedHost(currentSrc)}
      onError={handleError}
    />
  );
}
