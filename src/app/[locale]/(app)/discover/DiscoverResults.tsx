"use client";

// KULTURA — Cuerpo de Descubrir: esqueleto, rejilla (con el aleatorio) o
// estado vacío según haya búsqueda, filtros o nada.

import { useTranslations } from "next-intl";
import type { MediaItem } from "@/types/media";
import { MediaGrid } from "@/components/media/MediaGrid";
import { cn } from "@/lib/utils/index";
import { IconDice, IconClose } from "@/components/icons";
import { DISCOVER_SKELETON_CELLS } from "./discover-config";

export interface DiscoverResultsProps {
  loading: boolean;
  items: MediaItem[];
  /** "Sorpréndeme": si hay uno elegido, la rejilla muestra solo ese. */
  randomItem: MediaItem | null;
  /** Agregado: badge de tipo por card (aquí los tipos se mezclan). */
  showType: boolean;
  query: string;
  isSearching: boolean;
  hasActiveFilters: boolean;
  onRandom: () => void;
  onClearRandom: () => void;
  onClearSearch: () => void;
  onClearFilters: () => void;
}

export function DiscoverResults({
  loading,
  items,
  randomItem,
  showType,
  query,
  isSearching,
  hasActiveFilters,
  onRandom,
  onClearRandom,
  onClearSearch,
  onClearFilters,
}: DiscoverResultsProps) {
  const t = useTranslations("discover");
  const tF = useTranslations("filters");
  const tS = useTranslations("search");

  if (loading) {
    return (
      <div className="animate-pulse grid grid-cols-2 md:grid-cols-12 auto-rows-[130px] md:auto-rows-[150px] grid-flow-row-dense gap-5">
        {DISCOVER_SKELETON_CELLS.map((cellClass, i) => (
          <div key={i} className={cn("bg-surface-elevated rounded-bento", cellClass)} />
        ))}
      </div>
    );
  }

  if (items.length > 0) {
    return (
      <>
        {randomItem && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-accent-positive/30 bg-accent-positive/10 px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-text-primary">
              <IconDice className="h-4 w-4 text-accent-positive" aria-hidden="true" />
              {tS("showingRandom", { count: items.length })}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={onRandom}
                className="text-accent-info hover:text-accent-info/80 transition-colors"
              >
                {tS("randomizeAgain")}
              </button>
              <button
                type="button"
                onClick={onClearRandom}
                aria-label={tF("reset")}
                className="text-muted hover:text-text-primary transition-colors"
              >
                <IconClose className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        <MediaGrid items={randomItem ? [randomItem] : items} showType={showType} layout="bento" />
      </>
    );
  }

  return (
    <div className="text-center py-16">
      {isSearching ? (
        <>
          <p data-testid="discover-empty" className="text-muted">
            {tS("noResults")} &ldquo;{query}&rdquo;
          </p>
          <button
            onClick={onClearSearch}
            className="text-accent-info text-sm mt-2 hover:text-accent-info/80 transition-colors"
          >
            {tF("reset")}
          </button>
        </>
      ) : hasActiveFilters ? (
        <>
          {/* 0 resultados CON filtros: ofrecer limpiar. */}
          <p data-testid="discover-empty" className="text-muted">
            {t("noResults")}
          </p>
          <button
            onClick={onClearFilters}
            className="text-accent-info text-sm mt-2 hover:text-accent-info/80 transition-colors"
          >
            {tF("reset")}
          </button>
        </>
      ) : (
        // Catálogo base vacío (sin filtros): no hay nada que limpiar.
        <p className="text-muted">{t("noResults")}</p>
      )}
    </div>
  );
}
