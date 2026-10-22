// ============================================================
// KULTURA — Search autocomplete Route Handler
//
// Hasta 5 sugerencias para el buscador de Descubrir.
//   - Con `?type=` de una familia (DAT-8): sugiere de ESA familia, con el
//     mismo buscador y la misma relevancia que el grid (`searchByType`). Antes
//     sugería siempre cine y series: en la pestaña Manga, "naruto" proponía la
//     película.
//     Excepciones por CUPO (ROJO-9): cada tecla es una petición, así que
//       · juegos → buscador de la tienda de Steam (sin cupo) y no RAWG
//         (20.000 al mes, lo necesita el catálogo);
//       · cómic → sin sugerencias: ComicVine da 200 búsquedas por hora para
//         toda la app y se reservan para el grid.
//   - Sin tipo o con `type=all`: cine y series de TMDB (lo más rápido), por
//     relevancia entre las dos listas.
// Se descartan las sugerencias sin portada y las de nota menor que 5 (si la
// tienen): una sugerencia es una apuesta, no un listado completo.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { searchMovies, searchTV } from "@/lib/api/tmdb";
import type { TmdbMovieDetail, TmdbTVDetail } from "@/lib/api/tmdb";
import { normalizeMovie, normalizeTV } from "@/lib/api/normalizer";
import { resolveApiLocale } from "@/lib/api/locale";
import { searchByType } from "@/lib/api/search";
import { searchSteamSuggestions } from "@/lib/api/steam";
import { mergeByRelevance, rankSearchResults } from "@/lib/api/search-rank";
import { filterNSFW } from "@/lib/api/nsfw-filter";
import { CATALOG_EDGE_CACHE, NO_STORE, clientIp } from "@/lib/api/discover-params";
import { checkRateLimitDistributed, LIMITS } from "@/lib/rate-limit";
import type { MediaItem, MediaType } from "@/types/media";

const MAX_SUGGESTIONS = 5;
/** Una consulta de autocompletado no necesita más (y no se reenvía un texto enorme). */
const MAX_QUERY_LENGTH = 100;
/** Nota mínima (sobre 10) de una sugerencia que tiene nota. */
const MIN_SUGGESTION_RATING = 5;

const FAMILY_TYPES: readonly MediaType[] = [
  "movie",
  "tv",
  "anime",
  "manga",
  "book",
  "game",
  "comic",
];

function isFamily(type: string | null): type is MediaType {
  return type !== null && (FAMILY_TYPES as readonly string[]).includes(type);
}

/** Lo que se puede sugerir: con portada y, si tiene nota, una nota digna. */
function suggestable(items: MediaItem[]): MediaItem[] {
  return filterNSFW(items).filter(
    (i) => Boolean(i.poster) && (typeof i.rating !== "number" || i.rating >= MIN_SUGGESTION_RATING)
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length < 2) return NextResponse.json([]);

  // 60 req/min por IP, compartidas entre instancias si hay Upstash (D-21).
  const rl = await checkRateLimitDistributed(`${clientIp(request.headers)}:search`, LIMITS.search);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds),
          "Cache-Control": NO_STORE,
        },
      }
    );
  }

  // F-06 (DAT-1): idioma de `?locale=` (lo manda SearchBar con `useLocale()`).
  // `getLocale()` daba siempre "es" en /api/* porque el middleware sale antes
  // de next-intl; en la URL, además, la caché de borde no mezcla idiomas.
  const locale = resolveApiLocale(params.get("locale"));
  const type = params.get("type");

  if (type === "comic") {
    return NextResponse.json([], { headers: { "Cache-Control": CATALOG_EDGE_CACHE } });
  }

  if (type === "game") {
    const items = rankSearchResults(q, await searchSteamSuggestions(q, locale));
    return NextResponse.json(suggestable(items).slice(0, MAX_SUGGESTIONS), {
      headers: { "Cache-Control": items.length > 0 ? CATALOG_EDGE_CACHE : NO_STORE },
    });
  }

  if (isFamily(type)) {
    try {
      const items = suggestable(await searchByType(q, type, locale)).slice(0, MAX_SUGGESTIONS);
      return NextResponse.json(items, { headers: { "Cache-Control": CATALOG_EDGE_CACHE } });
    } catch {
      return NextResponse.json([], { headers: { "Cache-Control": NO_STORE } });
    }
  }

  const [movies, tv] = await Promise.allSettled([
    searchMovies(q, 1, locale).then((r) =>
      rankSearchResults(q, r.results.map((raw) => normalizeMovie(raw as TmdbMovieDetail)))
    ),
    searchTV(q, 1, locale).then((r) =>
      rankSearchResults(q, r.results.map((raw) => normalizeTV(raw as TmdbTVDetail)))
    ),
  ]);

  const lists = [
    movies.status === "fulfilled" ? suggestable(movies.value) : [],
    tv.status === "fulfilled" ? suggestable(tv.value) : [],
  ];
  const results = mergeByRelevance(q, lists).slice(0, MAX_SUGGESTIONS);

  // DAT-11: solo se cachea en el borde la respuesta completa; una con un
  // proveedor caído quedaría coja una hora para todos.
  const complete = movies.status === "fulfilled" && tv.status === "fulfilled";
  return NextResponse.json(results, {
    headers: { "Cache-Control": complete ? CATALOG_EDGE_CACHE : NO_STORE },
  });
}
