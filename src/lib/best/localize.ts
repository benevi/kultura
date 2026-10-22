// ============================================================
// KULTURA — Rankings /best en el idioma de la página (F-06, DAT-2 y DAT-5)
//
// La selección de un ranking (qué títulos y en qué orden) sale de los
// proveedores; aquí se decide cómo se pinta en /es y en /en:
//   - Géneros: etiquetas traducidas (`genre-label-maps.ts`).
//   - Anime en /es: AniList solo habla inglés. Si TMDB tiene la MISMA obra
//     (mismo título japonés exacto, nunca "parecido") se usan su título y su
//     sinopsis en español. Las temporadas sueltas de AniList no casan con la
//     serie de TMDB y se quedan con su título de AniList.
//   - Juegos: RAWG no da sinopsis en los listados. Se toma la descripción
//     corta de Steam en el idioma pedido y, si no hay, la de RAWG.
//   - Lo que siga en otro idioma se traduce con `translateSynopsis` (caché
//     compartida en `media_translations`, con el texto completo para reusar la
//     traducción de la ficha), con un máximo de llamadas al modelo
//     por cálculo: la cola se completa en las horas siguientes sin disparar el
//     gasto ni la latencia de la página.
//
// Nada de esto lanza: un enriquecimiento que falla deja el dato original.
// ============================================================

import { unstable_cache } from "next/cache";
import { searchAnimeTmdb } from "@/lib/api/anime-tmdb";
import { getGame } from "@/lib/api/rawg";
import { getSteamAppDetails, steamAppIdFromRawgGame } from "@/lib/api/steam";
import { localizeGenreLabels } from "@/lib/api/genre-label-maps";
import { resolveApiLocale, type ApiLocale } from "@/lib/api/locale";
import { translateSynopsis } from "@/lib/translate/synopsis";
import { needsTranslation } from "@/lib/translate/language";
import { cleanSynopsis, isCjkOnly } from "@/lib/best/quality";
import { BEST_CACHE_TAG, BEST_CACHE_VERSION } from "@/lib/best/cache-tags";
import type { MediaType } from "@/types/media";

/** Lo que pinta la card de un ranking. */
export interface BestItem {
  id: string;
  type: MediaType;
  title: string;
  poster: string;
  year?: number;
  rating?: number;
  genres: string[];
  synopsis?: string;
}

/** Un título seleccionado, con lo que hace falta para localizarlo. */
export interface BestSource extends BestItem {
  externalId: string;
  originalTitle?: string;
  nativeTitle?: string;
}

export { BEST_CACHE_TAG, BEST_CACHE_VERSION } from "@/lib/best/cache-tags";

/** Llamadas al modelo de traducción por cálculo de un ranking (D-06). */
export const BEST_TRANSLATE_BUDGET = 2;
/** Una traducción que tarda más que esto no retrasa la página: se usa el original. */
const TRANSLATE_TIMEOUT_MS = 4000;
const WEEK_SECONDS = 60 * 60 * 24 * 7;

/** Ejecuta `fn` sobre `items` con como mucho `limit` a la vez (cupos ajenos). */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function matchKey(text: string | undefined | null): string {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-–—:：・!！?？.,、。'"「」『』()（）]+/g, "");
}

export interface AnimeSpanish {
  title?: string;
  synopsis?: string;
}

/**
 * Título y sinopsis en español de un anime de AniList, vía TMDB. Solo se
 * acepta una ficha cuyo título original coincide EXACTO con el nativo de
 * AniList: mejor un título en inglés que el de otra obra. `null` = sin pareja
 * (también se cachea: una semana sin volver a preguntar).
 */
export async function findAnimeSpanish(
  queries: string[],
  nativeTitle: string
): Promise<AnimeSpanish | null> {
  const target = matchKey(nativeTitle);
  if (!target) return null;
  for (const q of queries) {
    const res = await searchAnimeTmdb(q, 1, "es");
    const hit = res.items.find((c) => matchKey(c.originalTitle ?? c.title) === target);
    if (!hit) continue;
    const title = hit.originalTitle && !isCjkOnly(hit.title) ? hit.title : undefined;
    const synopsis =
      hit.synopsis && !needsTranslation(hit.synopsis, "es") ? hit.synopsis : undefined;
    return title || synopsis ? { title, synopsis } : null;
  }
  return null;
}

