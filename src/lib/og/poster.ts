// ============================================================
// KULTURA — Portadas para las tarjetas de compartir (next/og)
// ============================================================

import { posterLoader } from "@/lib/images/poster-url";

const POSTER_TIMEOUT_MS = 2500;

/** Descarga una portada pequeña como data URI. `null` si tarda, falla o no es JPEG/PNG. */
export async function posterDataUri(src: string): Promise<string | null> {
  const small = posterLoader({ src, width: 342 });
  // El optimizador de Next es relativo: aquí no hay origen, se pide el original.
  const url = small.startsWith("/") ? src : small;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(POSTER_TIMEOUT_MS) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    // satori solo pinta JPEG/PNG de forma fiable.
    if (!/image\/(jpeg|png)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
