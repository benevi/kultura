"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import type { MediaItem } from "@/types/media";
import type { DiscoverResult } from "@/lib/api/discover";
import { MediaGrid } from "@/components/media/MediaGrid";
import { Pagination } from "@/components/ui/Pagination";
import { FilterBar, type FilterGroup } from "@/components/ui/FilterBar";
import {
  TYPE_ORDER,
  TYPE_FILTERS,
  type DiscoverType,
} from "@/lib/discover/type-filters";
import { getFilterOptions, humanizeSlug } from "@/lib/discover/filter-options";
import { cn } from "@/lib/utils/index";
import {
  type LucideIcon,
  LayoutGrid,
  Tag,
  Calendar,
  Star,
  Monitor,
  Clock,
  Globe,
  Activity,
  Layers,
  Users,
  BookCopy,
  Building2,
  FileText,
  Gamepad2,
  Timer,
  ArrowUpDown,
} from "lucide-react";

// Icono lucide por key de filtro (spec V2 §Barra). Mapea claves lógicas de
// TYPE_FILTERS a su icono pequeño en trigger + cabecera de popover.
const FILTER_ICONS: Record<string, LucideIcon> = {
  genre: Tag,
  year: Calendar,
  valoracion: Star,
  platform: Monitor,
  duracion: Clock,
  idioma: Globe,
  status: Activity,
  estado: Activity,
  temporadas: Layers,
  demografia: Users,
  volumenes: BookCopy,
  editorial: Building2,
  formato: FileText,
  modojuego: Gamepad2,
  duracionmedia: Timer,
  sort: ArrowUpDown,
};

export interface DiscoverClientProps {
  currentType: string;
  currentPage: number;
}

// Triggers cuyo valor en URL es CSV (string[]). El resto es single (string).
const MULTI_KINDS = new Set(["multi", "searchable"]);

// Todos los query params de filtro que /api/discover parsea (discover-params.ts).
// `type`/`page` se manejan aparte; el resto se reenvía tal cual al fetch.
const FILTER_PARAM_KEYS = [
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
  // E59 R2 — paramKeys nuevos del rediseño V2. El backend los ignora hasta R4
  // (inocuo: si no están en la URL no se envían; si están, /api/discover los
  // descarta hasta que R4 los aplique server-side).
  "rating",
  "seasons",
  "gamemode",
  "playtime",
  "estado",
] as const;

/**
 * Buckets de año relativos al año actual: [actual, -1, -2] como YYYY +
 * 2 décadas previas como YYYYs + 'classic'. value en el formato que parsea
 * discover-params (YYYY / YYYYs / classic). label = placeholder (i18n: F6).
 */
function buildYearBuckets(): { value: string; label: string }[] {
  const now = new Date().getFullYear();
  const years = [now, now - 1, now - 2].map((y) => ({
    value: String(y),
    label: String(y),
  }));
  // Década que contiene el año más antiguo listado, y la anterior.
  const baseDecade = Math.floor((now - 2) / 10) * 10;
  const decades = [baseDecade - 10, baseDecade - 20].map((d) => ({
    value: `${d}s`,
    label: `${d}s`,
  }));
  return [...years, ...decades, { value: "classic", label: "classic" }];
}

function isDiscoverType(t: string): t is DiscoverType {
  return (TYPE_ORDER as readonly string[]).includes(t);
}

