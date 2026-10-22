// ============================================================
// KULTURA — Discover Route Handler (E59 · F2)
// Mueve el fetch de Descubrir a un endpoint que el navegador llama, lo que
// permite mockear las APIs externas en E2E (page.route('**/api/discover*')).
//
// El parser y sus tipos viven en @/lib/api/discover-params (Next.js solo permite
// exports concretos en un route handler).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchDiscoverData, type DiscoverResult } from "@/lib/api/discover";
import { fetchAggregateResult } from "@/lib/api/aggregate";
import {
  CATALOG_EDGE_CACHE,
  NO_STORE,
  clientIp,
  parseDiscoverParams,
} from "@/lib/api/discover-params";
import { checkRateLimitDistributed, LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // F-06 (COD-6) + F-13 (D-21): 120 peticiones por minuto e IP, compartidas
  // entre instancias si hay Upstash. Lo que sirve la caché de borde ni llega.
  const rl = await checkRateLimitDistributed(
    `${clientIp(request.headers)}:discover`,
    LIMITS.discover
  );
  if (!rl.allowed) {
    // Misma forma que una respuesta normal: el cliente pinta su aviso de
    // "inténtalo en unos segundos" en vez de una rejilla vacía sin explicación.
    const body: DiscoverResult = {
      items: [],
      totalPages: 1,
      hasMore: false,
      fetchErrorKind: "rate-limit",
    };
    return NextResponse.json(body, {
      status: 429,
      headers: {
        "Retry-After": String(rl.retryAfterSeconds),
        "Cache-Control": NO_STORE,
      },
    });
  }

  const parsed = parseDiscoverParams(request.nextUrl.searchParams);
  const { type, page } = parsed;

  // F-06 (DAT-1): el idioma llega en `?locale=` (lo manda DiscoverClient con
  // `useLocale()`). `getLocale()` no sirve aquí: el middleware sale antes de
  // next-intl en /api/*, así que siempre devolvía "es" y la interfaz inglesa
  // recibía títulos y sinopsis en español.
  const { locale } = parsed;

  // E-DISCOVER-SEARCH-MERGE: `q` convierte la petición en una BÚSQUEDA (el
  // buscador de /search vive ahora dentro de /discover). La respuesta mantiene
  // la misma forma, así que el grid y la paginación del cliente no cambian.

  // F3a+F3b: se pasan los filtros que cada familia consume nativamente
  // (TMDB: genre/year/platform/sort/status/duracion/idioma; MangaDex:
  // +demografia; RAWG: genre/platform/year/sort). Cada builder ignora los
  // vacíos/desconocidos y los campos que no entiende. fetchDiscoverData nunca
  // lanza → 200.
  //
  // E59 R4a — además se reenvían los campos que DiscoverFilters ya consume y que
  // antes se perdían: volumenes (manga/comic post-filtro), editorial (book/comic),
  // formato (book).
  // E59 R4b — valoracion NATIVO (movie/tv vote_average.gte, anime/manga min_score).
  // Puente de naming `rating`→`valoracion` hecho en parseDiscoverParams.
  // E59 R4c-1 — suite game post-filtros (valoracion×game/estado/modojuego/
  // duracionmedia). Puentes gamemode→modojuego, playtime→duracionmedia hechos en
  // parseDiscoverParams.
  // E59 R4c-2 — post-filtros sueltos: temporadas×tv (puente seasons→temporadas),
  // editorial×book (degradado), volumenes×comic. Todos post-fetch, ninguno gatea.
  const filters = {
    genre: parsed.genre,
    year: parsed.year,
    platform: parsed.platform,
    sort: parsed.sort,
    status: parsed.status,
    demografia: parsed.demografia,
    duracion: parsed.duracion,
    idioma: parsed.idioma,
    valoracion: parsed.valoracion,
    temporadas: parsed.temporadas,
    volumenes: parsed.volumenes,
    editorial: parsed.editorial,
    formato: parsed.formato,
    modojuego: parsed.modojuego,
    duracionmedia: parsed.duracionmedia,
    estado: parsed.estado,
  };

  // F-13: `type=all` va directo al agregado para saber si la respuesta es
  // PARCIAL (alguna familia falló). Una parcial no se cachea en el borde; una
  // completa, como cualquier otra (antes se cacheaba 5 min a ciegas).
  const result =
    type === "all"
      ? await fetchAggregateResult(page, filters, locale, parsed.q)
      : await fetchDiscoverData(type, page, filters, locale, parsed.q);
  const partial = "partial" in result && result.partial === true;

  // E-MATCH-SIN-BADGE: aquí se calculaba el match de cada item SOLO para pintar
  // el badge del grid. Retirado el badge, calcularlo era una lectura de
  // biblioteca + scoring en cada petición de catálogo para un dato que ya no
  // ve nadie. El match sigue vivo donde decide algo: la elección de las
  // recomendaciones IA (`lib/claude/recommendations.ts`).
  const body: DiscoverResult = {
    items: result.items,
    totalPages: result.totalPages,
    hasMore: result.hasMore,
    fetchErrorKind: result.fetchErrorKind,
  };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": result.fetchErrorKind || partial ? NO_STORE : CATALOG_EDGE_CACHE,
    },
  });
}
