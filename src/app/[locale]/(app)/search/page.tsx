// ============================================================
// KULTURA — Search page
// Server Component: busca en todas las APIs y pasa resultados
// al Client Component para manejar tabs y navegación.
// ============================================================

import type { Metadata } from "next";
import { searchAll } from "@/lib/api/search";
import type { SearchResults } from "@/lib/api/search";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchClient } from "./SearchClient";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; type?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  const { q } = await searchParams;
  const title = q
    ? `${locale === "es" ? "Buscar" : "Search"}: ${q}`
    : locale === "es"
      ? "Buscar"
      : "Search";
  return { title };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, type = "all" } = await searchParams;

  // No query → show only the centered search bar
  if (!q || q.trim().length < 2) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-24">
        <SearchBar className="w-full" />
      </main>
    );
  }

  // With query → search all APIs
  const emptyResults: SearchResults = {
    movies: [],
    tv: [],
    anime: [],
    manga: [],
    books: [],
    games: [],
  };

  let results: SearchResults = emptyResults;
  try {
    results = await searchAll(q);
  } catch {
    // Silently fall back to empty results
  }

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      <SearchClient results={results} query={q} initialType={type} />
    </main>
  );
}
