// ============================================================
// KULTURA — Pieza de portada de la landing (E-LANDING-SHOWCASE)
//
// Primitivo del collage y de la tira móvil del hero. Todo sale del
// vocabulario ya en uso (CLAUDE.md): radio `rounded-bento`/`rounded-card`,
// sombra dura de pegatina `4px 4px 0 rgba(0,0,0,.35)`, gradiente de dos
// paradas del mismo matiz cuando no hay imagen real, rotaciones sutiles.
// No se inventa ninguna forma, radio ni sombra nueva.
// ============================================================

import Image from "next/image";
import { cn } from "@/lib/utils/index";
import type { ShowcaseItem } from "@/lib/landing/showcase";

/** Sombra de pegatina F0 (la misma del badge colgante del hero de Inicio). */
export const STICKER_SHADOW = "4px 4px 0 rgba(0,0,0,0.35)";

/**
 * Matices de la paleta para el relleno cuando una portada no carga. Mismo
 * criterio que `MediaCard`: gradiente de dos paradas del MISMO matiz, la
 * segunda más oscura y apagada — nunca gris plano.
 */
const FALLBACK_HUES = [350, 300, 130, 55, 250, 95, 320];

function fallbackGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = FALLBACK_HUES[hash % FALLBACK_HUES.length];
  return `linear-gradient(155deg, oklch(50% 0.15 ${hue}), oklch(28% 0.08 ${hue}))`;
}

export interface PosterTileProps {
  item: ShowcaseItem;
  /** Radio: `bento` (22px) para el hero, `card` (12px) para piezas pequeñas. */
  radius?: "bento" | "card";
  /** `sizes` de next/image — cada sitio sabe cuánto ocupa la pieza. */
  sizes: string;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Una portada real, en proporción 2/3. Decorativa: el `alt` va vacío porque el
 * título no aporta nada al mensaje de la landing (y leerlo en voz alta sería
 * ruido), pero el `title` real viaja en el gradiente de respaldo por si la
 * imagen no carga.
 */
export function PosterTile({
  item,
  radius = "bento",
  sizes,
  priority = false,
  className,
  style,
  children,
}: PosterTileProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden aspect-[2/3]",
        radius === "bento" ? "rounded-bento" : "rounded-card",
        className
      )}
      style={style}
    >
      {/* Respaldo PRIMERO en el DOM: la imagen se pinta encima, así que un 404
          de portada deja color de la paleta y no un hueco. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: fallbackGradient(item.id) }}
      />
      <Image
        src={item.poster}
        alt=""
        aria-hidden="true"
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
      {children}
    </div>
  );
}
