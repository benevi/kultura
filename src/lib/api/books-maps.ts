// ============================================================
// KULTURA — Open Library filter translation tables (E84b)
// Traduce el contrato canónico a la query de /search.json:
// género → subject:<BISAC>, editorial → publisher:<valor> (nativo, multi=OR),
// idioma → language:<ISO-639-3>, año → first_publish_year:[Y TO Y],
// formato → ebook_access:..., sort → params.sort (new|rating|title).
//
// Migrado de Google Books (E84b). googlebooks.ts (getBook) sigue para el detalle.
// physical → sin fragmento (Open Library no acota a físico). Guard: vacío /
// desconocido descartado.
// ============================================================

// ── Géneros (slug canónico Kultura → término subject: BISAC en inglés) ──────────
// Google Books no tiene IDs de género; se filtra vía operador subject: en q.
// Multi-género → varios subject: unidos en la query (AND implícito de Books).

export const BOOKS_GENRE: Record<string, string> = {
  accion: "Action & Adventure",
  aventura: "Adventure",
  comedia: "Humor",
  crimen: "True Crime",
  drama: "Drama",
  fantasia: "Fantasy",
  historia: "History",
  terror: "Horror",
  misterio: "Mystery & Detective",
  romance: "Romance",
  "ciencia-ficcion": "Science Fiction",
  suspense: "Thrillers",
  poesia: "Poetry",
  biografia: "Biography & Autobiography",
  infantil: "Juvenile Fiction",
  ensayo: "Essays",
};

// Query base usada cuando NO hay ningún fragmento de q (paridad: resultados
// poblados). Open Library no tiene "popular"; subject:fiction mantiene un set amplio.
export const OPEN_LIBRARY_BASE_QUERY = "subject:fiction";

// ── Editorial (book) ─────────────────────────────────────────────────────────────
// Catálogo de editoriales de LIBRO (spec E59_FILTER_SPEC_V2 §editorial, subconjunto
// de libro). Editoriales españolas de libro general — NO las de cómic (Marvel/DC/
// Image viven en COMIC_PUBLISHER). value = slug canónico → término publisher:.
// NATIVO en Open Library (E84b): publisher:<valor>, multi-select = OR en q.

export const BOOKS_PUBLISHER: Record<string, string> = {
  planeta: "Planeta",
  norma: "Norma",
  ivrea: "Ivrea",
  panini: "Panini",
  salamandra: "Salamandra",
  sm: "SM",
};

// ── Sort → params.sort ──────────────────────────────────────────────────────────
// Open Library /search.json acepta sort=new|rating|title (entre otros).
// recientes/release_desc → new; rating → rating; title/A–Z → title.
// relevance/popularity → sin sort (orden por defecto, relevancia). Vacío → undefined.

export function openLibrarySort(
  sort: string | null | undefined
): string | undefined {
  switch (sort) {
    case "recientes":
    case "newest":
    case "release_desc":
    case "recent":
      return "new";
    case "rating":
      return "rating";
    case "title":
      return "title";
    default:
      return undefined; // relevance / popularity / vacío / desconocido → sin sort
  }
}

// ── Formato → ebook_access ───────────────────────────────────────────────────────
// free → ebook_access:public ; ebook → (ebook_access:public OR ebook_access:borrowable);
// physical → sin fragmento (Open Library no acota a físico).

// Buckets canónicos de formato (book) → slugs del switch de bookFormatFragment.
// Solo value; el fragmento de q lo resuelve bookFormatFragment.
export const BOOKS_FORMATO: Record<string, true> = {
  free: true, // ebook_access:public
  ebook: true, // ebook_access:public OR ebook_access:borrowable
  physical: true, // sin fragmento
};

function bookFormatFragment(
  formato: string | null | undefined
): string | undefined {
  switch (formato) {
    case "free":
      return "ebook_access:public";
    case "ebook":
      return "(ebook_access:public OR ebook_access:borrowable)";
    default:
      return undefined; // physical / vacío / desconocido → sin fragmento
  }
}

