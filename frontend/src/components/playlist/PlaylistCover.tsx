interface Props {
  thumbnails: string[];
  customCover?: string | null;
  size?: number;
  className?: string;
}

export function PlaylistCover({
  thumbnails,
  customCover,
  size = 160,
  className = "",
}: Props) {
  if (customCover) {
    return (
      <img
        src={customCover}
        alt="Playlist cover"
        className={`rounded-xl object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const thumbs = thumbnails.slice(0, 4);

  if (thumbs.length === 0) {
    return (
      <div
        className={`rounded-xl bg-white/5 flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
    );
  }

  if (thumbs.length === 1) {
    return (
      <img
        src={thumbs[0]}
        alt="Playlist cover"
        className={`rounded-xl object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-xl overflow-hidden grid grid-cols-2 gap-0.5 ${className}`}
      style={{ width: size, height: size }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <img
          key={i}
          src={thumbs[i] ?? thumbs[thumbs.length - 1]}
          alt=""
          className="w-full h-full object-cover"
        />
      ))}
    </div>
  );
}
