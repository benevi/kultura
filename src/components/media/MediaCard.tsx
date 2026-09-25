"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";
import type { MediaItem } from "@/types/media";

// Matices reutilizados literalmente del canvas F0 v2 para posters sin imagen
// real — nunca gris plano: siempre un gradiente de dos paradas del mismo
// matiz (ver CLAUDE.md → "Posters / cards sin imagen real").
const POSTER_HUES = [300, 55, 320, 220, 160, 40, 150, 260, 95, 350, 130, 25, 45, 250];

function posterGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = POSTER_HUES[hash % POSTER_HUES.length];
  return `linear-gradient(155deg, oklch(50% 0.15 ${hue}), oklch(28% 0.08 ${hue}))`;
}

export interface MediaCardProps {
  item: MediaItem;
  showType?: boolean;
  priority?: boolean;
  className?: string;
  /** 'fill' para grid bento (la imagen ocupa el alto que le da la celda del grid). Default '2/3'. */
  aspect?: "2/3" | "fill";
  /**
   * Acento radial de esquina superior-izquierda de las "cards feature" del
   * bento (F0/CLAUDE.md §Cards feature grandes). Un matiz OKLCH (H de la
   * paleta) activa la capa; ausente = sin acento (comportamiento actual,
   * todos los consumidores fuera de MediaGrid layout="bento").
   */
  accentHue?: number;
}

export function MediaCard({
  item,
  showType = false,
  priority = false,
  className,
  aspect = "2/3",
  accentHue,
}: MediaCardProps) {
  const href = `/media/${item.type}/${item.externalId}` as const;
  // Badge de tipo (modo "all", R5b): label localizado vía discoverFilters.typeBadge
  // (singular, ≠ filters.<type> que es plural). R6.
  const tBadge = useTranslations("discoverFilters.typeBadge");

  return (
    <Link href={href} className={cn("group block h-full", className)}>
      <article className="h-full rounded-bento overflow-hidden cursor-pointer">
        <div
          className={cn(
            "relative w-full overflow-hidden bg-surface-elevated",
            aspect === "2/3" ? "aspect-[2/3]" : "h-full min-h-[110px]"
          )}
        >
          {item.poster ? (
            <Image
              src={item.poster}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority={priority}
            />
          ) : (
            <div
              data-placeholder
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: posterGradient(item.id || item.title) }}
            >
              <span className="text-white/90 text-xs font-display font-bold line-clamp-2 px-2 text-center">
                {item.title.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}

          {/* Acento radial de esquina (F0 §Cards feature grandes): solo en las
              cards "feature" del bento (MediaGrid las marca con accentHue).
              Va antes del scrim/badges para no taparlos. */}
          {accentHue !== undefined && (
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(120% 100% at 20% 10%, oklch(58% 0.2 ${accentHue} / 0.55) 0%, transparent 55%)`,
              }}
            />
          )}

          {/* E-MATCH-SIN-BADGE: el porcentaje de afinidad ya no se pinta en
              ninguna superficie. El match SIGUE calculándose y es el criterio
              con el que la IA elige las recomendaciones (`recommendations.ts`);
              lo que se retira es la etiqueta, no el motor.

              Scrim para que título/badges se lean sobre cualquier poster */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

          {/* Type badge overlay (modo "all", R5b) */}
          {showType && (
            <div
              data-testid="media-type-badge"
              className="absolute top-2 left-2 rounded-full bg-surface-base/80 backdrop-blur-sm text-text-primary text-[10px] font-semibold px-2 py-1 leading-none"
            >
              {tBadge(item.type)}
            </div>
          )}

          {/* Rating overlay */}
          {item.rating !== undefined && (
            <div className="absolute bottom-2 right-2 rounded-full bg-surface-base/80 backdrop-blur-sm text-accent-highlight text-[11px] font-bold px-2 py-1 leading-none">
              ★ {item.rating.toFixed(1)}
            </div>
          )}

          {/* Título + año, superpuestos sobre el scrim */}
          <div className="absolute inset-x-2 bottom-2">
            <h3
              className="font-display text-sm font-bold text-white line-clamp-2 leading-tight"
              title={item.title}
            >
              {item.title}
            </h3>
            {item.year && (
              <p className="text-[11px] text-white/75 font-medium mt-0.5">{item.year}</p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