export function DiscoverClient({
  currentType,
  currentPage,
}: DiscoverClientProps) {
  const t = useTranslations("discover");
  const tF = useTranslations("filters");
  const tDF = useTranslations("discoverFilters");
  const router = useRouter();
  const searchParams = useSearchParams();

  const type: DiscoverType = isDiscoverType(currentType)
    ? currentType
    : "movie";
  // "all" = agregado (modo Descubrir todos). R5a: backend responde el merge de
  // las 7 familias por /api/discover?type=all. R5b: se pinta como grid normal,
  // con badge de tipo por card (showType) porque aquí los tipos sí se mezclan.
  const isAggregate = type === "all";

  // E59 F2/F5e: el fetch vive en el navegador (vía /api/discover) para que los
  // E2E puedan mockearlo con page.route. Se re-pide al cambiar cualquier param
  // de la URL (type, page, o cualquier filtro). Sin filtrado client-side: la
  // URL es la única fuente de verdad y el servidor aplica todos los filtros.
  const [items, setItems] = useState<MediaItem[]>([]);
  // E79 slice 1: el gate de "next" usa hasMore (fuente cruda), no totalPages.
  const [hasMore, setHasMore] = useState(false);
  // E79 slice 1b: totalPages del proveedor (DiscoverResult) → ventana numerada.
  // Solo alimenta la UI de la paginación; el gate de "siguiente" sigue en hasMore.
  const [totalPages, setTotalPages] = useState(1);
  const [fetchErrorKind, setFetchErrorKind] =
    useState<DiscoverResult["fetchErrorKind"]>(null);
  const [loading, setLoading] = useState(true);

  // Cadena estable de los params de filtro presentes en la URL → dependencia
  // del fetch (re-pide cuando cambia cualquier filtro, no solo type/page).
  const filterQuery = useMemo(() => {
    const out = new URLSearchParams();
    for (const key of FILTER_PARAM_KEYS) {
      const v = searchParams.get(key);
      if (v) out.set(key, v);
    }
    return out.toString();
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    // R5b: "all" ya hace fetch normal a /api/discover?type=all (el backend R5a
    // devuelve el merge de las 7 familias). Sin short-circuit.
    setLoading(true);
    const params = new URLSearchParams(filterQuery);
    params.set("type", type);
    params.set("page", String(currentPage));
    fetch(`/api/discover?${params.toString()}`)
      .then((res) => res.json() as Promise<DiscoverResult>)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setHasMore(data.hasMore ?? false);
        setTotalPages(data.totalPages ?? 1);
        setFetchErrorKind(data.fetchErrorKind ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setHasMore(false);
        setTotalPages(1);
        setFetchErrorKind("generic");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, currentPage, filterQuery]);

  // SegmentedControl de tipo: options derivadas de TYPE_ORDER.
  const typeOptions = useMemo(
    () => TYPE_ORDER.map((tp) => ({ value: tp, label: tF(tp) })),
    [tF]
  );

  // FilterBar contextual: un group por trigger visible de TYPE_FILTERS[type].
  // R3: icono lucide por key, y variante 'sort' para el pill "Ordenar: <valor>".
  // R6: label de trigger y de opción vía i18n (namespace discoverFilters). El
  // value (slug canónico) NUNCA se toca; solo se traduce el label visible. Para
  // catálogos sin traducción (platform/editorial = nombres propios, o slugs de
  // género no listados) se cae a humanizeSlug — la clave i18n actúa de override.
  const filterGroups: FilterGroup[] = useMemo(() => {
    // Label de trigger: discoverFilters.trigger.<key>, fallback humanizeSlug.
    const triggerLabel = (key: string) =>
      tDF.has(`trigger.${key}`) ? tDF(`trigger.${key}`) : humanizeSlug(key);
    // Label de opción: discoverFilters.options.<key>.<slug>, fallback humanizeSlug.
    const optionLabel = (key: string, value: string) =>
      tDF.has(`options.${key}.${value}`)
        ? tDF(`options.${key}.${value}`)
        : humanizeSlug(value);

    return TYPE_FILTERS[type].map((trigger) => {
      const isSort = trigger.key === "sort";
      // year: buckets propios (años/décadas/classic). Solo "classic" tiene
      // label traducible; el resto son literales numéricos que no se traducen.
      const rawOptions =
        trigger.key === "year"
          ? buildYearBuckets().map((o) =>
              o.value === "classic"
                ? { value: o.value, label: tF("classic") }
                : o
            )
          : getFilterOptions(type, trigger.key).map((o) => ({
              value: o.value,
              label: optionLabel(trigger.key, o.value),
            }));
      return {
        key: trigger.key,
        kind: trigger.kind,
        align: trigger.align,
        icon: FILTER_ICONS[trigger.key],
        label: triggerLabel(trigger.key),
        ...(isSort
          ? { variant: "sort" as const, sortLabel: tF("sort") }
          : {}),
        options: rawOptions,
      };
    });
  }, [type, tF, tDF]);

  // activeFilters desde la URL: multi → CSV→string[]; resto → string.
  const activeFilters: Record<string, string | string[]> = useMemo(() => {
    const out: Record<string, string | string[]> = {};
    for (const trigger of TYPE_FILTERS[type]) {
      const raw = searchParams.get(trigger.key);
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

  // Cambio de tipo: navega a ?type=X&page=1 y BORRA el resto de filtros
  // (los triggers difieren por tipo, sus valores no son portables).
  function handleTypeChange(newType: string) {
    router.push(`/discover?type=${newType}&page=1`);
  }

  // Cambio de un filtro: muta los searchParams actuales, siempre page=1.
  function handleFilterChange(key: string, value: string | string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else if (Array.isArray(value)) {
      if (value.length === 0) params.delete(key);
      else params.set(key, value.join(","));
    } else {
      params.set(key, value);
    }
    params.set("type", type);
    params.set("page", "1");
    router.push(`/discover?${params.toString()}`);
  }

  // "Limpiar filtros": borra TODOS los params de filtro, mantiene type+page=1.
  function clearFilters() {
    router.push(`/discover?type=${type}&page=1`);
  }

  // Hay al menos un filtro aplicado en la URL (distingue "0 resultados con
  // filtros" de "catálogo base vacío"). filterQuery solo recoge FILTER_PARAM_KEYS.
  const hasActiveFilters = filterQuery !== "";

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

      {/* Barra Descubrir (R3): 2 filas etiquetadas (TIPO / FILTROS) + separador.
          Sticky bajo el header de app (h-14). El grid fluye debajo sin solapar. */}
      <div className="sticky top-14 z-30 bg-bg/95 backdrop-blur-sm border-b border-border py-3 px-4 -mx-4 mb-6 flex flex-col gap-3">
        {/* FILA 1 — TIPO: label tenue + pills separadas (radiogroup). */}
        <div className="flex items-center gap-3">
          <span className="shrink-0 font-mono uppercase text-xs tracking-widest text-muted">
            {tF("type")}
          </span>
          <div
            role="radiogroup"
            aria-label={tF("type")}
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-nowrap"
          >
            {typeOptions.map((option) => {
              const active = option.value === type;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleTypeChange(option.value)}
                  className={cn(
                    "inline-flex items-center justify-center px-4 py-2 rounded-full",
                    "text-sm font-body font-medium whitespace-nowrap cursor-pointer border",
                    "transition-all duration-150 ease-out active:scale-[0.97]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-positive focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
                    active
                      ? "bg-accent-positive text-on-accent-positive border-accent-positive"
                      : "bg-surface-elevated text-text-secondary border-surface-border hover:text-text-primary hover:border-text-tertiary"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* SEPARADOR sutil entre filas. */}
        <div className="border-t border-border" />

        {/* FILA 2 — FILTROS: label con icono grid + triggers (sort a la derecha). */}
        <div className="flex items-center gap-3">
          <span className="shrink-0 inline-flex items-center gap-1.5 font-mono uppercase text-xs tracking-widest text-muted">
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
            {tF("filters")}
          </span>
          <FilterBar
            className="flex-1"
            groups={filterGroups}
            activeFilters={activeFilters}
            onChange={handleFilterChange}
          />
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-[2/3] bg-surface-elevated rounded-card" />
              <div className="h-3 w-3/4 bg-surface-elevated rounded-button" />
              <div className="h-3 w-1/2 bg-surface-elevated rounded-button" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <MediaGrid
          items={items}
          showType={isAggregate}
          className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        />
      ) : (
        <div className="text-center py-16">
          {hasActiveFilters ? (
            <>
              {/* 0 resultados CON filtros: ofrecer limpiar.
                  Mensaje y label reusan claves existentes (noResults ya está
                  redactado en clave de filtros; reset = "Limpiar filtros").
                  i18n: F6 puede dividirlos en claves dedicadas. */}
              <p data-testid="discover-empty" className="text-muted">
                {t("noResults")}
              </p>
              <button
                onClick={clearFilters}
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
      )}

      {/* Pagination — E79 slice 1: visible si hay siguiente (hasMore) o si no
          estamos en la página 1 (para poder retroceder desde una última corta). */}
      {!loading && (hasMore || currentPage > 1) && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <Pagination
            currentPage={currentPage}
            hasMore={hasMore}
            totalPages={totalPages}
            onPageChange={(page) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("type", type);
              params.set("page", String(page));
              router.push(`/discover?${params.toString()}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
