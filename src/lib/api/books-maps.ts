// ============================================================
// ⚠️ E-BOOKS-HIBRIDO (2026-09-14): este módulo YA NO dirige el catálogo.
//
// Los filtros de libro los traduce ahora `openlibrary-maps.ts`, porque Open
// Library aplica idioma y año como filtros de verdad y Google Books no. De
// aquí solo siguen VIVOS los catálogos que alimentan las opciones de la UI:
//   - `BOOKS_FORMATO`  → opciones del trigger "formato"
//   - `BOOKS_PUBLISHER`→ opciones del trigger "editorial" (hoy solo en cómic)
//
// El resto (buildGoogleBooksQuery, hasBookFilters, bookYearMatcher,
// preferBooksInLanguage, booksLangRestrictOverride, GOOGLE_BOOKS_BASE_QUERY,
// BOOKS_GENRE) es código muerto: no lo importa nadie. Se conserva un ciclo por
// si hay que revertir el híbrido, y está anotado como deuda en CLAUDE.md.
// ============================================================

// ============================================================
// KULTURA — Google Books filter translation tables (E-BOOKS-GOOGLE)
// Traduce el contrato canónico de filtros a la query de /volumes:
//   género    → subject:"<BISAC>"        (en q, operador nativo)
//   editorial → inpublisher:"<valor>"    (en q, operador nativo, multi = OR)
//   formato   → params.filter            (free-ebooks | ebooks | paid-ebooks)
//   sort      → params.orderBy           (newest | relevance)
//   idioma    → NO va aquí: lo fija `langRestrict` con el locale ACTIVO de la
//               app (ver googlebooks.ts). El trigger `idioma` de la UI queda
//               como override explícito (ver `booksLangRestrictOverride`).
//   año       → POST-filtro (Google Books NO tiene operador de fecha en q)
//
// Historia: estas tablas nacieron para Google Books (E84b), se migraron a Open
// Library (E84c) y vuelven a Google Books en E-BOOKS-GOOGLE por decisión de
// producto. Los catálogos `BOOKS_GENRE` (términos BISAC) y `BOOKS_PUBLISHER`
// se conservan porque son exactamente lo que Google Books espera.
// ============================================================

// ── Géneros (slug canónico Kultura → término subject: BISAC en inglés) ────────
// Google Books no tiene IDs de género; se filtra vía operador subject: en q.
// Los términos BISAC funcionan en cualquier `langRestrict`: son la
// clasificación del volumen, no texto libre del idioma del libro.

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

/**
 * Query base cuando NO hay ningún fragmento de filtro. Google Books EXIGE `q`
 * no vacío (400 si falta), así que el catálogo "sin filtros" necesita una
 * semilla amplia; `subject:fiction` mantiene un set poblado y coherente entre
 * `langRestrict=es` y `=en` (paridad con lo que hacía la rama de Open Library).
 */
export const GOOGLE_BOOKS_BASE_QUERY = "subject:fiction";

// ── Editorial (book) ─────────────────────────────────────────────────────────
// Catálogo de editoriales de LIBRO (spec E59_FILTER_SPEC_V2 §editorial). NO las
// de cómic (Marvel/DC/Image viven en COMIC_PUBLISHER). value = slug canónico →
// término `inpublisher:`. Nativo en Google Books; multi-select = OR en q.

export const BOOKS_PUBLISHER: Record<string, string> = {
  planeta: "Planeta",
  norma: "Norma",
  ivrea: "Ivrea",
  panini: "Panini",
  salamandra: "Salamandra",
  sm: "SM",
};

// ── Sort → params.orderBy ────────────────────────────────────────────────────
// Google Books solo admite `orderBy=relevance|newest`. Los sorts que no tienen
// equivalente nativo (rating, título A–Z) devuelven undefined en vez de
// inventar un orden que la API no garantiza: el agregado `all` ya ordena por su
// cuenta y una familia sola queda en relevancia (comportamiento honesto).

