"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { MediaItem } from "@/types/media";
import type { DiscoverResult } from "@/lib/api/discover";
import { MediaGrid } from "@/components/media/MediaGrid";
import { Pagination } from "@/components/ui/Pagination";
import { FilterBar, type FilterGroup } from "@/components/ui/FilterBar";

export interface DiscoverClientProps {
  currentType: string;
  currentPage: number;
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
  currentType,
  currentPage,
}: DiscoverClientProps) {
  const t = useTranslations("discover");
  const tF = useTranslations("filters");
  const router = useRouter();

  const [yearFilter, setYearFilter] = useState("all");

  // E59 F2: el fetch vive en el navegador (vía /api/discover) para que los E2E
  // puedan mockearlo con page.route. Se re-pide al cambiar type o page.
  const [items, setItems] = useState<MediaItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [fetchErrorKind, setFetchErrorKind] =
    useState<DiscoverResult["fetchErrorKind"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      type: currentType,
      page: String(currentPage),
    });
    fetch(`/api/discover?${params.toString()}`)
      .then((res) => res.json() as Promise<DiscoverResult>)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
        setFetchErrorKind(data.fetchErrorKind ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setTotalPages(1);
        setFetchErrorKind("generic");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentType, currentPage]);

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
        { value: "comic", label: tF("comic") },
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

  function handleFilterChange(key: string, raw: string | string[]) {
    // Solo grupos single (string) en esta pantalla.
    const value = Array.isArray(raw) ? (raw[0] ?? "all") : raw;
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

      {/* Fetch error banner */}
      {fetchErrorKind !== null && (
        <div className="mb-6 rounded-xl border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
          {fetchErrorKind === "rate-limit"
            ? t("fetchError.rateLimit")
            : t("fetchError.generic")}
        </div>
      )}

      {/* FilterBar — sticky below app header (h-14) */}
      <div className="sticky top-14 z-30 bg-bg/95 backdrop-blur-sm border-b border-border py-3 px-4 -mx-4 mb-6">
        <FilterBar
          groups={filterGroups}
          activeFilters={activeFilters}
          onChange={handleFilterChange}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="animate-pulse grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-[2/3] bg-surface-elevated rounded-card" />
              <div className="h-3 w-3/4 bg-surface-elevated rounded-button" />
              <div className="h-3 w-1/2 bg-surface-elevated rounded-button" />
            </div>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
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
      {!loading && totalPages > 1 && (
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
