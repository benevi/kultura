// ============================================================
// KULTURA — Open Library API Integration (E-BOOKS-HIBRIDO)
// CATÁLOGO de libros (Descubrir) via Open Library Search API.
// Docs: https://openlibrary.org/developers/api — no requiere API key.
//
// Reparto de papeles (decisión de producto, 2026-09-14): cada proveedor donde
// es bueno.
//   - Open Library → CATÁLOGO. Es el único de los dos con filtros de verdad:
//     `language` como facet, `first_publish_year:[a TO b]` como rango, `sort`
//     nativo y un `numFound` fiable del que sí se puede derivar la paginación.
//     Y sin clave ni cuota, que es lo que dejaba el catálogo caído en Vercel.
//   - Google Books → FICHA. Mejores portadas y sinopsis; se consulta solo al
//     abrir un título, no al listar (ver `enrichBookWithGoogle`).
//
// Historia: los libros vivieron aquí (E84c), se migraron a Google Books
// (E-BOOKS-GOOGLE, 2026-09-12) porque su cobertura de sinopsis en español es
// marginal, y vuelven al catálogo ahora que existe la capa de traducción
// (`media_translations`) — ese motivo ya no obliga a renunciar a los filtros.
// ============================================================

// ── Internal types ────────────────────────────────────────────────────────────

export interface OpenLibraryDoc {
  key: string; // "/works/OL7353617W"
  isbn?: string[];
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number; // cover: https://covers.openlibrary.org/b/id/{cover_i}-L.jpg
  language?: string[];
  publisher?: string[];
  subject?: string[];
  ebook_access?: string;
}

export interface OpenLibraryResponse {
  docs: OpenLibraryDoc[];
  /**
   * Total REAL de resultados, no una estimación. Es la diferencia práctica con
   * `totalItems` de Google Books, que anunciaba cientos de páginas que luego el
   * proveedor rechazaba.
   */
  numFound: number;
}

export interface OpenLibraryWork {
  key: string;
  title: string;
  description?: string | { value: string };
}

// `isbn` viaja para poder puentear a Google Books en la ficha sin adivinar por
// título+autor, que es ambiguo entre ediciones.
const SEARCH_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,language,publisher,subject,ebook_access,isbn";

// ── Helper ────────────────────────────────────────────────────────────────────

export function openLibraryCover(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

async function openLibraryFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`https://openlibrary.org${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "KULTURA/1.0 (kultura app)" },
  });
  if (!res.ok) throw new Error(`Open Library ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Resultados por página (= page-size del resto de familias de Descubrir). */
export const OPEN_LIBRARY_PAGE_SIZE = 20;

/**
 * Busca en el catálogo. `params` admite los filtros nativos de Open Library
 * (`language`, `sort`, `has_fulltext`…), que a diferencia de Google Books son
 * filtros de verdad y no pistas para el índice.
 */
export async function searchOpenLibrary(
  q: string,
  page = 1,
  params: Record<string, string> = {}
): Promise<OpenLibraryResponse> {
  return openLibraryFetch<OpenLibraryResponse>("/search.json", {
    q,
    page: String(Math.max(1, page)),
    limit: String(OPEN_LIBRARY_PAGE_SIZE),
    fields: SEARCH_FIELDS,
    ...params,
  });
}

/** `numFound` → páginas navegables. El total es real, así que el cálculo sirve. */
export function openLibraryTotalPages(numFound: number | undefined): number {
  if (!numFound || numFound <= 0) return 1;
  return Math.max(Math.ceil(numFound / OPEN_LIBRARY_PAGE_SIZE), 1);
}

/** Normaliza la description de un work: OL la devuelve como string o { value }. */
function workDescription(
  desc: string | { value: string } | undefined
): string | undefined {
  if (!desc) return undefined;
  return typeof desc === "string" ? desc : desc.value;
}

export interface OpenLibraryBookDetail {
  doc: OpenLibraryDoc;
  description?: string;
}

/**
 * Detalle de libro (E84c). id = workKey ("OL7353617W" o "/works/OL7353617W").
 * 1) search-by-key (q=key:/works/{id}) → OpenLibraryDoc completo (cover, autor,
 *    año, subjects) coherente con la grid → normalizeBookOpenLibrary.
 * 2) /works/{key}.json best-effort SOLO para description (no la trae el search);
 *    si falla o no existe → sin sinopsis, sin romper.
 * 0 docs → null (el caller hace notFound).
 */
export async function getBookDetail(
  id: string
): Promise<OpenLibraryBookDetail | null> {
  const workKey = id.startsWith("/works/") ? id : `/works/${id}`;
  const res = await searchOpenLibrary(`key:${workKey}`);
  const doc = res.docs?.[0];
  if (!doc) return null;

  let description: string | undefined;
  try {
    const work = await openLibraryFetch<OpenLibraryWork>(`${workKey}.json`);
    description = workDescription(work.description);
  } catch {
    // best-effort: sin description si /works falla
  }

  return { doc, description };
}
