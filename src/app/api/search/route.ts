// ============================================================
// KULTURA — Search autocomplete Route Handler
// Solo consulta TMDB (velocidad). Devuelve hasta 5 sugerencias.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { searchMovies, searchTV } from "@/lib/api/tmdb";
import type { TmdbMovieDetail, TmdbTVDetail } from "@/lib/api/tmdb";
import { normalizeMovie, normalizeTV } from "@/lib/api/normalizer";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json([]);

  // Rate limiting — 60 req/min por IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rl = checkRateLimit(`${ip}:search`, LIMITS.search);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const [movies, tv] = await Promise.allSettled([
      searchMovies(q, 1).then((r) =>
        r.results
          .slice(0, 3)
          .map((raw) => normalizeMovie(raw as TmdbMovieDetail))
      ),
      searchTV(q, 1).then((r) =>
        r.results
          .slice(0, 2)
          .map((raw) => normalizeTV(raw as TmdbTVDetail))
      ),
    ]);

    const results = [
      ...(movies.status === "fulfilled" ? movies.value : []),
      ...(tv.status === "fulfilled" ? tv.value : []),
    ].slice(0, 5);

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
