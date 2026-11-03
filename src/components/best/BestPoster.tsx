"use client";

import Image from "next/image";
import { bestPosterLoader } from "@/lib/best/poster";

/**
 * Portada de un ranking (SEO-10, D-10). A diferencia de `PosterImage`
 * (decorativa en el catálogo), aquí la imagen lleva `alt` con el título:
 * Google Imágenes la asocia al título y el ranking no tiene ninguna imagen
 * con `alt=""`. Rellena su contenedor (el `Cromo`, que lleva DETRÁS su
 * respaldo de color); el contenedor va `aria-hidden` cuando el título ya está
 * en texto al lado.
 *
 * Carga (LCP): `first` = la primera portada de la página, `fetchpriority=high`
 * y sin carga diferida; `eager` = visible en la primera pantalla (sin carga
 * diferida, prioridad normal). El resto, diferidas.
 */
export function BestPoster({
  src,
  alt,
  sizes,
  first = false,
  eager = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  first?: boolean;
  eager?: boolean;
}) {
  return (
    <Image
      loader={bestPosterLoader}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={first}
      fetchPriority={first ? "high" : undefined}
      loading={first || eager ? "eager" : "lazy"}
      className="object-cover"
    />
  );
}
