// ============================================================
// KULTURA — ComicVine filter translation tables (E59 F3c)
// Traduce el contrato canónico (docs/E59_FILTER_SPEC.md) a los params de /issues:
// sort → sort (cover_date:* | name:*), year → filter cover_date:a|b (rango),
// editorial → POST-filtro sobre el publisher resuelto vía /volumes.
//
// genre → OCULTO para comic (spec §4): ComicVine no tiene género en issues.
// ComicVine solo ordena por cover_date / name nativamente (spec §2 nota); los
// sorts sin equivalente (popularity/rating) caen al default cover_date:desc.
// ============================================================

// ── Sort → sort param de ComicVine ──────────────────────────────────────────────
// Acepta tanto el vocab canónico (release_desc/release_asc/title_az/title_za) como
// alias coloquiales (recientes/newest/antiguos/alfabetico). ComicVine no expone
// popularity ni rating → caen al default cover_date:desc.

export function comicSort(sort: string | null | undefined): string {
  switch (sort) {
    case "recientes":
    case "newest":
    case "release_desc":
      return "cover_date:desc";
    case "antiguos":
    case "release_asc":
      return "cover_date:asc";
    case "name":
    case "alfabetico":
    case "title_az":
      return "name:asc";
    case "title_za":
      return "name:desc";
    default:
      return "cover_date:desc";
  }
}

// ── Año → filter cover_date:a|b (rango) ─────────────────────────────────────────
// ComicVine usa rango con pipe: cover_date:YYYY-MM-DD|YYYY-MM-DD (spec §2).
// Soporta año exacto, década ("2020s") y "classic" (<2000), igual que las demás
// familias. Devuelve solo el valor del campo cover_date (sin el prefijo "filter=").

export function comicCoverDateRange(
  year: string | null | undefined
): string | null {
  if (!year) return null;

  const decade = /^(\d{4})s$/.exec(year);
  if (decade) {
    const start = parseInt(decade[1], 10);
    return `cover_date:${start}-01-01|${start + 9}-12-31`;
  }

  if (year === "classic") return "cover_date:1900-01-01|1999-12-31";

  if (/^\d{4}$/.test(year)) return `cover_date:${year}-01-01|${year}-12-31`;

  return null;
}

// ── Editorial (slug canónico → substring del publisher resuelto) ────────────────
// El publisher vive en /volumes, no en el issue (spec §2). El post-filtro mantiene
// el issue si el publisher resuelto incluye (case-insensitive) este substring.

export const COMIC_PUBLISHER: Record<string, string> = {
  marvel: "Marvel",
  dc: "DC",
  image: "Image",
  "dark-horse": "Dark Horse",
  idw: "IDW",
  "boom-studios": "BOOM",
  "dynamite": "Dynamite",
  "valiant": "Valiant",
  "vertigo": "Vertigo",
  "oni-press": "Oni",
  "titan": "Titan",
};

/** Traduce slugs de editorial a los substrings de publisher a comparar. */
export function mapPublisherSubstrings(
  slugs: string[] | undefined
): string[] {
  if (!slugs?.length) return [];
  return slugs
    .map((s) => COMIC_PUBLISHER[s])
    .filter((v): v is string => Boolean(v));
}

// ── Filtros de entrada (subconjunto canónico relevante a ComicVine) ─────────────
// genre EXCLUIDO: oculto para comic (spec §4).

export interface ComicFilters {
  sort?: string | null;
  year?: string | null;
  editorial?: string[];
  // R4c-2: volumenes×comic POST-filtro. Reusa los buckets VOLUMENES_MIN de manga
  // sobre count_of_issues del volumen. NO entra en hasComicFilters (no gatea el
  // fetch); se aplica dentro de getRecentComics tras resolver los volúmenes.
  volumenes?: string | null;
}

/**
 * True si los filtros cambian la query respecto al comportamiento por defecto.
 * sort=cover_date:desc es el default actual, así que un sort que resuelve a ese
 * valor no cuenta por sí solo; sí cuentan year, editorial o un sort distinto.
 */
export function hasComicFilters(filters: ComicFilters = {}): boolean {
  return Boolean(
    filters.year ||
      filters.editorial?.length ||
      (filters.sort && comicSort(filters.sort) !== "cover_date:desc")
  );
}
