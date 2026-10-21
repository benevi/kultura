// ============================================================
// KULTURA — Portada de ilustración (landing)
// Pieza de las composiciones de las cards: portada real con sombra dura de
// pegatina (F0) o, sin datos, el gradiente de respaldo del mismo matiz. La
// landing NUNCA depende de que haya portadas.
// ============================================================

import { PosterTile, STICKER_SHADOW, fallbackGradient } from "@/components/landing/PosterTile";
import { cn } from "@/lib/utils/index";

export interface ArtPosterProps {
  item?: { id: string; title: string; type: never | string; poster: string } | null;
  /** Semilla del gradiente de respaldo. */
  seed: string;
  className?: string;
  style?: React.CSSProperties;
  sizes?: string;
  children?: React.ReactNode;
}

export function ArtPoster({ item, seed, className, style, sizes = "160px", children }: ArtPosterProps) {
  const merged = { boxShadow: STICKER_SHADOW, ...style };
  if (item) {
    return (
      <PosterTile
        item={item as Parameters<typeof PosterTile>[0]["item"]}
        radius="card"
        sizes={sizes}
        className={className}
        style={merged}
      >
        {children}
      </PosterTile>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn("relative overflow-hidden aspect-[2/3] rounded-card", className)}
      style={{ background: fallbackGradient(seed), ...merged }}
    >
      {children}
    </div>
  );
}
