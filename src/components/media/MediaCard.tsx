"use client";

import { Cromo } from "@/components/album/Cromo";
import { FormatTag } from "@/components/album/FormatTag";
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
   * Retirado con el álbum de cromos (sin degradados fuera del brillo). Se
   * acepta y se ignora para no romper a quien aún lo pase.
   * @deprecated
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

/**
 * Card de catálogo: un `Cromo` pegado con el título y el año DEBAJO (se lee
 * igual sobre cualquier portada). La nota va en una caja de número sobre la
 * esquina, con formato del idioma (8,5) y nombre para el lector; el formato,
 * como `FormatTag` (punto + nombre) bajo el título, nunca encima de la
 * portada. El enlace levanta la esquina del cromo con ratón y con teclado.
 */
export function MediaCard({
  item,
  showType = false,
  priority = false,
  className,
  aspect = "2/3",
  onPosterError,
  headingLevel = 3,
}: MediaCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const href = `/media/${item.type}/${item.externalId}` as const;
  // Nombre del formato en singular (R5b/R6): `discoverFilters.typeBadge`.
  const tBadge = useTranslations("discoverFilters.typeBadge");
  const tAlbum = useTranslations("album");
  // La nota sale con el formato del idioma (8,5 / 8.5) desde el propio
  // mensaje ICU (`album.score`), sin `toFixed` (WIG).
  const score = typeof item.rating === "number" ? item.rating : null;

  return (
    <Link
      href={href}
      className={cn(
        "group block h-full rounded-cromo",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring",
        className
      )}
    >
      <article className={cn(aspect === "fill" && "flex h-full flex-col")}>
        <Cromo
          seed={item.id || item.title}
          title={item.title}
          poster={item.poster}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
          priority={priority}
          onPosterFail={onPosterError ? () => onPosterError(item.id) : undefined}
          fill={aspect === "fill"}
          className={aspect === "fill" ? "min-h-0 flex-1" : undefined}
        >
          {score !== null ? (
            <span className="absolute bottom-1.5 right-1.5 z-[1] inline-flex h-6 items-center gap-1 rounded-cromo bg-surface-base px-1.5 text-xs font-bold leading-none tabular-nums text-text-primary">
              <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 text-accent-highlight" fill="currentColor">
                <path d="M6 .8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L6 9l-3.2 1.7.6-3.6L.8 4.6l3.6-.5z" />
              </svg>
              <span aria-hidden="true">{tAlbum("score", { score })}</span>
              <span className="sr-only">{tAlbum("rating", { score })}</span>
            </span>
          ) : null}
        </Cromo>

        <Heading className="mt-2 line-clamp-2 font-body text-sm font-semibold leading-tight text-text-primary" title={item.title}>
          {item.title}
        </Heading>
        {showType || item.year ? (
          <p className="mt-1 flex min-w-0 items-center gap-2 text-xs text-text-tertiary">
            {showType ? <FormatTag data-testid="media-type-badge" format={item.type} label={tBadge(item.type)} /> : null}
            {item.year ? <span className="tabular-nums">{item.year}</span> : null}
          </p>
        ) : null}
      </article>
    </Link>
  );
}
