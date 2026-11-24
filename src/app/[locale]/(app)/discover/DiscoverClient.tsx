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
import { isDiscoverType } from "@/lib/discover/discover-config";
import { useFilterGroups } from "@/hooks/useFilterGroups";
import { DiscoverToolbar } from "./DiscoverToolbar";
import { DiscoverResults } from "./DiscoverResults";
import { SalaDiscoverViewLazy } from "@/components/discover/sala/SalaDiscoverViewLazy";
import type { SalaDiscoverViewProps } from "@/components/discover/sala/SalaDiscoverView";

export interface DiscoverClientProps {
  currentType: string;
  currentPage: number;
  /**
   * E-DISCOVER-SEARCH-MERGE: query de texto activa (param `q`). Con query, la
   * página la sirve el BUSCADOR del proveedor con la misma forma de respuesta.
   */
  currentQuery?: string;
  /** Fase 8.2 (bandera QUICK_ADD, la lee el servidor): «+» en las tarjetas. */
  quickAdd?: boolean;
  /**
   * Fase 8.5 D1 (bandera SALA_DESCUBRIR, la lee el servidor): Descubrir en
   * «Sala» (buscador, tipos, rejilla y paginación). `null`: la de hoy.
   */
  sala?: Pick<SalaDiscoverViewProps, "toastLabels"> | null;
}

export function DiscoverClient({ currentType, currentPage, currentQuery = "", quickAdd = false, sala = null }: DiscoverClientProps) {
  const t = useTranslations("discover");
  const locale = useLocale();
  const type: DiscoverType = isDiscoverType(currentType) ? currentType : "movie";
  // D2: con «Sala», filtros y páginas cambian la URL sin ir al servidor; la
  // página sale entonces de la URL, no de la que pintó el servidor.
  const url = useDiscoverUrl(type, currentQuery, { shallow: sala !== null });
  const page = sala ? url.page : currentPage;
  const filterGroups = useFilterGroups(type);

  // "Sorpréndeme": un ítem al azar de la página actual; se suelta al llegar
  // otra página (pertenece a la que se estaba viendo).
  const [randomItem, setRandomItem] = useState<MediaItem | null>(null);
  const { items, hasMore, totalPages, fetchErrorKind, loading, retry } = useDiscoverQuery({
    type,
    page,
    filterQuery: url.filterQuery,
    query: currentQuery,
    locale,
    onSettled: () => setRandomItem(null),
  });

  function pickRandom() {
    if (items.length === 0) return;
    setRandomItem(items[Math.floor(Math.random() * items.length)]);
  }

  // Con «Sala» (D1), su vista sustituye a toda la pantalla; el estado sigue aquí.
  if (sala) {
    return (
      <SalaDiscoverViewLazy
        type={type}
        query={currentQuery}
        isSearching={url.isSearching}
        loading={loading}
        items={items}
        fetchErrorKind={fetchErrorKind}
        onRetry={retry}
        randomItem={randomItem}
        onRandom={pickRandom}
        onClearRandom={() => setRandomItem(null)}
        filterGroups={filterGroups}
        activeFilters={url.activeFilters}
        hasActiveFilters={url.hasActiveFilters}
        onFilterChange={url.changeFilter}
        onClearFilters={url.clearFilters}
        onSearch={url.submitSearch}
        onClearSearch={url.resetToCatalog}
        onTypeChange={url.changeType}
        currentPage={page}
        hasMore={hasMore}
        totalPages={totalPages}
        onPageChange={url.goToPage}
        quickAdd={quickAdd}
        toastLabels={sala.toastLabels}
      />
    );
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
        <div className="mb-6 rounded-2xl border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
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
        quickAdd={quickAdd}
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
