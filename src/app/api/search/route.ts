// ============================================================
// KULTURA — Search autocomplete Route Handler
// Solo consulta TMDB (velocidad). Devuelve hasta 5 sugerencias.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { searchMovies, searchTV } from "@/lib/api/tmdb";
import type { TmdbMovieDetail, TmdbTVDetail } from "@/lib/api/tmdb";
import { normalizeMovie, normalizeTV } from "@/lib/api/normalizer";
import { resolveApiLocale } from "@/lib/api/locale";
import { CATALOG_EDGE_CACHE, NO_STORE, clientIp } from "@/lib/api/discover-params";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json([]);

  // Rate limiting — 60 req/min por IP
  const rl = checkRateLimit(`${clientIp(request.headers)}:search`, LIMITS.search);
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
  const locale = resolveApiLocale(request.nextUrl.searchParams.get("locale"));

  try {
    const [movies, tv] = await Promise.allSettled([
      searchMovies(q, 1, locale).then((r) =>
        r.results
          .slice(0, 3)
          .map((raw) => normalizeMovie(raw as TmdbMovieDetail))
      ),
      searchTV(q, 1, locale).then((r) =>
        r.results
          .slice(0, 2)
          .map((raw) => normalizeTV(raw as TmdbTVDetail))
      ),
    ]);

    const results = [
      ...(movies.status === "fulfilled" ? movies.value : []),
      ...(tv.status === "fulfilled" ? tv.value : []),
    ].slice(0, 5);

    // DAT-11: solo se cachea en el borde la respuesta completa; una con un
    // proveedor caído quedaría coja una hora para todos.
    const complete = movies.status === "fulfilled" && tv.status === "fulfilled";
    return NextResponse.json(results, {
      headers: { "Cache-Control": complete ? CATALOG_EDGE_CACHE : NO_STORE },
    });
  } catch {
    return NextResponse.json([], { headers: { "Cache-Control": NO_STORE } });
  }
}
