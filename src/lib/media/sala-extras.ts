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
//
// F5c · Anime de AniList: se cruza con su ficha de TMDB por Wikidata
// (`anime-tmdb-cross.ts`) y, si el cruce vale, la sala gana la apaisada (sin
// rótulo si la hay) y, solo en películas y primeras temporadas, el tráiler y
// «Dónde ver» de TMDB cuando AniList no los trae. Lo que venga de TMDB se cita
// en una segunda línea al pie (`extraSource`). Si tarda más de
// `SALA_EXTRAS_DEADLINE_MS`, la ficha sale sin ello (la caché se llena igual
// y la siguiente visita ya lo tiene).
// ============================================================

import { getMovie, getTmdbImages, getTV, tmdbBackdrop, tmdbTextlessBackdrop } from "@/lib/api/tmdb";
import { fromTmdbAnimeRef, isTmdbAnimeId } from "@/lib/api/anime-tmdb";
import { fromAniListRef, isAniListId } from "@/lib/api/anilist";
import { tmdbRegion } from "@/lib/api/locale";
import { normalizeMovie, normalizeTV } from "@/lib/api/normalizer";
import { findAnimeTmdbCross } from "./anime-tmdb-cross";
import { extractWatchOffer } from "./watch-providers";
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

/** Como mucho esto espera la ficha a lo que añade la sala (el cruce en frío: AniList, WDQS y TMDB). */
export const SALA_EXTRAS_DEADLINE_MS = 5000;

export interface SalaExtrasContext {
  /** Idioma de la página (TMDB: textos, región de «Dónde ver»). */
  locale: string;
  /** La ficha ya tiene tráiler (el de AniList manda). */
  hasTrailer: boolean;
  /** La ficha ya tiene «Dónde ver». */
  hasProviders: boolean;
}

function withDeadline<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([work.catch(() => fallback), late]).finally(() => clearTimeout(timer));
}

/** Lo de TMDB que gana un anime de AniList cruzado por Wikidata (F5c). Nunca lanza. */
export async function animeCrossExtras(item: MediaItem, ctx: SalaExtrasContext): Promise<SalaFichaExtras> {
  if (item.type !== "anime" || !isAniListId(item.externalId)) return {};
  const cross = await findAnimeTmdbCross(fromAniListRef(item.externalId));
  if (!cross) return {};
  const ref = { kind: cross.kind, id: cross.id };
  const [textless, detail] = await Promise.all([
    textlessBackdropOf(ref),
    (cross.kind === "movie" ? getMovie(cross.id, ctx.locale) : getTV(cross.id, ctx.locale)).catch(() => null),
  ]);

  const extras: SalaFichaExtras = {};
  const backdrop = textless ?? (detail ? tmdbBackdrop(detail.backdrop_path) : undefined);
  if (backdrop && !item.backdrop) extras.backdrop = backdrop;
  // Temporada posterior (`scope: "image"`): de TMDB, solo la imagen.
  if (cross.scope === "full" && detail) {
    if (!ctx.hasTrailer) {
      const key = cross.kind === "movie" ? normalizeMovie(detail as Parameters<typeof normalizeMovie>[0]).trailerKey : normalizeTV(detail as Parameters<typeof normalizeTV>[0]).trailerKey;
      if (key) extras.trailerKey = key;
    }
    if (!ctx.hasProviders) {
      const offer = extractWatchOffer(detail["watch/providers"], tmdbRegion(ctx.locale));
      if (offer.providers.length > 0) {
        extras.providers = offer.providers;
        if (offer.link) extras.watchLink = offer.link;
      }
    }
  }
  if (extras.backdrop || extras.trailerKey || extras.providers) {
    extras.extraSource = { name: "TMDB", url: `https://www.themoviedb.org/${cross.kind}/${cross.id}` };
  }
  return extras;
}

/** Lo que la sala añade a la ficha. Nunca lanza: lo que falla (o tarda), no se añade. */
export async function loadSalaFichaExtras(item: MediaItem, ctx: SalaExtrasContext): Promise<SalaFichaExtras> {
  if (item.type === "anime" && isAniListId(item.externalId)) {
    return withDeadline(animeCrossExtras(item, ctx), SALA_EXTRAS_DEADLINE_MS, {});
  }
  const backdrop = await textlessBackdropOf(tmdbRefOf(item));
  return backdrop ? { backdrop } : {};
}
