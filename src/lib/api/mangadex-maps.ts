// ============================================================
// KULTURA — MangaDex filter translation tables (E-MANGA-SOURCE)
// Traduce el contrato canónico de filtros de manga (mismos slugs que ya
// consumía Jikan — reutilizados para no romper la UI/opciones existentes en
// filter-options.ts) a los params nativos array-style de MangaDex `/manga`
// (ver mangaDexFetch en mangadex.ts).
//
// ⚠️ Tags de género: MangaDex identifica cada género por un UUID fijo, no por
// slug — no hay forma de construir la query solo con el nombre. La tabla de
// abajo se ha construido a partir del catálogo público y estable de
// `GET /manga/tag` (ampliamente documentado, MangaDex no rota estos UUIDs),
// pero este entorno de desarrollo NO tiene acceso de red a api.mangadex.org
// para verificarla en vivo. Si un género da 0 resultados en producción,
// contrastar el UUID contra un `GET /manga/tag` real antes de asumir catálogo
// vacío.
// ============================================================

export interface MangaDexFilters {
  genre?: string[];
  demografia?: string | null;
  year?: string | null;
  status?: string | null;
  sort?: string | null;
  // Post-filtro (no nativo, ver filterByMinVolumesDex): oculto del builder.
  volumenes?: string | null;
}

// slug canónico (mismo set que JIKAN_GENRE, reusado por GENRE_BY_TYPE.manga
// en filter-options.ts) → tag UUID de MangaDex, grupo "genre".
export const MANGADEX_GENRE: Record<string, string> = {
  accion: "391b0423-d847-456f-aff0-8b0cfc03066b", // Action
  aventura: "87cc87cd-a395-47af-b27a-93258283bbc6", // Adventure
  comedia: "4d32cc48-9f00-4cca-9b5a-a839f0764984", // Comedy
  drama: "b9af3a63-f058-46de-a9a0-e0c13906197a", // Drama
  fantasia: "cdc58593-87dd-415e-bbc0-2ec27bf404cc", // Fantasy
  terror: "cdad7e68-1419-41dd-bdce-27753074a640", // Horror
  misterio: "ee968100-4191-4968-93d3-f82d72be7e46", // Mystery
  romance: "423e2eae-a7a2-4a8b-ac03-a8351462d71d", // Romance
  "ciencia-ficcion": "256c8bd9-4904-4360-bf4f-508a76d67183", // Sci-Fi
  "recuentos-de-la-vida": "e5301a23-ebd9-49dd-a0cb-2add944c7fe9", // Slice of Life
  deportes: "69964a64-2f90-4d33-beeb-f3ed2875eb4c", // Sports
  sobrenatural: "eabc5b4c-6aff-42f3-b657-3e90cbd00b75", // Supernatural
  suspense: "07251805-a27e-4d59-b488-f0bfbec15168", // Thriller (MangaDex no distingue "Suspense" de "Thriller")
};

// canónico (JIKAN_DEMOGRAPHIC, reusado) → publicationDemographic[] de MangaDex.
// "kids" no tiene equivalente en MangaDex → omitido (sin filtro, no catálogo vacío).
export const MANGADEX_DEMOGRAPHIC: Record<string, string> = {
  shonen: "shounen",
  shojo: "shoujo",
  seinen: "seinen",
  josei: "josei",
};

// canónico (MANGA_STATUS de jikan-maps, reusado por STATUS_BY_TYPE.manga) →
// status[] de MangaDex. "upcoming" no tiene equivalente → omitido.
export const MANGADEX_STATUS: Record<string, string> = {
  airing: "ongoing",
  publishing: "ongoing",
  complete: "completed",
  hiatus: "hiatus",
  discontinued: "cancelled",
};

interface MangaDexSort {
  field: string;
  order: "asc" | "desc";
}

const MANGADEX_SORT: Record<string, MangaDexSort> = {
  popularity: { field: "followedCount", order: "desc" },
  rating: { field: "rating", order: "desc" },
  release_desc: { field: "year", order: "desc" },
  release_asc: { field: "year", order: "asc" },
  title_az: { field: "title", order: "asc" },
  title_za: { field: "title", order: "desc" },
};

function mangaDexSort(sort: string | null | undefined): MangaDexSort {
  return (sort && MANGADEX_SORT[sort]) || MANGADEX_SORT.popularity;
}

/**
 * Construye los params NATIVOS de `/manga` (array-style: pares repetibles,
 * ver mangaDexFetch). `contentRating[]` acota siempre a safe+suggestive (SFW
 * por defecto — mismo criterio que `sfw=true` en Jikan); `filterNSFW` sigue
 * aplicándose después como defensa en profundidad, igual que en el resto de
 * familias. Vacío/desconocido se omite sin romper la query (nunca lanza).
 */
export function buildMangaDexDiscoverParams(
  filters: MangaDexFilters = {}
): [string, string][] {
  const params: [string, string][] = [
    ["contentRating[]", "safe"],
    ["contentRating[]", "suggestive"],
  ];

  for (const slug of filters.genre ?? []) {
    const tagId = MANGADEX_GENRE[slug];
    if (tagId) params.push(["includedTags[]", tagId]);
  }

  if (filters.demografia) {
    const demo = MANGADEX_DEMOGRAPHIC[filters.demografia];
    if (demo) params.push(["publicationDemographic[]", demo]);
  }

  if (filters.status) {
    const status = MANGADEX_STATUS[filters.status];
    if (status) params.push(["status[]", status]);
  }

  // MangaDex acepta `year` como match exacto (a diferencia del rango de
  // fechas que exige Jikan) — mucho más simple, sin builder de rango.
  if (filters.year && /^\d{4}$/.test(filters.year)) {
    params.push(["year", filters.year]);
  }

  const { field, order } = mangaDexSort(filters.sort);
  params.push([`order[${field}]`, order]);

  return params;
}

/**
 * True si hay algún filtro que implique usar `/manga` con params (en vez del
 * atajo sort-only que ya cubre `getPopularManga`). Un sort distinto del
 * default `popularity` también cuenta.
 */
export function hasMangaDexFilters(filters: MangaDexFilters = {}): boolean {
  return Boolean(
    filters.genre?.length ||
      filters.demografia ||
      filters.status ||
      (filters.year && /^\d{4}$/.test(filters.year)) ||
      (filters.sort && filters.sort !== "popularity")
  );
}

// ── Volúmenes (manga) — POST-filtro de mínimo ───────────────────────────────
// Mismos buckets canónicos que jikan-maps.VOLUMENES_MIN (UI compartida). Se
// reexporta el bucket table para que filter-options.ts no dependa de Jikan.

export { VOLUMENES_MIN, volumenesMin } from "@/lib/api/jikan-maps";

/**
 * Post-filtra items de manga (ya normalizados con `normalizeMangaDex`) por
 * mínimo de volúmenes. Idéntico contrato a `filterByMinVolumes` de
 * jikan-maps.ts, reexportado aquí para no importar el módulo de Jikan desde
 * el pipeline de MangaDex por un simple post-filtro sobre `metadata.volumes`
 * (que `normalizeMangaDex` ya rellena parseando `lastVolume`).
 */
export { filterByMinVolumes as filterByMinVolumesDex } from "@/lib/api/jikan-maps";
