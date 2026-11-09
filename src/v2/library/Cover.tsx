"use client";

import { useEffect, useRef, useState } from "react";
import { posterLoader } from "@/lib/images/poster-url";

// Portada de la Biblioteca y del diario. Sin imagen, o si falla, el color del
// formato con el título: son títulos de la persona y no se pueden perder.
export function Cover({
  poster,
  title,
  widths,
  sizes,
  loading = "lazy",
  priority = false,
}: {
  poster?: string | null;
  title: string;
  /** Tamaños que acepta el optimizador (`imageSizes` y `deviceSizes` de Next). */
  widths: number[];
  sizes: string;
  loading?: "eager" | "lazy";
  priority?: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  // Una portada puede fallar antes de hidratar, y entonces `onError` ya no llega.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (!poster || failed) {
    return (
      <span className="k2b-cover k2b-cover--plain" aria-hidden="true">
        {title}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      className="k2b-cover"
      src={posterLoader({ src: poster, width: widths[widths.length - 1] })}
      srcSet={widths.map((width) => `${posterLoader({ src: poster, width })} ${width}w`).join(", ")}
      sizes={sizes}
      onError={() => setFailed(true)}
      alt=""
      width={500}
      height={750}
      decoding="async"
      loading={loading}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
