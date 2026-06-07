// ============================================================
// KULTURA — Discover Route Handler (E59 · F2)
// Mueve el fetch de Descubrir a un endpoint que el navegador llama, lo que
// permite mockear las APIs externas en E2E (page.route('**/api/discover*')).
//
// El parser y sus tipos viven en @/lib/api/discover-params (Next.js solo permite
// exports concretos en un route handler).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchDiscoverData } from "@/lib/api/discover";
import { parseDiscoverParams } from "@/lib/api/discover-params";

export async function GET(request: NextRequest) {
  const parsed = parseDiscoverParams(request.nextUrl.searchParams);
  const { type, page } = parsed;

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
  // parseDiscoverParams. Pendiente R4c-2: tv/book/comic (temporadas…).
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
    volumenes: parsed.volumenes,
    editorial: parsed.editorial,
    formato: parsed.formato,
    modojuego: parsed.modojuego,
    duracionmedia: parsed.duracionmedia,
    estado: parsed.estado,
  });

  return NextResponse.json(result);
}
