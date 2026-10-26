"use client";

import { PosterFrame } from "@/components/media/PosterFrame";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";
import type { MediaItem } from "@/types/media";

export interface MediaCardProps {
  item: MediaItem;
  showType?: boolean;
  priority?: boolean;
  className?: string;
  /** 'fill' para grid bento (la imagen ocupa el alto que le da la celda del grid). Default '2/3'. */
  aspect?: "2/3" | "fill";
  /**
   * Acento radial de esquina superior-izquierda de las "cards feature" del
   * bento (F0/DISENO.md §Cards feature grandes). Un matiz OKLCH (H de la
   * paleta) activa la capa; ausente = sin acento (comportamiento actual,
   * todos los consumidores fuera de MediaGrid layout="bento").
   */
  accentHue?: number;
  /** La portada no ha cargado: la rejilla puede sacar la card (E-SIN-CARDS-VACIAS). */
  onPosterError?: (id: string) => void;
  /**
   * Nivel del título de la card (ACC-7): el que toca bajo el último
   * encabezado de la página (`h2` justo bajo el h1, `h3` bajo un h2). Por
   * defecto `h3`, el de siempre: las rejillas de Inicio y Descubrir van bajo
   * un h2 de sección.
   */
  headingLevel?: 2 | 3 | 4;
}

export function MediaCard({
  item,
  showType = false,
  priority = false,
  className,
  aspect = "2/3",
  accentHue,
  onPosterError,
  headingLevel = 3,
}: MediaCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const href = `/media/${item.type}/${item.externalId}` as const;
  // Badge de tipo (modo "all", R5b): label localizado vía discoverFilters.typeBadge
  // (singular, ≠ filters.<type> que es plural). R6.
  const tBadge = useTranslations("discoverFilters.typeBadge");


  return (
    <Link href={href} className={cn("group block h-full", className)}>
      {/* DIS-7: la misma tarjeta de póster que Inicio, listas y perfil
          (`PosterFrame`), con el título DEBAJO y no encima con velo: se lee
          igual sobre cualquier portada. En la rejilla bento (`fill`) el
          póster ocupa lo que deja el título dentro de la celda. */}
      <article className={cn("cursor-pointer", aspect === "fill" && "flex h-full flex-col")}>
        <PosterFrame
          seed={item.id || item.title}
          title={item.title}
          poster={item.poster}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
          priority={priority}
          onFail={onPosterError ? () => onPosterError(item.id) : undefined}
          fill={aspect === "fill"}
          className={aspect === "fill" ? "min-h-0 flex-1" : undefined}
        >
          {/* Acento radial de esquina (F0 §Cards feature grandes): solo en las
              cards "feature" del bento (MediaGrid las marca con accentHue). */}
          {accentHue !== undefined && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(120% 100% at 20% 10%, oklch(58% 0.2 ${accentHue} / 0.55) 0%, transparent 55%)`,
              }}
            />
          )}

          {/* E-MATCH-SIN-BADGE: el porcentaje de afinidad ya no se pinta en
              ninguna superficie (el match sigue eligiendo recomendaciones). */}

          {/* Type badge overlay (modo "all", R5b) */}
          {showType && (
            <div
              data-testid="media-type-badge"
              className="absolute left-2 top-2 rounded-full bg-surface-base/80 px-2 py-1 text-xs font-semibold leading-none text-text-primary backdrop-blur-sm"
            >
              {tBadge(item.type)}
            </div>
          )}

          {/* Rating overlay */}
          {item.rating !== undefined && (
            <div className="absolute bottom-2 right-2 rounded-full bg-surface-base/80 px-2 py-1 text-xs font-bold leading-none text-accent-highlight backdrop-blur-sm">
              ★ {item.rating.toFixed(1)}
            </div>
          )}
        </PosterFrame>

        <Heading
          className="mt-2 line-clamp-2 font-display text-sm font-bold leading-tight text-text-primary"
          title={item.title}
        >
          {item.title}
        </Heading>
        {item.year ? <p className="mt-0.5 font-body text-xs text-text-tertiary">{item.year}</p> : null}
      </article>
    </Link>
  );
}