// ── Idioma → language:<ISO-639-3> ─────────────────────────────────────────────────
// El contrato canónico entrega ISO-639-1 (2 letras). Open Library usa ISO-639-3
// (3 letras) en el campo language. Mapeo explícito; lo no mapeado se descarta.

const ISO_639_1_TO_3: Record<string, string> = {
  es: "spa",
  en: "eng",
  fr: "fre",
  de: "ger",
  it: "ita",
  pt: "por",
  ja: "jpn",
};

function bookLanguageIso3(
  idioma: string | null | undefined
): string | undefined {
  if (!idioma) return undefined;
  return ISO_639_1_TO_3[idioma.toLowerCase()];
}

// ── Filtros de entrada (subconjunto canónico relevante a Open Library) ────────────

export interface BooksFilters {
  genre?: string[];
  sort?: string | null;
  formato?: string | null;
  idioma?: string | null;
  year?: string | null;
  // E84b: editorial×book ahora NATIVO (publisher: en q). Multi-select = OR.
  editorial?: string[];
}

function mapGenreSubjects(slugs: string[] | undefined): string[] {
  if (!slugs?.length) return [];
  return slugs
    .map((s) => BOOKS_GENRE[s])
    .filter((v): v is string => Boolean(v));
}

/**
 * True si los filtros implican construir una query con filtros (vs. la query
 * base de paridad). E84b: editorial pasa a ser NATIVO → cuenta. Año, idioma
 * mapeable, género, formato (free/ebook) y un sort que produce param también
 * cuentan. relevance/popularity (sort sin param) no cuenta por sí solo.
 */
export function hasBookFilters(filters: BooksFilters = {}): boolean {
  return Boolean(
    filters.genre?.length ||
      filters.editorial?.length ||
      filters.formato ||
      filters.idioma ||
      filters.year ||
      openLibrarySort(filters.sort)
  );
}

export interface OpenLibraryQuery {
  q: string;
  params: Record<string, string>;
}

/** Traduce slugs de editorial(book) a los términos publisher: a usar en q. */
function mapPublisherTerms(slugs: string[] | undefined): string[] {
  if (!slugs?.length) return [];
  return slugs
    .map((s) => BOOKS_PUBLISHER[s])
    .filter((v): v is string => Boolean(v));
}

/** Año canónico → fragmento first_publish_year:[Y TO Y]. Solo 4 dígitos. */
function bookYearFragment(year: string | null | undefined): string | undefined {
  if (!year) return undefined;
  const m = /^(\d{4})/.exec(year);
  return m ? `first_publish_year:[${m[1]} TO ${m[1]}]` : undefined;
}

/**
 * Construye la query de /search.json. q = concatenación con espacios de SOLO los
 * fragmentos activos (género subject:, editorial publisher: con OR multi, idioma
 * language:, año first_publish_year:, formato ebook_access:). Si no hay ninguno →
 * query base. params lleva sort solo si el sort canónico produce uno.
 */
export function buildOpenLibraryQuery(
  filters: BooksFilters = {}
): OpenLibraryQuery {
  const fragments: string[] = [];

  const subjects = mapGenreSubjects(filters.genre);
  for (const s of subjects) fragments.push(`subject:${s}`);

  const publishers = mapPublisherTerms(filters.editorial);
  if (publishers.length > 0) {
    const clause = publishers.map((p) => `publisher:${p}`).join(" OR ");
    fragments.push(publishers.length > 1 ? `(${clause})` : clause);
  }

  const lang = bookLanguageIso3(filters.idioma);
  if (lang) fragments.push(`language:${lang}`);

  const yearFrag = bookYearFragment(filters.year);
  if (yearFrag) fragments.push(yearFrag);

  const formatFrag = bookFormatFragment(filters.formato);
  if (formatFrag) fragments.push(formatFrag);

  const q = fragments.length > 0 ? fragments.join(" ") : OPEN_LIBRARY_BASE_QUERY;

  const params: Record<string, string> = {};
  const sort = openLibrarySort(filters.sort);
  if (sort) params.sort = sort;

  return { q, params };
}
