"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/index";

export interface SearchFiltersState {
  minRating: number;
  decade: string;
  genres: string[];
  sortBy: string;
}

export const DEFAULT_SEARCH_FILTERS: SearchFiltersState = {
  minRating: 0,
  decade: "",
  genres: [],
  sortBy: "relevance",
};

interface SearchFiltersProps {
  filters: SearchFiltersState;
  availableGenres: string[];
  onFiltersChange: (filters: SearchFiltersState) => void;
  onRandomize: () => void;
  resultCount: number;
  isOpen: boolean;
  onToggle: () => void;
}

const DECADES = [
  { value: "classic", key: "decadeClassic" },
  { value: "80s", key: "decade80s" },
  { value: "90s", key: "decade90s" },
  { value: "00s", key: "decade00s" },
  { value: "10s", key: "decade10s" },
  { value: "20s", key: "decade20s" },
] as const;

const SORT_OPTIONS = [
  { value: "relevance", key: "sortRelevance" },
  { value: "az", key: "sortAZ" },
  { value: "za", key: "sortZA" },
  { value: "rating-desc", key: "sortRatingDesc" },
  { value: "rating-asc", key: "sortRatingAsc" },
  { value: "year-desc", key: "sortYearDesc" },
  { value: "year-asc", key: "sortYearAsc" },
] as const;

type SearchTranslationKey =
  | "filters"
  | "sortBy"
  | "sortRelevance"
  | "sortAZ"
  | "sortZA"
  | "sortRatingDesc"
  | "sortRatingAsc"
  | "sortYearDesc"
  | "sortYearAsc"
  | "minRating"
  | "decade"
  | "decadeClassic"
  | "decade80s"
  | "decade90s"
  | "decade00s"
  | "decade10s"
  | "decade20s"
  | "genres"
  | "clearFilters"
  | "randomize"
  | "all";

export function SearchFilters({
  filters,
  availableGenres,
  onFiltersChange,
  onRandomize,
  resultCount,
  isOpen,
  onToggle,
}: SearchFiltersProps) {
  const t = useTranslations("search");

  const activeCount = [
    filters.minRating > 0,
    filters.decade !== "",
    filters.genres.length > 0,
    filters.sortBy !== "relevance",
  ].filter(Boolean).length;

  function update(partial: Partial<SearchFiltersState>) {
    onFiltersChange({ ...filters, ...partial });
  }

  function toggleGenre(genre: string) {
    const next = filters.genres.includes(genre)
      ? filters.genres.filter((g) => g !== genre)
      : [...filters.genres, genre];
    update({ genres: next });
  }

  function clearAll() {
    onFiltersChange(DEFAULT_SEARCH_FILTERS);
  }

  return (
    <div className="mb-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
            isOpen || activeCount > 0
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-muted hover:text-text hover:border-text/30"
          )}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
            />
          </svg>
          {t("filters" as SearchTranslationKey)}
          {activeCount > 0 && (
            <span className="bg-accent text-white text-xs px-1.5 py-0.5 rounded-full leading-none">
              {activeCount}
            </span>
          )}
        </button>

        {/* Sort dropdown */}
        <select
          value={filters.sortBy}
          onChange={(e) => update({ sortBy: e.target.value })}
          className="px-3 py-1.5 rounded-lg border border-border bg-surface text-sm text-text focus:outline-none focus:border-accent cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.key as SearchTranslationKey)}
            </option>
          ))}
        </select>

        {resultCount > 0 && (
          <button
            onClick={onRandomize}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-text/30 text-sm transition-colors ml-auto"
          >
            🎲 {t("randomize" as SearchTranslationKey)}
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {isOpen && (
        <div className="mt-3 border border-border rounded-xl p-4 bg-surface space-y-5">
          {/* Rating slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-text">
                {t("minRating" as SearchTranslationKey)}
              </span>
              <span className="text-sm text-accent font-mono">
                {filters.minRating > 0
                  ? `${filters.minRating}/10`
                  : t("all" as SearchTranslationKey)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={filters.minRating}
              onChange={(e) =>
                update({ minRating: parseFloat(e.target.value) })
              }
              className="w-full accent-[#E82020] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* Decade */}
          <div>
            <span className="text-sm font-medium text-text block mb-2">
              {t("decade" as SearchTranslationKey)}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DECADES.map((d) => (
                <button
                  key={d.value}
                  onClick={() =>
                    update({
                      decade: filters.decade === d.value ? "" : d.value,
                    })
                  }
                  className={cn(
                    "px-3 py-1 text-xs rounded-full border transition-colors",
                    filters.decade === d.value
                      ? "border-accent bg-accent text-white"
                      : "border-border text-muted hover:text-text hover:border-text/30"
                  )}
                >
                  {t(d.key as SearchTranslationKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Genres */}
          {availableGenres.length > 0 && (
            <div>
              <span className="text-sm font-medium text-text block mb-2">
                {t("genres" as SearchTranslationKey)}
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {availableGenres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className={cn(
                      "px-3 py-1 text-xs rounded-full border transition-colors",
                      filters.genres.includes(genre)
                        ? "border-accent bg-accent text-white"
                        : "border-border text-muted hover:text-text hover:border-text/30"
                    )}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear */}
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="text-sm text-muted hover:text-accent transition-colors underline-offset-2 hover:underline"
            >
              {t("clearFilters" as SearchTranslationKey)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
