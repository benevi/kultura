"use client";

// ============================================================
// KULTURA — Pantalla Descubrir (catálogo y búsqueda de las 7 familias)
//
// Compone: la URL (`useDiscoverUrl`), la página pedida a /api/discover
// (`useDiscoverQuery`), la barra (`DiscoverToolbar`) y el cuerpo
// (`DiscoverResults`). "all" es el agregado: misma rejilla, con badge de tipo
// por card porque ahí los tipos se mezclan.
// ============================================================

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MediaItem } from "@/types/media";
import { Pagination } from "@/components/ui/Pagination";
import { IconCompass } from "@/components/icons";
import { type DiscoverType } from "@/lib/discover/type-filters";
import { useDiscoverQuery } from "@/hooks/useDiscoverQuery";
import { useDiscoverUrl } from "@/hooks/useDiscoverUrl";
import { isDiscoverType } from "./discover-config";
import { useFilterGroups } from "./useFilterGroups";
import { DiscoverToolbar } from "./DiscoverToolbar";
import { DiscoverResults } from "./DiscoverResults";

export interface DiscoverClientProps {
  currentType: string;
  currentPage: number;
  /**
   * E-DISCOVER-SEARCH-MERGE: query de texto activa (param `q`). Con query, la
   * página la sirve el BUSCADOR del proveedor con la misma forma de respuesta.
   */
  currentQuery?: string;
}

export function DiscoverClient({ currentType, currentPage, currentQuery = "" }: DiscoverClientProps) {
  const t = useTranslations("discover");
  const locale = useLocale();
  const type: DiscoverType = isDiscoverType(currentType) ? currentType : "movie";
  const url = useDiscoverUrl(type, currentQuery);
  const filterGroups = useFilterGroups(type);

  // "Sorpréndeme": un ítem al azar de la página actual; se suelta al llegar
  // otra página (pertenece a la que se estaba viendo).
  const [randomItem, setRandomItem] = useState<MediaItem | null>(null);
  const { items, hasMore, totalPages, fetchErrorKind, loading } = useDiscoverQuery({
    type,
    page: currentPage,
    filterQuery: url.filterQuery,
    query: currentQuery,
    locale,
    onSettled: () => setRandomItem(null),
  });

  function pickRandom() {
    if (items.length === 0) return;
    setRandomItem(items[Math.floor(Math.random() * items.length)]);
  }

  return (
    <div>
      {/* Header — G1: mismo peso tipográfico chunky que MediaDetail (F4). */}
      <div className="mb-4 pt-4 pb-2 flex items-center gap-2.5">
        <IconCompass className="h-8 w-8 sm:h-10 sm:w-10 text-accent-positive shrink-0" aria-hidden="true" />
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-text-primary">
          {t("title")}
        </h1>
      </div>

      {fetchErrorKind !== null && (
        <div className="mb-6 rounded-xl border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
          {fetchErrorKind === "rate-limit" ? t("fetchError.rateLimit") : t("fetchError.generic")}
        </div>
      )}

      <DiscoverToolbar
        type={type}
        query={currentQuery}
        isSearching={url.isSearching}
        canRandomize={items.length > 0}
        filterGroups={filterGroups}
        activeFilters={url.activeFilters}
        onSearch={url.submitSearch}
        onClearSearch={url.resetToCatalog}
        onRandom={pickRandom}
        onTypeChange={url.changeType}
        onFilterChange={url.changeFilter}
      />

      <DiscoverResults
        loading={loading}
        items={items}
        randomItem={randomItem}
        showType={type === "all"}
        query={currentQuery}
        isSearching={url.isSearching}
        hasActiveFilters={url.hasActiveFilters}
        onRandom={pickRandom}
        onClearRandom={() => setRandomItem(null)}
        onClearSearch={url.resetToCatalog}
        onClearFilters={url.resetToCatalog}
      />

      {/* E79-s1: visible si hay siguiente o si no es la página 1 (para poder
          volver desde una última página corta). */}
      {!loading && (hasMore || currentPage > 1) && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <Pagination
            currentPage={currentPage}
            hasMore={hasMore}
            totalPages={totalPages}
            onPageChange={url.goToPage}
          />
        </div>
      )}
    </div>
  );
}