export function googleBooksOrderBy(
  sort: string | null | undefined
): string | undefined {
  switch (sort) {
    case "recientes":
    case "newest":
    case "release_desc":
    case "recent":
      return "newest";
    default:
      // relevance / popularity / rating / title / vacío / desconocido
      return undefined;
  }
}

// ── Formato → params.filter ──────────────────────────────────────────────────
// free    → free-ebooks   (gratis y completo)
// ebook   → ebooks        (cualquier ebook, gratis o de pago)
// physical→ sin filtro    (Google Books no acota a solo-físico)

export const BOOKS_FORMATO: Record<string, true> = {
  free: true,
  ebook: true,
  physical: true,
};

function bookFormatFilter(
  formato: string | null | undefined
): string | undefined {
  switch (formato) {
    case "free":
      return "free-ebooks";
    case "ebook":
      return "ebooks";
    default:
      return undefined; // physical / vacío / desconocido → sin filtro
  }
}

// ── Idioma (override del trigger) ────────────────────────────────────────────
// El idioma de catálogo lo fija el LOCALE activo (`langRestrict` en
// googlebooks.ts). El trigger `idioma` de la UI de Descubrir es un override
// explícito del usuario ("quiero ver libros en japonés aunque la app esté en
// español"): si trae un ISO-639-1 de 2 letras, pisa el derivado del locale.

export function booksLangRestrictOverride(
  idioma: string | null | undefined
): string | undefined {
  if (!idioma) return undefined;
  const code = idioma.trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : undefined;
}

// ── Idioma real del volumen → POST-filtro (E-BOOKS-LANG) ────────────────────
// `langRestrict` es una PISTA de búsqueda, no una garantía: Google la aplica
// sobre el índice, así que en la práctica se cuelan ediciones en inglés (u otro
// idioma) y el usuario ve el título en un idioma que no es el suyo.
//
// El volumen sí trae su idioma real en `volumeInfo.language`, que el
// normalizador guarda en `metadata.language`. Con eso se puede quedar en la
// edición correcta.
//
// Por qué NO se traduce el título: el título de un libro no es texto, es el
// nombre de una edición. "Persuasion" pasa a "Persuasión" solo porque existe
// una edición española que se llama así; traducirlo a máquina inventaría
// nombres que no se pueden buscar ni comprar. O hay edición en el idioma
// activo, y entonces se enseña esa, o se enseña la que hay.
//
// Degradación: si en una página quedan muy pocas ediciones del idioma pedido,
// se conservan las demás detrás en vez de servir una rejilla casi vacía —
// preferir el idioma no debe vaciar el catálogo.

/** Mínimo de resultados en el idioma pedido para poder descartar el resto. */
const BOOKS_LANG_MIN_KEEP = 8;

function volumeLanguage(item: { metadata?: Record<string, unknown> }): string {
  const raw = item.metadata?.language;
  return typeof raw === "string" ? raw.toLowerCase().split(/[-_]/)[0] : "";
}

/**
 * Deja delante las ediciones en `lang` y descarta las demás cuando hay
 * suficientes; si no las hay, las mantiene detrás como relleno.
 */
export function preferBooksInLanguage<T extends { metadata?: Record<string, unknown> }>(
  items: T[],
  lang: string
): T[] {
  const wanted = lang.toLowerCase().split(/[-_]/)[0];
  if (!wanted) return items;

  const matching: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    (volumeLanguage(item) === wanted ? matching : rest).push(item);
  }

  if (matching.length === 0) return items;
  return matching.length >= BOOKS_LANG_MIN_KEEP
    ? matching
    : [...matching, ...rest];
}

// ── Año → POST-filtro ────────────────────────────────────────────────────────
// Google Books NO ofrece filtro de fecha de publicación en la query (ni en
// params), a diferencia de Open Library (`first_publish_year:[Y TO Y]`). El año
// se aplica DESPUÉS de normalizar, sobre `MediaItem.year`, siguiendo el patrón
// de post-filtro ya establecido en el proyecto (temporadas×tv, volumenes×manga)
// — y por eso `hasActivePostFilter('book', …)` devuelve true con año activo, de
// modo que `totalPages` viaja como `null` (el conteo crudo ya no es fiable).

