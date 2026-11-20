import { cn } from "@/lib/utils/index";

/** Radio del marco: `sm` = 8 px (miniaturas de fila), `md` = 16 px (póster). */
export type PosterRadius = "sm" | "md";

export const POSTER_RADIUS: Record<PosterRadius, string> = {
  sm: "rounded-lg",
  md: "rounded-2xl",
};

/** Proporción del marco: 2:3, o el alto de su celda (rejilla bento). */
export function posterShapeClass(fill = false): string {
  return fill ? "h-full min-h-[110px]" : "aspect-[2/3]";
}

/**
 * Clases del marco de póster (C14): posición, recorte, radio y proporción.
 * Las comparte `PosterFrame` con `/best`, que pinta su portada con
 * `BestPoster` (servidor, REN-1) y por eso no puede importar `PosterFrame`
 * (arrastraría el `next/image` de cliente de `PosterImage`). Este módulo no
 * importa nada de cliente.
 */
export function posterFrameClass({
  radius = "md",
  fill = false,
  className,
}: {
  radius?: PosterRadius;
  fill?: boolean;
  /** Medidas y ajustes de quien lo usa (ancho, `shrink-0`…). */
  className?: string;
} = {}): string {
  return cn("relative overflow-hidden", POSTER_RADIUS[radius], posterShapeClass(fill), className);
}
