// ============================================================
// KULTURA — Datos de la ficha pública de un título (D-01, SEO-1)
//
// La ficha es pública e indexable: la pueden pedir Googlebot y cualquiera sin
// cuenta. El HTML sigue siendo dinámico (nonce de la CSP, cabecera según haya
// sesión), pero los DATOS del proveedor se guardan 24 h en la caché de datos
// de Next (compartida entre instancias), con el idioma en la clave. Así una
// ficha muy visitada cuesta una llamada al día a TMDB/RAWG/ComicVine en vez
// de una por visita (cupos de RAWG 20.000/mes y ComicVine 200/h, VERIF-C) y
// la segunda visita responde sin salir a la red.
//
// Nada de lo que depende del usuario (biblioteca, afinidad) entra aquí: eso lo
// pide la página aparte, sin caché compartida.
//
// Un título que el proveedor no da (404, caído, cupo) NO se guarda: se lanza
// dentro de `unstable_cache` (que no guarda rechazos) y fuera se convierte en
// `null`. Un hipo del proveedor no deja la ficha en 404 durante un día.
// ============================================================

import { unstable_cache } from "next/cache";
import type { MediaItem, MediaType, StreamingProvider } from "@/types/media";
import { getMovie, getTV, getTVProviders } from "@/lib/api/tmdb";
import { resolveApiLocale, tmdbRegion } from "@/lib/api/locale";
import { getAnime as getAnimeJikan, getAnimeVideos, getManga as getMangaJikan } from "@/lib/api/jikan";
import {
  getAnime as getAnimeAniList,
  getMangaAniList,
  isAniListId,
  fromAniListRef,
  normalizeAniListManga,
} from "@/lib/api/anilist";
import { getAnimeTmdb, isTmdbAnimeId } from "@/lib/api/anime-tmdb";
import { getManga as getMangaDex, isMangaDexId } from "@/lib/api/mangadex";
import { getBookDetail } from "@/lib/api/openlibrary";
import { enrichBookWithGoogle } from "@/lib/api/books-enrich";
import { cleanOpenLibraryDescription } from "@/lib/api/openlibrary-subjects";
import { getGoogleBookDetail, isOpenLibraryWorkId } from "@/lib/api/googlebooks";
import { getGame } from "@/lib/api/rawg";
import { getSteamInfoForGame, type SteamInfo } from "@/lib/api/steam";
import { getComic } from "@/lib/api/comicvine";
import {
  normalizeMovie,
  normalizeTV,
  normalizeAnime,
  normalizeAniListAnime,
  normalizeMangaJikan,
  normalizeMangaDex,
  normalizeBookGoogle,
  normalizeBookOpenLibrary,
  normalizeGame,
  normalizeComic,
} from "@/lib/api/normalizer";
import { localizeGenreLabels } from "@/lib/api/genre-label-maps";
import { isNSFW } from "@/lib/api/nsfw-filter";
import { createLogger } from "@/lib/logger";
import { parseMediaId } from "./media-id";
import { sourceLinkFor, type SourceLink } from "./source-link";
import { extractWatchOffer, findTmdbAnimeId, type WatchOffer } from "./watch-providers";
import { ProviderError } from "@/lib/api/http";

const log = createLogger("media/detail-data");

/** 24 h (D-01). */
export const MEDIA_DETAIL_REVALIDATE_SECONDS = 60 * 60 * 24;
/** Etiqueta para invalidar todas las fichas a la vez (`/api/revalidate`). */
export const MEDIA_DETAIL_CACHE_TAG = "media-detail";
/** Se sube al cambiar la forma de `MediaDetailData` (deja atrás lo guardado). */
const CACHE_VERSION = "media-detail-v1";

