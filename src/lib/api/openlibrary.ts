// ============================================================
// KULTURA — Open Library API Integration
// Libros (fuente principal) via Open Library Search API
// Docs: https://openlibrary.org/developers/api
// No requiere API key.
// ============================================================

// ── Internal types ────────────────────────────────────────────────────────────

export interface OpenLibraryDoc {
  key: string; // "/works/OL7353617W"
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
  numFound: number;
}

export interface OpenLibraryWork {
  key: string;
  title: string;
  description?: string | { value: string };
}

const SEARCH_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,language,publisher,subject,ebook_access";

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

export async function searchOpenLibrary(
  q: string,
  page = 1,
  params: Record<string, string> = {}
): Promise<OpenLibraryResponse> {
  return openLibraryFetch<OpenLibraryResponse>("/search.json", {
    q,
    page: String(page),
    limit: "20",
    fields: SEARCH_FIELDS,
    ...params,
  });
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
