import Link from "next/link";
import { slugify } from "@/lib/slugify";
import type { CSSProperties } from "react";

interface ArtistLinkProps {
  name: string;
  className?: string;
  style?: CSSProperties;
}

export function ArtistLink({ name, className = "", style }: ArtistLinkProps) {
  if (!name) return null;
  return (
    <Link
      href={`/artist/${slugify(name)}`}
      onClick={(e) => e.stopPropagation()}
      className={`hover:underline hover:text-white transition-colors ${className}`}
      style={style}
    >
      {name}
    </Link>
  );
}