export interface MediaDetailData {
  /** Tal cual lo normaliza el proveedor (géneros originales: afinidad, listas). */
  item: MediaItem;
  /** Géneros en el idioma de la página (F-06), para pintar. */
  genreLabels: string[];
  trailerKey?: string;
  /** Suscripción, alquiler y compra del país del idioma (puede ir vacío). */
  providers: StreamingProvider[];
  /** Página "dónde ver" de TMDB (`tmdbWatchLink`). */
  watchLink?: string;
  steam: SteamInfo | null;
  /** Página del título en su proveedor (cita de la fuente). */
  source: SourceLink | null;
  /** Contenido adulto según `nsfw-filter`: la ficha no se indexa. */
  nsfw: boolean;
}

class MediaUnavailable extends Error {
  constructor(id: string) {
    super(`ficha no disponible: ${id}`);
  }
}

// ── Resolución por proveedor (por la FORMA del id: conviven fuentes legacy) ────

/**
 * Libro (E-BOOKS-HIBRIDO): `OL…W` → Open Library completado con Google Books
 * (portada y sinopsis vía ISBN); otro id → volumen de Google Books guardado
 * cuando el catálogo lo servía Google (pedírselo a Open Library daría 404).
 */
async function resolveBook(id: string): Promise<MediaItem | null> {
  if (isOpenLibraryWorkId(id)) {
    const detail = await getBookDetail(id).catch(() => null);
    if (!detail) return null;
    const item = normalizeBookOpenLibrary(detail.doc);
    const description = cleanOpenLibraryDescription(detail.description);
    if (description) item.synopsis = description;
    return enrichBookWithGoogle(item).catch(() => item);
  }
  const volume = await getGoogleBookDetail(id).catch(() => null);
  return volume ? normalizeBookGoogle(volume) : null;
}

/** Manga: MangaDex (uuid), AniList (`al-`, lo que MangaDex no tiene) o Jikan legacy. */
async function resolveManga(id: string, locale: string): Promise<MediaItem | null> {
  if (isMangaDexId(id)) {
    const detail = await getMangaDex(id).catch(() => null);
    return detail ? normalizeMangaDex(detail.data, locale) : null;
  }
  if (isAniListId(id)) {
    const ani = await getMangaAniList(fromAniListRef(id)).catch(() => null);
    return ani ? normalizeAniListManga(ani) : null;
  }
  const legacy = await getMangaJikan(Number(id)).catch(() => null);
  return legacy ? normalizeMangaJikan(legacy.data) : null;
}

/** Anime: TMDB (`tmdb-`, respaldo), AniList (`al-`) o Jikan legacy, con tráiler. */
async function resolveAnime(
  id: string,
  locale: string
): Promise<{ item: MediaItem; trailerKey?: string } | null> {
  if (isTmdbAnimeId(id)) return getAnimeTmdb(id, locale);
  if (isAniListId(id)) {
    const raw = await getAnimeAniList(fromAniListRef(id)).catch(() => null);
    if (!raw) return null;
    const item = normalizeAniListAnime(raw);
    return { item, trailerKey: item.trailerKey };
  }
  const numId = Number(id);
  const [detail, videos] = await Promise.allSettled([getAnimeJikan(numId), getAnimeVideos(numId)]);
  if (detail.status === "rejected") return null;
  const item = normalizeAnime(detail.value.data);
  const trailerKey =
    videos.status === "fulfilled"
      ? (videos.value.data.promo?.[0]?.trailer?.youtube_id ?? undefined)
      : undefined;
  return { item, trailerKey };
}

/** "Dónde ver" del anime vía la serie de TMDB que sea la misma obra (PRO-6). */
async function animeOffer(item: MediaItem, region: string, locale: string): Promise<WatchOffer> {
  try {
    const tmdbId = await findTmdbAnimeId(item, locale);
    if (tmdbId === null) return { providers: [] };
    return extractWatchOffer(await getTVProviders(tmdbId, region, locale), region);
  } catch {
    return { providers: [] };
  }
}

type Resolved = Omit<MediaDetailData, "genreLabels" | "nsfw" | "source"> & { rawgSlug?: string };

