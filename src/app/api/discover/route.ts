// ============================================================
// KULTURA — Discover Route Handler (E59 · F2)
// Mueve el fetch de Descubrir a un endpoint que el navegador llama, lo que
// permite mockear las APIs externas en E2E (page.route('**/api/discover*')).
//
// El parser y sus tipos viven en @/lib/api/discover-params (Next.js solo permite
// exports concretos en un route handler).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { fetchDiscoverData } from "@/lib/api/discover";
import { parseDiscoverParams } from "@/lib/api/discover-params";
import { createClient } from "@/lib/supabase/server";
import { computeMatchScores } from "@/lib/recommendations/match-score";

export async function GET(request: NextRequest) {
  const parsed = parseDiscoverParams(request.nextUrl.searchParams);
  const { type, page } = parsed;

  // E-TMDB-LOCALE: locale ACTIVO de la petición (mismo patrón que
  // /api/ai-recommendations). Se propaga a los proveedores que localizan
  // catálogo (TMDB, Google Books, MangaDex) para que títulos y sinopsis salgan
  // en el idioma elegido en la app, no siempre en español.
  const locale = await getLocale();

  // E-DISCOVER-SEARCH-MERGE: `q` convierte la petición en una BÚSQUEDA (el
  // buscador de /search vive ahora dentro de /discover). La respuesta mantiene
  // la misma forma, así que el grid y la paginación del cliente no cambian.

  // F3a+F3b: se pasan los filtros que cada familia consume nativamente
  // (TMDB: genre/year/platform/sort/status/duracion/idioma; Jikan: +demografia;
  // RAWG: genre/platform/year/sort). Cada builder ignora los vacíos/desconocidos
  // y los campos que no entiende. fetchDiscoverData nunca lanza → 200.
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
  const result = await fetchDiscoverData(type, page, {
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
  }, locale, parsed.q);

  // F3b: badge de match real (F3a) sobre los items devueltos. Sin sesión, o sin
  // señal suficiente en la biblioteca (gate de computeMatchScores), matchScores
  // queda vacío — MediaCard no muestra badge, nunca uno decorativo.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const matchScores = user ? await computeMatchScores(user.id, result.items, supabase) : new Map<string, number>();

  return NextResponse.json({ ...result, matchScores: Object.fromEntries(matchScores) });
}
