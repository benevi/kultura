"use client";

// ============================================================
// KULTURA — Portada de la landing que nunca deja un icono roto
//
// `PosterTile` pinta el gradiente de respaldo DETRÁS y la portada encima. Si
// la portada falla (404, host caído, optimizador que no llega) el navegador
// dejaba el icono de imagen rota sobre el gradiente. Aquí, al primer `error`,
// la imagen se retira y queda el gradiente: sin hueco ni icono.
// ============================================================

import * as React from "react";
import { PosterImage } from "@/components/media/PosterImage";

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
  // Por URL: si la muestra cambia, la portada nueva se vuelve a intentar.
  if (failedSrc === src) return null;
  return (
    <PosterImage
      src={src}
      sizes={sizes}
      priority={priority}
      className={className}
      onFail={() => setFailedSrc(src)}
    />
  );
}
