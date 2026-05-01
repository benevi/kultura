"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import {
  DEFAULT_SEARCH_FILTERS,
  type SearchFiltersState,
} from "@/components/search/SearchFilters";
import type { SearchResults as SearchResultsType } from "@/lib/api/search";

interface SearchClientProps {
  results: SearchResultsType;
  query: string;
  initialType: string;
}

export function SearchClient({
  results,
  query,
  initialType,
}: SearchClientProps) {
  const router = useRouter();
  const [activeType, setActiveType] = useState(initialType);
  const [filters, setFilters] = useState<SearchFiltersState>(
    DEFAULT_SEARCH_FILTERS
  );

  function handleTypeChange(type: string) {
    setActiveType(type);
    router.push(`/search?q=${encodeURIComponent(query)}&type=${type}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <SearchBar defaultValue={query} className="w-full max-w-2xl" />
      <SearchResults
        results={results}
        activeType={activeType}
        query={query}
        onTypeChange={handleTypeChange}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
}
