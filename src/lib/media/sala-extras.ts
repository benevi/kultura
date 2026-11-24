// ============================================================
// KULTURA — Lo que la ficha con «Sala» añade a los datos de siempre (fase 8.5, F5)
//
// Solo con la sala encendida (bandera `SALA_FICHA`, la lee la página): con
// ella apagada no se llama a nada de esto y la ficha sale igual que siempre.
//
// F5b · La apaisada SIN rótulo de TMDB (`include_image_language=null`) para la
// cabecera de la sala de una película, una serie o un anime servido por TMDB.
// Condiciones de la revisión de términos (24-11-2026):
//   - Se carga directa de `image.tmdb.org` (los loaders de `poster-url.ts`),
//     sin el optimizador de Vercel ni copia propia.
//   - Recorte y velo solo en CSS (`SalaStage`): nada se compone en el
//     servidor. Por eso NO entra en `item.backdrop`, que usan la imagen para
//     compartir (OG) y la caché de la biblioteca: solo la pinta la sala.
//   - Solo en la ficha de su propia obra.
// ============================================================

import { getTmdbImages, tmdbTextlessBackdrop } from "@/lib/api/tmdb";
import { fromTmdbAnimeRef, isTmdbAnimeId } from "@/lib/api/anime-tmdb";
import type { MediaItem } from "@/types/media";
import type { SalaFichaExtras } from "./sala-item";

export type { SalaFichaExtras } from "./sala-item";

/** Película o serie de TMDB que es esta misma ficha, o `null`. */
export function tmdbRefOf(item: Pick<MediaItem, "type" | "externalId">): { kind: "movie" | "tv"; id: number } | null {
  const id = item.type === "anime" ? (isTmdbAnimeId(item.externalId) ? fromTmdbAnimeRef(item.externalId) : NaN) : Number(item.externalId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (item.type === "movie") return { kind: "movie", id };
  if (item.type === "tv" || item.type === "anime") return { kind: "tv", id };
  return null;
}

/** La apaisada sin rótulo de TMDB, o `undefined` (sin ella, la de siempre). Nunca lanza. */
export async function textlessBackdropOf(ref: { kind: "movie" | "tv"; id: number } | null): Promise<string | undefined> {
  if (!ref) return undefined;
  try {
    return tmdbTextlessBackdrop(await getTmdbImages(ref.kind, ref.id));
  } catch {
    // TMDB caído o sin imágenes: la sala sigue con la apaisada de la ficha.
    return undefined;
  }
}

/** Lo que la sala añade a la ficha. Nunca lanza: lo que falla, no se añade. */
export async function loadSalaFichaExtras(item: MediaItem): Promise<SalaFichaExtras> {
  const backdrop = await textlessBackdropOf(tmdbRefOf(item));
  return backdrop ? { backdrop } : {};
}
