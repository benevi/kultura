import { PosterImage } from "@/components/media/PosterImage";
import { POSTER_RADIUS, posterShapeClass, type PosterRadius } from "@/components/media/poster-frame-class";
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
 * También las miniaturas de fila (calendario, diario, actividad de Inicio,
 * adaptaciones; C14): `radius="sm"`, medidas fijas en `className`, sin
 * iniciales ni zoom.
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
  radius = "md",
  initials = true,
  zoom = true,
  elevated = true,
  as: Tag = "div",
  "aria-hidden": ariaHidden,
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
  /** `md` = 16 px (póster), `sm` = 8 px (miniatura de fila). */
  radius?: PosterRadius;
  /** Iniciales sobre el gradiente (apagadas en las miniaturas). */
  initials?: boolean;
  /** Zoom de la portada al pasar el ratón por el `group` de fuera. */
  zoom?: boolean;
  /**
   * Fondo `surface-elevated` en el marco, debajo del gradiente. Sin él, el
   * borde redondeado se suaviza solo contra la página (como los marcos que
   * pintaban el gradiente en el propio marco).
   */
  elevated?: boolean;
  /** `span` dentro de un enlace o de otro contenido en línea. */
  as?: "div" | "span";
  "aria-hidden"?: boolean | "true" | "false";
  className?: string;
  /** Capas encima del póster (pastillas de nota, número de posición…). */
  children?: React.ReactNode;
}) {
  return (
    <Tag
      aria-hidden={ariaHidden}
      className={cn(
        "relative w-full overflow-hidden",
        POSTER_RADIUS[radius],
        elevated && "bg-surface-elevated",
        posterShapeClass(fill),
        className
      )}
    >
      <Tag
        data-placeholder
        aria-hidden="true"
        className={cn("absolute inset-0", initials && "flex items-center justify-center")}
        style={{ background: posterGradient(seed || title) }}
      >
        {initials ? (
          <span aria-hidden="true" className="line-clamp-2 px-2 text-center font-display text-lg font-extrabold text-white/90">
            {title.slice(0, 2).toUpperCase()}
          </span>
        ) : null}
      </Tag>
      {poster ? (
        <PosterImage
          src={poster}
          sizes={sizes}
          priority={priority}
          className={
            zoom
              ? "object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
              : "object-cover"
          }
          onFail={onFail}
        />
      ) : null}
      {children}
    </Tag>
  );
}
