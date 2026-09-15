// ============================================================
// KULTURA — Discover query-param parser (E59 · F2)
// Extraído de app/api/discover/route.ts: Next.js solo permite exports concretos
// (GET/POST/config) en un route handler, así que el parser y sus tipos viven aquí
// para poder testearlos e importarlos sin violar el contrato de Route.
// ============================================================

/** Tipos válidos de catálogo. `type` fuera de esta lista cae a "movie". */
export const VALID_TYPES = [
  "all",
  "movie",
  "tv",
  "anime",
  "manga",
  "book",
  "game",
  "comic",
] as const;

export type MediaType = (typeof VALID_TYPES)[number];

/**
 * Params canónicos parseados (contrato E59 §1). En F2 solo `type`/`page` se
 * propagan a la capa de fetch; el resto se reconoce y se reserva para F3+.
 */
export interface DiscoverParams {
  type: MediaType;
  page: number;
  /**
   * E-DISCOVER-SEARCH-MERGE: búsqueda de texto DENTRO de Descubrir (el buscador
   * de `/search` se fusionó aquí). Cuando llega, la fuente de la página pasa a
   * ser el buscador del proveedor en vez del catálogo de descubrir.
   * `null` si no hay query o tiene menos de 2 caracteres (el mismo umbral que
   * usa el autocompletado de `/api/search`), para no lanzar búsquedas de 1 letra.
   */
  q: string | null;
  // Reservados (parseados, aún no aplicados server-side en F2):
  genre: string[];
  year: string | null;
  platform: string[];
  sort: string | null;
  status: string | null;
  demografia: string | null;
  duracion: string | null;
  // valoracion: el front emite paramKey `rating`; el route hace el puente
  // rating→valoracion (R4b). Aquí guardamos ya el slug canónico ES.
  valoracion: string | null;
  temporadas: string | null;
  volumenes: string | null;
  horas: string | null;
  editorial: string[];
  formato: string | null;
  idioma: string | null;
  // R4c-1 (game post-filtros). Puentes de naming en parseDiscoverParams:
  // gamemode→modojuego, playtime→duracionmedia, estado→estado (igual).
  modojuego: string[];
  duracionmedia: string | null;
  estado: string | null;
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

  // q: se normaliza aquí (trim + umbral de 2 chars) para que el resto del
  // pipeline no tenga que repetir la comprobación.
  const rawQ = searchParams.get("q")?.trim() ?? "";
  const q = rawQ.length >= 2 ? rawQ : null;

  return {
    type,
    page,
    q,
    genre: parseMulti(searchParams.get("genre")),
    year: searchParams.get("year"),
    platform: parseMulti(searchParams.get("platform")),
    sort: searchParams.get("sort"),
    status: searchParams.get("status"),
    demografia: searchParams.get("demografia"),
    duracion: searchParams.get("duracion"),
    // Puente de naming: la UI emite `rating` (paramKey del trigger valoracion,
    // traducido en DiscoverClient.handleFilterChange vía paramKeyFor); el resto
    // del pipeline usa `valoracion`. Único punto de mapeo (contrato R4b).
    // El alias `?? valoracion` YA NO es necesario para el flujo real (E88 fix: la
    // UI escribe `rating`); se conserva solo como tolerancia a URLs escritas a
    // mano con el nombre "natural" ES. `rating` (el de la UI) tiene prioridad.
    valoracion: searchParams.get("rating") ?? searchParams.get("valoracion"),
    // Puente de naming (R4c-2): el front emite `seasons`; el pipeline usa
    // `temporadas`. Único punto de mapeo.
    temporadas: searchParams.get("seasons"),
    volumenes: searchParams.get("volumenes"),
    horas: searchParams.get("horas"),
    editorial: parseMulti(searchParams.get("editorial")),
    formato: searchParams.get("formato"),
    idioma: searchParams.get("idioma"),
    // Puentes de naming game (R4c-1): el front emite gamemode/playtime; el
    // pipeline usa modojuego/duracionmedia. estado mantiene el mismo nombre.
    modojuego: parseMulti(searchParams.get("gamemode")),
    duracionmedia: searchParams.get("playtime"),
    estado: searchParams.get("estado"),
  };
}