async function resolve(type: MediaType, id: string, locale: string): Promise<Resolved | null> {
  const region = tmdbRegion(locale);
  const empty = { providers: [] as StreamingProvider[], steam: null };

  switch (type) {
    case "movie": {
      // Una sola llamada: la ficha de TMDB ya trae tráiler y "dónde ver"
      // (`append_to_response`); antes eran tres.
      const detail = await getMovie(Number(id), locale);
      const offer = extractWatchOffer(detail["watch/providers"], region);
      const item = normalizeMovie(detail);
      return { ...empty, item, trailerKey: item.trailerKey, providers: offer.providers, watchLink: offer.link };
    }
    case "tv": {
      const detail = await getTV(Number(id), locale);
      const offer = extractWatchOffer(detail["watch/providers"], region);
      const item = normalizeTV(detail);
      return { ...empty, item, trailerKey: item.trailerKey, providers: offer.providers, watchLink: offer.link };
    }
    case "anime": {
      const resolved = await resolveAnime(id, locale);
      if (!resolved) return null;
      const offer = await animeOffer(resolved.item, region, locale);
      return { ...empty, ...resolved, providers: offer.providers, watchLink: offer.link };
    }
    case "manga": {
      const item = await resolveManga(id, locale);
      return item ? { ...empty, item } : null;
    }
    case "book": {
      const item = await resolveBook(id);
      return item ? { ...empty, item } : null;
    }
    case "game": {
      const detail = await getGame(Number(id));
      // Nunca lanza: `getSteamInfoForGame` captura todo y devuelve null.
      const steam = await getSteamInfoForGame(detail, locale);
      const slug = (detail as { slug?: unknown }).slug;
      return {
        ...empty,
        item: normalizeGame(detail),
        steam,
        rawgSlug: typeof slug === "string" ? slug : undefined,
      };
    }
    case "comic":
      return { ...empty, item: normalizeComic(await getComic(id)) };
    default:
      return null;
  }
}

/** Sin caché: resuelve y completa. Lanza si el título no se puede servir. */
export async function loadMediaDetailUncached(
  type: string,
  id: string,
  locale: string
): Promise<MediaDetailData> {
  const parsed = parseMediaId(`${type}_${id}`);
  if (!parsed) throw new MediaUnavailable(`${type}_${id}`);

  const resolved = await resolve(parsed.type, parsed.externalId, locale);
  const item = resolved?.item;
  if (!resolved || !item || typeof item.title !== "string" || !item.title.trim()) {
    throw new MediaUnavailable(parsed.id);
  }
  const { rawgSlug, ...data } = resolved;
  return {
    ...data,
    genreLabels: localizeGenreLabels(item.genres, locale),
    source: sourceLinkFor(parsed.type, parsed.externalId, { rawgSlug }),
    nsfw: isNSFW(item),
  };
}

const cachedLoad = unstable_cache(loadMediaDetailUncached, [CACHE_VERSION], {
  revalidate: MEDIA_DETAIL_REVALIDATE_SECONDS,
  tags: [MEDIA_DETAIL_CACHE_TAG],
});

function isMissingIncrementalCache(e: unknown): boolean {
  return e instanceof Error && e.message.includes("incrementalCache missing");
}

/**
 * Ficha lista para pintar o `null` (id con forma imposible, título que el
 * proveedor no da o proveedor caído). Nunca lanza. La usan la página y sus
 * metadatos: dentro de una petición la segunda llamada sale de la caché.
 */
export async function loadMediaDetail(
  type: string,
  id: string,
  locale: string
): Promise<MediaDetailData | null> {
  // Antes de la caché: un id imposible no ocupa una entrada ni llama a nadie.
  if (!parseMediaId(`${type}_${id}`)) return null;
  try {
    return await cachedLoad(type, id, resolveApiLocale(locale));
  } catch (e) {
    if (isMissingIncrementalCache(e)) {
      // Fuera de Next (tests, scripts) no hay caché incremental.
      return loadMediaDetailUncached(type, id, resolveApiLocale(locale)).catch(() => null);
    }
    // Los fallos del proveedor ya los registra `providerFetch`.
    if (!(e instanceof MediaUnavailable) && !(e instanceof ProviderError)) {
      log.warn("no se pudo cargar la ficha", { type, id, err: e });
    }
    return null;
  }
}
