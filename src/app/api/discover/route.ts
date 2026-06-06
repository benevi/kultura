// ============================================================
// KULTURA — Discover Route Handler (E59 · F2)
// Mueve el fetch de Descubrir a un endpoint que el navegador llama, lo que
// permite mockear las APIs externas en E2E (page.route('**/api/discover*')).
//
// F2 = paridad de comportamiento: solo se USAN type + page. El resto de params
// canónicos (docs/E59_FILTER_SPEC.md §1) se parsean pero se ignoran, dejando el
// parser listo para F3+. El filtro `year` sigue aplicándose en el cliente.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchDiscoverData } from "@/lib/api/discover";

/** Tipos válidos de catálogo. `type` fuera de esta lista cae a "movie". */
const VALID_TYPES = [
  "movie",
  "tv",
  "anime",
  "manga",
  "book",
  "game",
  "comic",
] as const;

type MediaType = (typeof VALID_TYPES)[number];

/**
 * Params canónicos parseados (contrato E59 §1). En F2 solo `type`/`page` se
 * propagan a la capa de fetch; el resto se reconoce y se reserva para F3+.
 */
export interface DiscoverParams {
  type: MediaType;
  page: number;
  // Reservados (parseados, aún no aplicados server-side en F2):
  genre: string[];
  year: string | null;
  platform: string[];
  sort: string | null;
  status: string | null;
  demografia: string | null;
  duracion: string | null;
  temporadas: string | null;
  volumenes: string | null;
  horas: string | null;
  editorial: string[];
  formato: string | null;
  idioma: string | null;
}

function parseMulti(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Parsea los query params al contrato canónico. Exportado para testear. */
export function parseDiscoverParams(
  searchParams: URLSearchParams
): DiscoverParams {
  const rawType = searchParams.get("type") ?? "movie";
  const type = (VALID_TYPES as readonly string[]).includes(rawType)
    ? (rawType as MediaType)
    : "movie";

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  return {
    type,
    page,
    genre: parseMulti(searchParams.get("genre")),
    year: searchParams.get("year"),
    platform: parseMulti(searchParams.get("platform")),
    sort: searchParams.get("sort"),
    status: searchParams.get("status"),
    demografia: searchParams.get("demografia"),
    duracion: searchParams.get("duracion"),
    temporadas: searchParams.get("temporadas"),
    volumenes: searchParams.get("volumenes"),
    horas: searchParams.get("horas"),
    editorial: parseMulti(searchParams.get("editorial")),
    formato: searchParams.get("formato"),
    idioma: searchParams.get("idioma"),
  };
}

export async function GET(request: NextRequest) {
  const parsed = parseDiscoverParams(request.nextUrl.searchParams);
  const { type, page } = parsed;

  // F3a+F3b: se pasan los filtros que cada familia consume nativamente
  // (TMDB: genre/year/platform/sort/status/duracion/idioma; Jikan: +demografia;
  // RAWG: genre/platform/year/sort). Cada builder ignora los vacíos/desconocidos
  // y los campos que no entiende. fetchDiscoverData nunca lanza → 200.
  const result = await fetchDiscoverData(type, page, {
    genre: parsed.genre,
    year: parsed.year,
    platform: parsed.platform,
    sort: parsed.sort,
    status: parsed.status,
    demografia: parsed.demografia,
    duracion: parsed.duracion,
    idioma: parsed.idioma,
  });

  return NextResponse.json(result);
}
