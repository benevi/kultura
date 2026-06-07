// ============================================================
// KULTURA — Google Books filter translation tables (E59 F3c)
// Traduce el contrato canónico (docs/E59_FILTER_SPEC.md) a la query de /volumes:
// género → subject: (BISAC inglés, unidos en q), sort → orderBy (relevance|newest),
// formato → filter (ebooks/free-ebooks/paid-ebooks), idioma → langRestrict.
//
// year → OCULTO para book (spec §4): no se acepta como filtro aquí.
// physical → sin filtro nativo en Google Books (filter solo expresa ebooks) →
// se IGNORA (degradado). Guard: vacío / desconocido descartado.
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

// Término base usado cuando NO hay género (paridad con discover.ts actual).
export const BOOKS_BASE_QUERY = "popular";

// ── Editorial (book) ─────────────────────────────────────────────────────────────
// Catálogo de editoriales de LIBRO (spec E59_FILTER_SPEC_V2 §editorial, subconjunto
// de libro). Editoriales españolas de libro general — NO las de cómic (Marvel/DC/
// Image viven en COMIC_PUBLISHER). value = slug canónico → substring de publisher.
// POST-filtro (Google Books no tiene filtro nativo de editorial).

export const BOOKS_PUBLISHER: Record<string, string> = {
  planeta: "Planeta",
  norma: "Norma",
  ivrea: "Ivrea",
  panini: "Panini",
  salamandra: "Salamandra",
  sm: "SM",
};

// ── Sort → orderBy ──────────────────────────────────────────────────────────────
// Google Books solo expone relevance | newest. release_desc/recientes → newest;
// el resto (incluido popularity, rating, A–Z…) → relevance (no hay nativo).

export function booksOrderBy(sort: string | null | undefined): string {
  if (sort === "recientes" || sort === "newest" || sort === "release_desc") {
    return "newest";
  }
  return "relevance";
}

// ── Formato → filter ────────────────────────────────────────────────────────────
// free → free-ebooks, ebook → ebooks. physical no tiene filtro nativo → undefined.

// Buckets canónicos de formato (book) → reflejan los slugs del switch de
// booksFilter. Solo value; el filter nativo lo resuelve booksFilter.
export const BOOKS_FORMATO: Record<string, true> = {
  free: true, // free-ebooks
  ebook: true, // ebooks
  physical: true, // sin filter nativo
};

export function booksFilter(
  formato: string | null | undefined
): string | undefined {
  switch (formato) {
    case "free":
      return "free-ebooks";
    case "ebook":
      return "ebooks";
    default:
      return undefined; // physical / vacío / desconocido → sin filter
  }
}

// ── Idioma → langRestrict (ISO-639-1) ───────────────────────────────────────────
// El contrato canónico ya entrega ISO-639-1 (spec §1). Aceptamos códigos de 2
// letras tal cual; cualquier otra cosa se descarta (caller mantiene default "es").

function booksLangRestrict(
  idioma: string | null | undefined
): string | undefined {
  if (!idioma) return undefined;
  return /^[a-z]{2}$/i.test(idioma) ? idioma.toLowerCase() : undefined;
}

// ── Filtros de entrada (subconjunto canónico relevante a Google Books) ───────────
// year EXCLUIDO: oculto para book (spec §4).

export interface BooksFilters {
  genre?: string[];
  sort?: string | null;
  formato?: string | null;
  idioma?: string | null;
}

function mapGenreSubjects(slugs: string[] | undefined): string[] {
  if (!slugs?.length) return [];
  return slugs
    .map((s) => BOOKS_GENRE[s])
    .filter((v): v is string => Boolean(v));
}

/**
 * True si los filtros implican construir una query con filtros (vs. la query
 * base de paridad). orderBy=relevance es el default de Books, así que un sort que
 * no produce "newest" no cuenta por sí solo; sí cuenta género, formato, idioma o
 * un sort que cambia orderBy.
 */
export function hasBookFilters(filters: BooksFilters = {}): boolean {
  return Boolean(
    filters.genre?.length ||
      filters.formato ||
      filters.idioma ||
      (filters.sort && booksOrderBy(filters.sort) !== "relevance")
  );
}

export interface BooksQueryParams {
  orderBy?: string;
  filter?: string;
  langRestrict?: string;
}

export interface BooksQuery {
  q: string;
  params: BooksQueryParams;
}

/**
 * Construye la query de /volumes. q = subjects unidos si hay género, si no el
 * término base. params lleva orderBy (siempre), y filter/langRestrict solo si
 * aplican. Vacío/desconocido se omite.
 */
export function buildBooksQuery(filters: BooksFilters = {}): BooksQuery {
  const subjects = mapGenreSubjects(filters.genre);
  const q =
    subjects.length > 0
      ? subjects.map((s) => `subject:"${s}"`).join(" ")
      : BOOKS_BASE_QUERY;

  const params: BooksQueryParams = {
    orderBy: booksOrderBy(filters.sort),
  };

  const filter = booksFilter(filters.formato);
  if (filter) params.filter = filter;

  const lang = booksLangRestrict(filters.idioma);
  if (lang) params.langRestrict = lang;

  return { q, params };
}
