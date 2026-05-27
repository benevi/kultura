"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { MediaItem } from "@/types/media";
import { MediaGrid } from "@/components/media/MediaGrid";
import { Pagination } from "@/components/ui/Pagination";
import { FilterBar, type FilterGroup } from "@/components/ui/FilterBar";

export interface DiscoverClientProps {
  items: MediaItem[];
  currentType: string;
  currentPage: number;
  totalPages: number;
}

function matchesYear(item: MediaItem, yearFilter: string): boolean {
  if (yearFilter === "all") return true;
  if (!item.year) return false;
  const y = item.year;
  if (yearFilter === "2010s") return y >= 2010 && y <= 2019;
  if (yearFilter === "2000s") return y >= 2000 && y <= 2009;
  if (yearFilter === "classic") return y < 2000;
  return y === parseInt(yearFilter, 10);
}

export function DiscoverClient({
  items,
  currentType,
  currentPage,
  totalPages,
}: DiscoverClientProps) {
  const t = useTranslations("discover");
  const tF = useTranslations("filters");
  const router = useRouter();

  const [yearFilter, setYearFilter] = useState("all");

  const filterGroups: FilterGroup[] = [
    {
      key: "type",
      label: tF("type"),
      options: [
        { value: "movie", label: tF("movie") },
        { value: "tv", label: tF("tv") },
        { value: "anime", label: tF("anime") },
        { value: "book", label: tF("book") },
        { value: "manga", label: tF("manga") },
        { value: "game", label: tF("game") },
      ],
    },
    {
      key: "year",
      label: tF("year"),
      options: [
        { value: "2025", label: "2025" },
        { value: "2024", label: "2024" },
        { value: "2023", label: "2023" },
        { value: "2010s", label: "2010s" },
        { value: "2000s", label: "2000s" },
        { value: "classic", label: tF("classic") },
      ],
    },
  ];

  const activeFilters: Record<string, string> = {
    type: currentType,
    year: yearFilter,
  };

  function handleFilterChange(key: string, value: string) {
    if (key === "type") {
      const newType = value === "all" ? "movie" : value;
      setYearFilter("all");
      router.push(`/discover?type=${newType}&page=1`);
    } else if (key === "year") {
      setYearFilter(value);
    }
  }

  function resetFilters() {
    setYearFilter("all");
  }

  const filteredItems = useMemo(
    () => items.filter((item) => matchesYear(item, yearFilter)),
    [items, yearFilter]
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-0 py-4">
        <h1 className="font-display text-4xl tracking-wide">{t("title")}</h1>
      </div>

      {/* FilterBar — sticky below app header (h-14) */}
      <div className="sticky top-14 z-30 bg-bg/95 backdrop-blur-sm border-b border-border py-3 px-4 -mx-4 mb-6">
        <FilterBar
          groups={filterGroups}
          activeFilters={activeFilters}
          onChange={handleFilterChange}
        />
      </div>

      {/* Grid */}
      {filteredItems.length > 0 ? (
        <MediaGrid items={filteredItems} showType={false} />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          <div className="col-span-full text-center py-12">
            <p className="text-muted">{t("noResults")}</p>
            <button
              onClick={resetFilters}
              className="text-accent-info text-sm mt-2 hover:text-accent-info/80 transition-colors"
            >
              {tF("reset")}
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) =>
              router.push(`/discover?type=${currentType}&page=${page}`)
            }
          />
        </div>
      )}
    </div>
  );
}
