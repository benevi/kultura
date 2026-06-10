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

export async function getBook(key: string): Promise<OpenLibraryWork> {
  // key can be "/works/OL7353617W" or just "OL7353617W"
  const normalizedKey = key.startsWith("/") ? key : `/works/${key}`;
  return openLibraryFetch<OpenLibraryWork>(`${normalizedKey}.json`);
}