/** Año canónico → predicado sobre el año del item. Solo formato YYYY. */
export function bookYearMatcher(
  year: string | null | undefined
): ((itemYear: number | undefined) => boolean) | undefined {
  if (!year) return undefined;
  const m = /^(\d{4})$/.exec(year.trim());
  if (!m) return undefined;
  const target = parseInt(m[1], 10);
  return (itemYear) => itemYear === target;
}

// ── Filtros de entrada (subconjunto canónico relevante a Google Books) ───────

export interface BooksFilters {
  genre?: string[];
  sort?: string | null;
  formato?: string | null;
  idioma?: string | null;
  year?: string | null;
  editorial?: string[];
}

function mapGenreSubjects(slugs: string[] | undefined): string[] {
  if (!slugs?.length) return [];
  return slugs
    .map((s) => BOOKS_GENRE[s])
    .filter((v): v is string => Boolean(v));
}

/** Traduce slugs de editorial(book) a los términos `inpublisher:` a usar en q. */
function mapPublisherTerms(slugs: string[] | undefined): string[] {
  if (!slugs?.length) return [];
  return slugs
    .map((s) => BOOKS_PUBLISHER[s])
    .filter((v): v is string => Boolean(v));
}

/**
 * True si los filtros implican construir una query con filtros (vs. la query
 * base de paridad). El año NO cuenta: es post-filtro y necesita el catálogo
 * base, no una query distinta. Un sort sin equivalente nativo tampoco cuenta
 * por sí solo.
 */
export function hasBookFilters(filters: BooksFilters = {}): boolean {
  return Boolean(
    filters.genre?.length ||
      filters.editorial?.length ||
      // `physical` no produce filtro (Google Books no acota a solo-físico) →
      // se mira el filtro RESULTANTE, no el valor crudo, igual que con el sort.
      bookFormatFilter(filters.formato) ||
      booksLangRestrictOverride(filters.idioma) ||
      googleBooksOrderBy(filters.sort)
  );
}

export interface GoogleBooksQuery {
  q: string;
  params: Record<string, string>;
}

/**
 * Construye la query de /volumes. `q` = concatenación de SOLO los fragmentos
 * activos (género `subject:`, editorial `inpublisher:` con OR multi); si no hay
 * ninguno → query base (Google Books exige `q`). `params` lleva `orderBy`,
 * `filter` y el override de `langRestrict` solo cuando aplican.
 *
 * Los términos van entre comillas: `subject:"Science Fiction"` — sin ellas,
 * Google Books parte por el espacio y el segundo token pasa a ser texto libre.
 */
export function buildGoogleBooksQuery(
  filters: BooksFilters = {}
): GoogleBooksQuery {
  const fragments: string[] = [];

  const subjects = mapGenreSubjects(filters.genre);
  for (const s of subjects) fragments.push(`subject:"${s}"`);

  const publishers = mapPublisherTerms(filters.editorial);
  if (publishers.length > 0) {
    const clause = publishers.map((p) => `inpublisher:"${p}"`).join(" OR ");
    fragments.push(publishers.length > 1 ? `(${clause})` : clause);
  }

  const q =
    fragments.length > 0 ? fragments.join(" ") : GOOGLE_BOOKS_BASE_QUERY;

  const params: Record<string, string> = {};
  const orderBy = googleBooksOrderBy(filters.sort);
  if (orderBy) params.orderBy = orderBy;
  const filter = bookFormatFilter(filters.formato);
  if (filter) params.filter = filter;
  const langOverride = booksLangRestrictOverride(filters.idioma);
  if (langOverride) params.langRestrict = langOverride;

  return { q, params };
}
