"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/index";
import { MediaGrid } from "@/components/media/MediaGrid";
import { SearchFilters } from "./SearchFilters";
import type { SearchFiltersState } from "./SearchFilters";
import type { SearchResults } from "@/lib/api/search";
import type { MediaItem, MediaType } from "@/types/media";

interface TabDef {
  value: string;
  label: string;
  count: number;
}

export interface SearchResultsProps {
  results: SearchResults;
  activeType: string;
  query: string;
  onTypeChange: (type: string) => void;
  filters: SearchFiltersState;
  onFiltersChange: (filters: SearchFiltersState) => void;
}

function applyFiltersAndSort(
  items: MediaItem[],
  filters: SearchFiltersState
): MediaItem[] {
  let filtered = items;

  if (filters.minRating > 0) {
    filtered = filtered.filter(
      (item) => item.rating !== undefined && item.rating >= filters.minRating
    );
  }

  if (filters.decade) {
    filtered = filtered.filter((item) => {
      if (!item.year) return false;
      switch (filters.decade) {
        case "classic":
          return item.year < 1980;
        case "80s":
          return item.year >= 1980 && item.year < 1990;
        case "90s":
          return item.year >= 1990 && item.year < 2000;
        case "00s":
          return item.year >= 2000 && item.year < 2010;
        case "10s":
          return item.year >= 2010 && item.year < 2020;
        case "20s":
          return item.year >= 2020;
        default:
          return true;
      }
    });
  }

  if (filters.genres.length > 0) {
    filtered = filtered.filter((item) =>
      item.genres?.some((g) => filters.genres.includes(g))
    );
  }

  const sorted = [...filtered];
  switch (filters.sortBy) {
    case "az":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "za":
      sorted.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case "rating-desc":
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case "rating-asc":
      sorted.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
      break;
    case "year-desc":
      sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      break;
    case "year-asc":
      sorted.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      break;
  }

  return sorted;
}

export function SearchResults({
  results,
  activeType,
  query,
  onTypeChange,
  filters,
  onFiltersChange,
}: SearchResultsProps) {
  const t = useTranslations("search");
  const tMedia = useTranslations("media");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [randomItem, setRandomItem] = useState<MediaItem | null>(null);

  const typeMap: { key: MediaType; plural: string; items: MediaItem[] }[] = [
    { key: "movie", plural: "movies", items: results.movies },
    { key: "tv", plural: "tvs", items: results.tv },
    { key: "anime", plural: "animes", items: results.anime },
    { key: "manga", plural: "mangas", items: results.manga },
    { key: "book", plural: "books", items: results.books },
    { key: "game", plural: "games", items: results.games },
  ];

  const totalCount =
    results.movies.length +
    results.tv.length +
    results.anime.length +
    results.manga.length +
    results.books.length +
    results.games.length;

  const availableTabs: TabDef[] = [
    { value: "all", label: t("all"), count: totalCount },
    ...typeMap
      .filter((m) => m.items.length > 0)
      .map((m) => ({
        value: m.key,
        label: tMedia(m.plural as Parameters<typeof tMedia>[0]),
        count: m.items.length,
      })),
  ];

  // Items for active type tab (before advanced filters)
  const typeFilteredItems: MediaItem[] =
    activeType === "all"
      ? [
          ...results.movies,
          ...results.tv,
          ...results.anime,
          ...results.manga,
          ...results.books,
          ...results.games,
        ]
      : (typeMap.find((m) => m.key === activeType)?.items ?? []);

  // Available genres from type-filtered items
  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    typeFilteredItems.forEach((item) =>
      item.genres?.forEach((g) => genres.add(g))
    );
    return Array.from(genres).sort();
  }, [typeFilteredItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply advanced filters + sort
  const filteredItems = useMemo(
    () => applyFiltersAndSort(typeFilteredItems, filters),
    [typeFilteredItems, filters] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleRandomize() {
    if (filteredItems.length === 0) return;
    const idx = Math.floor(Math.random() * filteredItems.length);
    setRandomItem(filteredItems[idx]);
  }

  function clearRandom() {
    setRandomItem(null);
  }

  const displayItems = randomItem ? [randomItem] : filteredItems;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {availableTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              onTypeChange(tab.value);
              setRandomItem(null);
            }}
            className={cn(
              "px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
              activeType === tab.value
                ? "border-accent text-text"
                : "border-transparent text-muted hover:text-text"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="text-xs text-muted ml-1">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <SearchFilters
        filters={filters}
        availableGenres={availableGenres}
        onFiltersChange={(f) => {
          onFiltersChange(f);
          setRandomItem(null);
        }}
        onRandomize={handleRandomize}
        resultCount={filteredItems.length}
        isOpen={filtersOpen}
        onToggle={() => setFiltersOpen((o) => !o)}
      />

      {/* Random mode banner */}
      {randomItem && (
        <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30 text-sm">
          <span className="text-accent">
            🎲{" "}
            {t("showingRandom", {
              count: filteredItems.length,
            } as Parameters<typeof t>[1])}
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleRandomize}
              className="text-accent hover:underline"
            >
              {t("randomizeAgain" as Parameters<typeof t>[0])}
            </button>
            <button onClick={clearRandom} className="text-muted hover:text-text">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {displayItems.length > 0 ? (
        <MediaGrid items={displayItems} showType={activeType === "all"} />
      ) : (
        <p className="text-muted text-center py-16">
          {t("noResults")} &ldquo;{query}&rdquo;
        </p>
      )}
    </div>
  );
}