const cachedAnimeSpanish = unstable_cache(
  (queries: string[], nativeTitle: string) => findAnimeSpanish(queries, nativeTitle),
  [BEST_CACHE_VERSION, "anime-es"],
  { revalidate: WEEK_SECONDS, tags: [BEST_CACHE_TAG] }
);

/**
 * Sinopsis de un juego de RAWG: la descripción corta de Steam en el idioma
 * pedido (Steam la publica traducida en muchos juegos) y, si no, la de RAWG.
 */
export async function findGameSynopsis(
  rawgId: number,
  locale: ApiLocale
): Promise<string | null> {
  const game = await getGame(rawgId);
  const appId = steamAppIdFromRawgGame(game);
  if (appId) {
    try {
      const data = (await getSteamAppDetails(appId, locale)) as
        | { short_description?: string; type?: string }
        | null;
      if (data?.short_description && (!data.type || data.type === "game")) {
        return data.short_description;
      }
    } catch {
      // Steam caído: queda la descripción de RAWG.
    }
  }
  return game.description_raw?.trim() || null;
}

const cachedGameSynopsis = unstable_cache(
  (rawgId: number, locale: ApiLocale) => findGameSynopsis(rawgId, locale),
  [BEST_CACHE_VERSION, "game-synopsis"],
  { revalidate: WEEK_SECONDS, tags: [BEST_CACHE_TAG] }
);

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

/**
 * Sinopsis en el idioma pedido. Primero solo caché (gratis); de lo que quede
 * en otro idioma, como mucho `budget` llamadas al modelo, por orden del
 * ranking. El resto se completa en los próximos cálculos.
 */
async function translateAll(
  items: { id: string; synopsis?: string }[],
  locale: ApiLocale,
  budget: number
): Promise<(string | undefined)[]> {
  const pending = (text: string | undefined) => Boolean(text) && needsTranslation(text!, locale);
  const first = await Promise.all(
    items.map((item) =>
      pending(item.synopsis)
        ? translateSynopsis({ text: item.synopsis, locale, mediaId: item.id, cacheOnly: true })
        : Promise.resolve(item.synopsis)
    )
  );
  let left = budget;
  return Promise.all(
    first.map((text, i) => {
      if (!text || !pending(text) || left <= 0) return Promise.resolve(text || undefined);
      left -= 1;
      return withTimeout(
        translateSynopsis({ text, locale, mediaId: items[i].id }),
        TRANSLATE_TIMEOUT_MS,
        text
      );
    })
  );
}

/** Convierte una selección en lo que pinta la página, en `locale`. */
export async function localizeRanking(
  sources: BestSource[],
  rawLocale: string,
  budget = BEST_TRANSLATE_BUDGET
): Promise<BestItem[]> {
  const locale = resolveApiLocale(rawLocale);

  const enriched = await mapPool(sources, 5, async (src) => {
    let title = src.title;
    let synopsis = src.synopsis;
    try {
      if (src.type === "anime" && locale === "es" && src.nativeTitle) {
        const queries = [src.title, src.originalTitle].filter(
          (q, i, all): q is string => Boolean(q) && all.indexOf(q) === i
        );
        const es = await cachedAnimeSpanish(queries, src.nativeTitle);
        if (es?.title) title = es.title;
        if (es?.synopsis) synopsis = es.synopsis;
      }
      if (src.type === "game" && !synopsis && /^\d+$/.test(src.externalId)) {
        synopsis = (await cachedGameSynopsis(Number(src.externalId), locale)) ?? undefined;
      }
    } catch {
      // Proveedor caído: se pinta lo que había.
    }
    // Texto COMPLETO tal cual lo sirve el proveedor: es el mismo texto y el
    // mismo `mediaId` que traduce la ficha, así comparten la entrada de
    // `media_translations` (mismo hash). Se limpia y recorta después.
    return { id: src.id, title, synopsis: synopsis?.trim() || undefined };
  });

  const synopses = (await translateAll(enriched, locale, budget)).map((s) => cleanSynopsis(s));

  return sources.map((src, i) => {
    const out: BestItem = {
      id: src.id,
      type: src.type,
      title: enriched[i].title,
      poster: src.poster,
      genres: localizeGenreLabels(src.genres, locale).slice(0, 3),
    };
    if (src.year) out.year = src.year;
    if (src.rating) out.rating = src.rating;
    const synopsis = synopses[i]?.trim();
    if (synopsis) out.synopsis = synopsis;
    return out;
  });
}
