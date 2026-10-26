// ============================================================
// KULTURA — Estado de Descubrir en la URL y navegación (E59, E88)
//
// La URL es la única fuente de verdad: tipo, página, búsqueda y filtros. Este
// hook la lee (filtros activos, query string estable para el fetch) y la
// escribe (cambio de tipo, de filtro, búsqueda, página). Los filtros se
// escriben por `paramKey` (contrato del backend), no por la clave de la UI.
// ============================================================

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { TYPE_FILTERS, paramKeyFor, type DiscoverType } from "@/lib/discover/type-filters";

/**
 * Todos los parámetros de filtro que /api/discover parsea (discover-params.ts).
 * `type`/`page` van aparte. Incluye los `paramKey` que difieren de la clave de
 * la UI (E88: rating, seasons, gamemode, playtime): si faltaran aquí, el fetch
 * los perdería al reconstruir la query.
 */
export const DISCOVER_FILTER_PARAM_KEYS = [
  "genre",
  "year",
  "platform",
  "sort",
  "status",
  "demografia",
  "duracion",
  "temporadas",
  "volumenes",
  "horas",
  "editorial",
  "formato",
  "idioma",
  "rating",
  "seasons",
  "gamemode",
  "playtime",
  "estado",
] as const;

/** Triggers cuyo valor en la URL es CSV (string[]). El resto es single. */
const MULTI_KINDS = new Set(["multi", "searchable"]);

export function useDiscoverUrl(type: DiscoverType, query: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSearching = query.trim().length > 0;

  // Cadena estable de los filtros presentes → dependencia del fetch.
  const filterQuery = useMemo(() => {
    const out = new URLSearchParams();
    for (const key of DISCOVER_FILTER_PARAM_KEYS) {
      const v = searchParams.get(key);
      if (v) out.set(key, v);
    }
    return out.toString();
  }, [searchParams]);

  // Filtros activos por clave de UI, leídos por paramKey: multi → array.
  const activeFilters = useMemo(() => {
    const out: Record<string, string | string[]> = {};
    for (const trigger of TYPE_FILTERS[type]) {
      const raw = searchParams.get(paramKeyFor(trigger.key));
      if (MULTI_KINDS.has(trigger.kind)) {
        out[trigger.key] = raw
          ? raw
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : [];
      } else {
        out[trigger.key] = raw ?? "all";
      }
    }
    return out;
  }, [type, searchParams]);

  const go = (params: URLSearchParams) => router.push(`/discover?${params.toString()}`);

  return {
    isSearching,
    filterQuery,
    activeFilters,
    /** Hay algún filtro en la URL (distingue "0 con filtros" de catálogo vacío). */
    hasActiveFilters: filterQuery !== "",

    /**
     * Cambio de tipo: ?type=X&page=1 y FUERA los filtros (difieren por tipo).
     * La búsqueda se conserva: "búscame esto mismo en series".
     */
    changeType(newType: string) {
      const params = new URLSearchParams();
      params.set("type", newType);
      params.set("page", "1");
      if (isSearching) params.set("q", query.trim());
      go(params);
    },

    /** Busca dentro de /discover: escribe `q`, página 1, conserva el tipo. */
    submitSearch(q: string) {
      const params = new URLSearchParams();
      params.set("type", type);
      params.set("page", "1");
      params.set("q", q);
      go(params);
    },

    /** Limpia búsqueda o filtros: vuelve al catálogo del tipo activo. */
    resetToCatalog() {
      router.push(`/discover?type=${type}&page=1`);
    },

    /** Cambio de un filtro sobre la URL actual, siempre a la página 1. */
    changeFilter(key: string, value: string | string[]) {
      const paramKey = paramKeyFor(key);
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete(paramKey);
      } else if (Array.isArray(value)) {
        if (value.length === 0) params.delete(paramKey);
        else params.set(paramKey, value.join(","));
      } else {
        params.set(paramKey, value);
      }
      params.set("type", type);
      params.set("page", "1");
      go(params);
    },

    /** Otra página; `q` y los filtros ya viajan en la URL actual. */
    goToPage(page: number) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("type", type);
      params.set("page", String(page));
      go(params);
    },
  };
}
