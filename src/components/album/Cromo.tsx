import { PosterImage } from "@/components/media/PosterImage";
import { ProgressStrip } from "@/components/album/ProgressStrip";
import { cromoPlaceholder, type CromoState } from "@/lib/design/album";
import { cn } from "@/lib/utils/index";
import type { MediaType } from "@/types/media";

export interface CromoProps {
  /** Título: de él salen las iniciales del respaldo (decorativas). */
  title: string;
  /** Semilla del respaldo de color (id del título). Por defecto, el título. */
  seed?: string;
  /** Portada. En catálogo es obligatoria (`requirePoster` de la rejilla). */
  poster?: string | null;
  sizes: string;
  priority?: boolean;
  /** La portada no cargó. Solo desde un componente de cliente. */
  onPosterFail?: () => void;
  /**
   * `pasted` (completado, por defecto), `placed` (en curso: tira de
   * progreso al pie) o `folded` (abandonado: esquina doblada, legible).
   * Un pendiente no es un cromo: es un `Slot` vacío.
   */
  state?: CromoState;
  /** Formato: color de la tira de progreso. */
  format?: MediaType;
  /** Avance de 0 a 1 para `placed`. */
  progress?: number;
  /** Avance para el lector («Episodio 4 de 10»). */
  progressLabel?: string;
  /** Estado para el lector («Abandonado»), si no está escrito al lado. */
  stateLabel?: string;
  /** 10/10: brillo. */
  foil?: boolean;
  /** Ocupa el alto de su celda (rejilla bento) en vez de 2:3. */
  fill?: boolean;
  /** Sin la esquina que se levanta al pasar el ratón (piezas estáticas). */
  still?: boolean;
  /**
   * Reproducir el pegado (`in`, al pasar a completado) o el despegado (`out`,
   * 180 ms). Instantáneo con movimiento reducido.
   */
  paste?: "in" | "out";
  className?: string;
  /** Capas encima de la portada (nota, número…). */
  children?: React.ReactNode;
}

/**
 * El cromo (DISENO.md): la portada con su borde blanco de 3 px y radio 4 px.
 * El respaldo de color con las iniciales va SIEMPRE detrás y primero en el
 * DOM (E-CARD-PORTADA-404): si la portada da 404 queda el color, nunca un
 * hueco. El título va DEBAJO del cromo, como texto, en quien lo use.
 *
 * Con puntero fino, la esquina se levanta 4° al pasar el ratón por el cromo
 * o por su enlace (`group`) y también al enfocar ese enlace con teclado; la
 * sombra solo existe mientras está alzado (`.cromo` en globals.css).
 *
 * Sin `"use client"`: sirve en componentes de servidor y de cliente.
 */
export function Cromo({
  title,
  seed,
  poster,
  sizes,
  priority = false,
  onPosterFail,
  state = "pasted",
  format,
  progress,
  progressLabel,
  stateLabel,
  foil = false,
  fill = false,
  still = false,
  paste,
  className,
  children,
}: CromoProps) {
  return (
    <div
      data-cromo=""
      data-state={state}
      className={cn(
        "cromo relative w-full overflow-hidden rounded-cromo border-[3px] border-cromo-border bg-surface-elevated",
        fill ? "h-full min-h-[110px]" : "aspect-[2/3]",
        state === "folded" && "cromo-folded",
        foil && "cromo-foil",
        still && "cromo-static",
        paste === "in" && "animate-paste",
        paste === "out" && "animate-unpaste",
        className
      )}
    >
      <div
        data-placeholder
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: cromoPlaceholder(seed || title) }}
      >
        <span aria-hidden="true" className="line-clamp-2 px-2 text-center font-display text-2xl text-album-white/90">
          {title.slice(0, 2).toUpperCase()}
        </span>
      </div>
      {poster ? (
        <PosterImage src={poster} sizes={sizes} priority={priority} className="object-cover" onFail={onPosterFail} />
      ) : null}
      {state === "placed" && typeof progress === "number" ? (
        <ProgressStrip value={progress} format={format} label={progressLabel} className="absolute inset-x-0 bottom-0 z-[1]" />
      ) : null}
      {state === "folded" ? (
        <span
          aria-hidden="true"
          data-fold=""
          className="absolute right-0 top-0 z-[1] h-5 w-5 bg-cromo-back [clip-path:polygon(0_0,100%_100%,0_100%)]"
        />
      ) : null}
      {stateLabel ? <span className="sr-only">{stateLabel}</span> : null}
      {children}
    </div>
  );
}
