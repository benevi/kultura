// ============================================================
// KULTURA — Google Books API Integration
// Libros (fuente principal) via Google Books API v1
// Docs: https://developers.google.com/books/docs/v1/using
// ============================================================

// ── Internal types ────────────────────────────────────────────────────────────

export interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    publishedDate?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    averageRating?: number; // 0-5 → normalizar a 0-10
    publisher?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    language?: string;
  };
}

export interface GoogleBooksResponse {
  items?: GoogleBooksVolume[];
  totalItems: number;
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function googleBooksFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`https://www.googleapis.com/books/v1${path}`);
  const key = process.env.GOOGLE_BOOKS_KEY;
  if (key) url.searchParams.set("key", key);
  url.searchParams.set("maxResults", "20");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Google Books ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchBooks(
  query: string,
  startIndex = 0
): Promise<GoogleBooksResponse> {
  return googleBooksFetch<GoogleBooksResponse>("/volumes", {
    q: query,
    startIndex: String(startIndex),
    langRestrict: "es",
  });
}

export async function getBook(id: string): Promise<GoogleBooksVolume> {
  return googleBooksFetch<GoogleBooksVolume>(`/volumes/${id}`);
}
