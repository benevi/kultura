import { Cromo, type CromoProps } from "@/components/album/Cromo";

/**
 * La tarjeta de póster de KULTURA (DIS-7), ahora un `Cromo` del álbum: una
 * sola, la misma en Inicio, Descubrir, listas y perfil público. Borde blanco
 * de 3 px, radio de cromo (4 px, `rounded-cromo`), 2:3 y el respaldo de color
 * SIEMPRE detrás y PRIMERO en el DOM (E-CARD-PORTADA-404). El título va
 * DEBAJO, como texto, en quien lo use.
 *
 * Se conserva con su API de siempre para que las filas que ya la usan
 * hereden el cromo sin cambios; en código nuevo, `Cromo` directamente (con
 * estado, progreso y brillo).
 *
 * Sin `"use client"`: la usan componentes de servidor y de cliente. `onFail`
 * solo puede pasarse desde un componente de cliente.
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
  ...cromo
}: {
  /** Semilla del respaldo (id del título). */
  seed: string;
  title: string;
  poster?: string | null;
  sizes: string;
  priority?: boolean;
  onFail?: () => void;
  /** Ocupa el alto de su celda (rejilla bento) en vez de 2:3. */
  fill?: boolean;
  className?: string;
  /** Capas encima de la portada (nota, número de posición…). */
  children?: React.ReactNode;
} & Pick<CromoProps, "state" | "format" | "progress" | "progressLabel" | "stateLabel" | "foil" | "still" | "paste">) {
  return (
    <Cromo
      seed={seed}
      title={title}
      poster={poster}
      sizes={sizes}
      priority={priority}
      onPosterFail={onFail}
      fill={fill}
      className={className}
      {...cromo}
    >
      {children}
    </Cromo>
  );
}
