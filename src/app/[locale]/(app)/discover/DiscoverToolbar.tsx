"use client";

// KULTURA — Barra fija de Descubrir (R3): BUSCAR / TIPO / FILTROS.
//
// Sticky bajo el header de app (h-14), con fondo OPACO (translúcida dejaba ver
// las portadas). En móvil cada fila scrollea en horizontal para que los chips
// no se corten ni se partan en varias líneas.

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { SearchBar } from "@/components/search/SearchBar";
import { FilterBar, type FilterGroup } from "@/components/ui/FilterBar";
import { TYPE_ORDER, type DiscoverType } from "@/lib/discover/type-filters";
import { cn } from "@/lib/utils/index";
import { IconDice, IconClose } from "@/components/icons";
import { TYPE_ICONS } from "./discover-config";

export interface DiscoverToolbarProps {
  type: DiscoverType;
  query: string;
  isSearching: boolean;
  /** Sin resultados, "Sorpréndeme" se deshabilita (pero sigue visible). */
  canRandomize: boolean;
  filterGroups: FilterGroup[];
  activeFilters: Record<string, string | string[]>;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onRandom: () => void;
  onTypeChange: (type: string) => void;
  onFilterChange: (key: string, value: string | string[]) => void;
}

export function DiscoverToolbar({
  type,
  query,
  isSearching,
  canRandomize,
  filterGroups,
  activeFilters,
  onSearch,
  onClearSearch,
  onRandom,
  onTypeChange,
  onFilterChange,
}: DiscoverToolbarProps) {
  const tF = useTranslations("filters");
  const tS = useTranslations("search");
  const typeOptions = useMemo(() => TYPE_ORDER.map((tp) => ({ value: tp, label: tF(tp) })), [tF]);

  return (
    <div className="sticky top-14 z-30 bg-bg border-b border-border py-3 px-4 -mx-4 mb-6 flex flex-col gap-2.5 md:gap-3">
      {/* FILA 0 — BUSCAR (E-DISCOVER-SEARCH-MERGE): el buscador vive aquí
          desde que /search se fusionó en /discover. */}
      <div className="flex items-center gap-2">
        <SearchBar
          key={query}
          mode="inline"
          defaultValue={query}
          onSubmit={onSearch}
          onClear={onClearSearch}
          type={type}
          className="flex-1 min-w-0"
        />
        {/* "Sorpréndeme": SIEMPRE visible, solo deshabilitado sin resultados. */}
        <button
          type="button"
          onClick={onRandom}
          disabled={!canRandomize}
          aria-label={tS("randomize")}
          title={tS("randomize")}
          className={cn(
            "shrink-0 inline-flex items-center justify-center gap-1.5 rounded-button border px-3 py-2",
            "text-sm font-body font-medium whitespace-nowrap",
            "transition-all duration-150 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
            !canRandomize
              ? // Deshabilitado sin apagarlo con opacidad (se quedaba por debajo
                // de 4,5:1): texto terciario y borde discontinuo.
                "bg-surface-elevated text-text-tertiary border-dashed border-surface-border cursor-not-allowed"
              : "bg-surface-elevated text-text-secondary border-surface-border hover:text-text-primary hover:border-text-tertiary active:scale-[0.97] cursor-pointer"
          )}
        >
          <IconDice className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">{tS("randomize")}</span>
        </button>
      </div>

      {/* Chip de búsqueda activa, con salida rápida al catálogo. */}
      {isSearching && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-positive/10 border border-accent-positive/30 px-3 py-1 text-xs text-text-primary">
            <span className="text-muted">{tS("resultsFor")}</span>
            <span className="font-medium">{query}</span>
            <button
              type="button"
              onClick={onClearSearch}
              aria-label={tF("reset")}
              className="text-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink rounded-full"
            >
              <IconClose className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}

      <div className="border-t border-border" />

      {/* FILA 1 — TIPO: pills separadas (radiogroup). */}
      <div className="flex items-center gap-3">
        <div
          role="radiogroup"
          aria-label={tF("type")}
          className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-nowrap"
        >
          {typeOptions.map((option) => {
            const active = option.value === type;
            const TypeIcon = TYPE_ICONS[option.value];
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onTypeChange(option.value)}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full",
                  "text-sm font-body font-medium whitespace-nowrap cursor-pointer border",
                  "transition-all duration-150 ease-out active:scale-[0.97]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
                  active
                    ? "bg-accent-positive text-on-accent-positive border-accent-positive"
                    : "bg-surface-elevated text-text-secondary border-surface-border hover:text-text-primary hover:border-text-tertiary"
                )}
              >
                <TypeIcon className="w-4 h-4" aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* FILA 2 — FILTROS. Oculta en modo búsqueda: los buscadores de los
          proveedores no aceptan estos filtros (el tipo sí aplica). El nombre
          de la fila lo da el grupo a quien usa lector (E-SIN-MONO). */}
      {!isSearching && (
        <>
          <div className="border-t border-border" />
          <div role="group" aria-label={tF("filters")} className="flex items-center gap-3">
            <FilterBar
              className="flex-1"
              groups={filterGroups}
              activeFilters={activeFilters}
              onChange={onFilterChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
