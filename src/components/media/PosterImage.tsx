"use client";

import Image from "next/image";
import { posterLoader } from "@/lib/images/poster-url";

/**
 * Portada de catálogo (E-PORTADAS-RAPIDAS). Siempre a través de
 * `posterLoader`: pide al CDN del proveedor el tamaño nativo justo en vez de
 * pasar por el optimizador en frío. Rellena su contenedor (`fill`), que debe
 * ser `relative` y llevar DETRÁS el gradiente de respaldo.
 *
 * `alt` vacío a propósito: en todas las cards el título va como texto al lado,
 * así que la imagen es decorativa (E-CARD-PORTADA-404).
 */
export function PosterImage({
  src,
  sizes,
  priority = false,
  className,
  onFail,
}: {
  src: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Se llama si la portada no carga (404, host caído…). */
  onFail?: () => void;
}) {
  return (
    <Image
      loader={posterLoader}
      src={src}
      alt=""
      aria-hidden="true"
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={onFail}
    />
  );
}
