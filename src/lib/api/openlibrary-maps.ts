// ============================================================
// KULTURA — Traducción de filtros a la query de Open Library (E-BOOKS-HIBRIDO)
//
// Traduce el contrato canónico de filtros de Descubrir a lo que entiende
// `/search.json`:
//   género  → subject:"<término>"                (fragmento de q)
//   año     → first_publish_year:[a TO b]        (fragmento de q, RANGO real)
//   idioma  → params.language (ISO-639-2/B)      (facet, no una pista)
//   formato → params.has_fulltext                (solo "libre")
//   sort    → params.sort
//
// La diferencia de fondo con las tablas de Google Books (`books-maps.ts`) es
// que aquí todo son filtros de verdad, aplicados por el proveedor. Allí el
// idioma era una pista para el índice y el año no existía siquiera, así que
// ambos había que aplicarlos a mano sobre lo ya recibido — de donde salían las
// páginas medio vacías y los títulos en un idioma que no era el pedido.
// ============================================================

import { resolveApiLocale } from "@/lib/api/locale";

// ── Géneros (slug canónico Kultura → término subject: de Open Library) ───────
// Los subjects de Open Library son texto en inglés en minúscula, no códigos
// BISAC: "science fiction", no "Science Fiction". Se mantiene el MISMO juego de
// slugs que el resto de familias para que el filtro de género signifique lo
// mismo en todas las pestañas.

export const OPEN_LIBRARY_GENRE: Record<string, string> = {
  accion: "adventure",
  aventura: "adventure",
  comedia: "humor",
  crimen: "crime",
  drama: "drama",
  fantasia: "fantasy",
  historia: "history",
  terror: "horror",
  misterio: "mystery",
  romance: "romance",
  "ciencia-ficcion": "science fiction",
  suspense: "thriller",
  poesia: "poetry",
  biografia: "biography",
  infantil: "juvenile fiction",
  ensayo: "essays",
};

/**
 * Semilla cuando no hay ningún filtro: Open Library también exige `q`. Se elige
 * el mismo subject amplio que usaba la rama de Google Books para que el
 * catálogo "sin filtros" siga siendo reconocible.
 */
export const OPEN_LIBRARY_BASE_QUERY = 'subject:"fiction"';

/** Locale de la app → código de idioma de Open Library (ISO-639-2/B). */
export function openLibraryLanguage(locale?: string | null): "spa" | "eng" {
  return resolveApiLocale(locale) === "en" ? "eng" : "spa";
}

// ── Año → rango real ─────────────────────────────────────────────────────────
// El trigger de año sirve tres formas: un año suelto ("2026"), una década
// ("2000s") y "classic". Con Google Books solo se atendía la primera y las
// otras dos se ignoraban en silencio; aquí las tres son un rango.
// `classic` = 1900-1999, el mismo tramo que usan anime, cómic, juegos y cine.

export function openLibraryYearRange(
  year: string | null | undefined
): { from: number; to: number } | undefined {
  if (!year) return undefined;
  const raw = year.trim();

  if (raw === "classic") return { from: 1900, to: 1999 };

  const decade = /^(\d{4})s$/.exec(raw);
  if (decade) {
    const from = parseInt(decade[1], 10);
    return { from, to: from + 9 };
  }

  const exact = /^(\d{4})$/.exec(raw);
  if (exact) {
    const y = parseInt(exact[1], 10);
    return { from: y, to: y };
  }

  return undefined;
}

// ── Sort → params.sort ───────────────────────────────────────────────────────
// Open Library admite `new`, `old`, `rating` y `editions`. Los sorts sin
// equivalente nativo devuelven undefined en vez de inventar un orden que la API
// no garantiza — misma política que el resto de proveedores.

export function openLibrarySort(
  sort: string | null | undefined
): string | undefined {
  switch (sort) {
    case "recientes":
    case "newest":
    case "release_desc":
    case "recent":
      return "new";
    case "antiguos":
    case "oldest":
    case "release_asc":
      return "old";
    case "valoracion":
    case "rating":
      return "rating";
    default:
      // relevancia / popularidad / título / vacío / desconocido → sin sort.
      return undefined;
  }
}

/**
 * Formato → `has_fulltext`.
 *
 * Open Library no distingue "ebook de pago" de "libro físico": lo único que
 * sabe con certeza es si hay texto completo accesible. Así que solo "libre"
 * produce filtro; el resto no acota, que es preferible a fingir una precisión
 * que el proveedor no tiene.
 */
export function openLibraryFulltext(
  formato: string | null | undefined
): string | undefined {
  return formato === "free" ? "true" : undefined;
}

// ── Filtros de entrada ───────────────────────────────────────────────────────

export interface OpenLibraryBookFilters {
  genre?: string[];
  sort?: string | null;
  formato?: string | null;
  idioma?: string | null;
  year?: string | null;
}

export interface OpenLibraryQuery {
  q: string;
  params: Record<string, string>;
}

/** Override explícito del trigger de idioma, si trae un ISO-639-2/B de 3 letras. */
function languageOverride(idioma: string | null | undefined): string | undefined {
  if (!idioma) return undefined;
  const code = idioma.trim().toLowerCase();
  if (/^[a-z]{3}$/.test(code)) return code;
  // Un ISO-639-1 de 2 letras (como lo mandaba la etapa Google Books) se traduce
  // a los dos idiomas que la app soporta; cualquier otro se ignora.
  if (code === "es") return "spa";
  if (code === "en") return "eng";
  return undefined;
}

/**
 * Construye la consulta del catálogo.
 *
 * El idioma SIEMPRE viaja: es lo que garantiza que el título que se lee sea el
 * de la edición en el idioma de la app, y a diferencia de `langRestrict` de
 * Google Books, Open Library lo respeta.
 */
export function buildOpenLibraryQuery(
  filters: OpenLibraryBookFilters = {},
  locale?: string | null
): OpenLibraryQuery {
  const fragments: string[] = [];

  const subjects = (filters.genre ?? [])
    .map((slug) => OPEN_LIBRARY_GENRE[slug])
    .filter((v): v is string => Boolean(v));
  for (const subject of subjects) fragments.push(`subject:"${subject}"`);

  const range = openLibraryYearRange(filters.year);
  if (range) {
    fragments.push(`first_publish_year:[${range.from} TO ${range.to}]`);
  }

  const q = fragments.length > 0 ? fragments.join(" ") : OPEN_LIBRARY_BASE_QUERY;

  const params: Record<string, string> = {
    language: languageOverride(filters.idioma) ?? openLibraryLanguage(locale),
  };
  const sort = openLibrarySort(filters.sort);
  if (sort) params.sort = sort;
  const fulltext = openLibraryFulltext(filters.formato);
  if (fulltext) params.has_fulltext = fulltext;

  return { q, params };
}
