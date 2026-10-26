import { PosterImage } from "@/components/media/PosterImage";
import { posterGradient } from "@/lib/images/poster-gradient";
import { cn } from "@/lib/utils/index";

/**
 * La tarjeta de póster de KULTURA (DIS-7): una sola, la misma en Inicio,
 * Descubrir, listas y perfil público. Radio de póster (16 px, `rounded-2xl`),
 * proporción 2:3 y el gradiente de respaldo SIEMPRE detrás y PRIMERO en el DOM
 * (E-CARD-PORTADA-404): si la portada da 404 queda color de la paleta con las
 * iniciales, nunca un hueco. El título va DEBAJO del póster, como texto, en
 * quien lo use (legible sobre cualquier portada).
 *
 * Sin `"use client"`: la usan tanto componentes de servidor (perfil público)
 * como de cliente. `onFail` solo puede pasarse desde un componente de cliente.
 */
export function PosterFrame({
  seed,
  title,
  poster,
  sizes,
  priority = false,
  onFail,
  fill = false,
  className,
  children,
}: {
  /** Semilla del gradiente (id del título). */
  seed: string;
  /** Título: de él salen las iniciales del respaldo (decorativas). */
  title: string;
  poster?: string | null;
  sizes: string;
  priority?: boolean;
  onFail?: () => void;
  /** Ocupa el alto de su celda (rejilla bento) en vez de 2:3. */
  fill?: boolean;
  className?: string;
  /** Capas encima del póster (pastillas de nota, número de posición…). */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-surface-elevated",
        fill ? "h-full min-h-[110px]" : "aspect-[2/3]",
        className
      )}
    >
      <div
        data-placeholder
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: posterGradient(seed || title) }}
      >
        <span aria-hidden="true" className="line-clamp-2 px-2 text-center font-display text-lg font-extrabold text-white/90">
          {title.slice(0, 2).toUpperCase()}
        </span>
      </div>
      {poster ? (
        <PosterImage
          src={poster}
          sizes={sizes}
          priority={priority}
          className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
          onFail={onFail}
        />
      ) : null}
      {children}
    </div>
  );
}
