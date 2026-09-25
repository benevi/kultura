// ============================================================
// KULTURA — Ventana de catálogo: nada por delante de hoy (E-CATALOGO-FUTURO)
//
// Regla de producto: **el catálogo no muestra fechas futuras.** Nació en juegos
// (E-GAMES-FUTURO), donde "Más recientes" listaba fichas de 2027-2033 porque
// RAWG acepta fechas de lanzamiento inventadas y `ordering=-released` las pone
// justo en la primera página. El mismo agujero existía en el resto de familias:
// ordenar por fecha descendente sin acotar por arriba es pedirle al proveedor
// que enseñe primero lo que aún no existe.
//
// Cada proveedor la aplica con SU operador nativo (ver cada `*-maps.ts`):
//   movie/tv → `primary_release_date.lte` / `first_air_date.lte`  (TMDB)
//   anime    → `startDate_lesser` (FuzzyDateInt)                  (AniList)
//   game     → `dates=a,b`                                        (RAWG)
//   comic    → `filter=cover_date:a|b`                            (ComicVine)
//   book     → `first_publish_year:[a TO b]`                      (Open Library)
//   manga    → NO tiene rango de año (solo igualdad) → post-filtro, ver
//              `dropFutureYears`.
//
// **La excepción:** `series` y `anime` ofrecen `estado=upcoming`. Ahí el futuro
// es exactamente lo que el usuario pide, así que el tope NO se aplica — si no,
// el filtro devolvería siempre cero resultados, que es la otra forma de mentir.
//
// **Rango enteramente futuro:** si el rango pedido EMPIEZA después de hoy se
// respeta sin recortar. Hoy la UI no ofrece años futuros, pero recortar un
// rango así daría una ventana invertida (inicio > fin) = catálogo vacío.
//
// `today` es inyectable en todo el módulo para poder testear sin depender del
// reloj de la máquina.
// ============================================================

import type { MediaItem } from "@/types/media";

/** `Date` → `YYYY-MM-DD` en UTC (el formato que aceptan RAWG/TMDB/ComicVine). */
export function todayIso(today: Date = new Date()): string {
  return today.toISOString().slice(0, 10);
}

/** Año en curso (UTC). Para proveedores cuyo grano es el año (Open Library). */
export function todayYear(today: Date = new Date()): number {
  return today.getUTCFullYear();
}

/**
 * Recorta el extremo superior de un rango `YYYY-MM-DD` a hoy. Si el rango
 * empieza en el futuro se devuelve intacto (ver cabecera).
 */
export function clampRangeToToday(
  start: string,
  end: string,
  today: Date = new Date()
): { start: string; end: string } {
  const iso = todayIso(today);
  if (start > iso) return { start, end };
  return { start, end: end > iso ? iso : end };
}

/**
 * Post-filtro de último recurso: descarta items cuyo AÑO ya publicado es
 * posterior al actual. Solo se usa donde el proveedor no ofrece rango de fecha
 * (manga/MangaDex). Los items sin año se conservan: no sabemos que mientan.
 *
 * Es un recorte marginal y NO condicionado por filtros del usuario, del mismo
 * tipo que el filtro NSFW global — por eso no cuenta como "post-filtro activo"
 * a efectos de `hasActivePostFilter` (ver `discover.ts`).
 */
export function dropFutureYears<T extends Pick<MediaItem, "year">>(
  items: T[],
  today: Date = new Date()
): T[] {
  const year = todayYear(today);
  return items.filter((item) => typeof item.year !== "number" || item.year <= year);
}
