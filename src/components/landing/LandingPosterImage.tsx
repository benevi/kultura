"use client";

// ============================================================
// KULTURA — Portada de la landing que nunca deja un icono roto
//
// `PosterTile` pinta el gradiente de respaldo DETRÁS y la portada encima. Si
// la portada falla (404, host caído, optimizador que no llega) el navegador
// dejaba el icono de imagen rota sobre el gradiente. Aquí, al primer `error`,
// la imagen se retira y queda el gradiente: sin hueco ni icono.
//
// `<img>` nativo y no `next/image` (F-30): es la única pieza cliente de la
// portada que lo usaba, y su código (~6 KB) era lo que dejaba el JS de `/es`
// por encima de los 150 KB. Hace lo mismo que `PosterImage`: mismo
// `posterLoader` (tamaño nativo del CDN del proveedor), `srcset` + `sizes`,
// carga diferida salvo la prioritaria y relleno de la caja (`fill`).
// ============================================================

import * as React from "react";
import { posterLoader } from "@/lib/images/poster-url";

/** Anchos ofrecidos: las piezas de la landing miden de 44 a 220 px. */
export const LANDING_WIDTHS = [64, 96, 128, 256, 384, 640] as const;

export function landingSrcSet(src: string): string {
  return LANDING_WIDTHS.map((w) => `${posterLoader({ src, width: w })} ${w}w`).join(", ");
}

export function LandingPosterImage({
  src,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLImageElement>(null);
  // La portada llega en el HTML estático: si da 404 ANTES de hidratar, su
  // `error` ya ocurrió y `onError` no se entera (quedaba el icono de imagen
  // rota). Al montar, una imagen terminada sin píxeles es una imagen rota.
  React.useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src]);
  // Por URL: si la muestra cambia, la portada nueva se vuelve a intentar.
  if (failedSrc === src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={posterLoader({ src, width: 384 })}
      srcSet={landingSrcSet(src)}
      sizes={sizes}
      alt=""
      aria-hidden="true"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`absolute inset-0 h-full w-full ${className ?? ""}`}
      onError={() => setFailedSrc(src)}
    />
  );
}
