"use client";

import Image from "next/image";
import { bestPosterLoader } from "@/lib/best/poster";

/**
 * Portada de un ranking (SEO-10, D-10). A diferencia de `PosterImage`
 * (decorativa en el catálogo), aquí la imagen lleva `alt` con el título:
 * Google Imágenes la asocia al título y el ranking no tiene ninguna imagen
 * con `alt=""`. Rellena su contenedor, que lleva DETRÁS el gradiente; el
 * contenedor va `aria-hidden` cuando el título ya está en texto al lado.
 */
export function BestPoster({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <Image
      loader={bestPosterLoader}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover"
    />
  );
}
