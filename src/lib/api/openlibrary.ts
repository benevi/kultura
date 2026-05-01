// ============================================================
// KULTURA — Open Library API Integration
// Libros (fallback) via Open Library
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
  subject?: string[];
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
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open Library ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchBooks(
  query: string,
  page = 1
): Promise<OpenLibraryResponse> {
  return openLibraryFetch<OpenLibraryResponse>("/search.json", {
    q: query,
    page: String(page),
    limit: "20",
  });
}

export async function getBook(key: string): Promise<OpenLibraryWork> {
  // key can be "/works/OL7353617W" or just "OL7353617W"
  const normalizedKey = key.startsWith("/") ? key : `/works/${key}`;
  return openLibraryFetch<OpenLibraryWork>(`${normalizedKey}.json`);
}
