"use client";

// ============================================================
// KULTURA — SalaDiscoverView (fase 8.5 D1, bandera SALA_DESCUBRIR)
// Descubrir en «Sala»: cabecera, buscador, «Sorpréndeme», tipos, la rejilla
// de `SalaWorkCard` y la paginación. Los filtros siguen siendo los de hoy
// (`FilterBar`) hasta D2.
//
// Solo se carga con `next/dynamic` (`SalaDiscoverViewLazy`): con la bandera
// apagada Descubrir no descarga su código ni sus hojas.
//
// El estado sigue en la URL y lo lleva `DiscoverClient` (`useDiscoverUrl`,
// `useDiscoverQuery`), igual que hoy. Este componente solo pinta y avisa.
//
// Lo que arregla respecto a Descubrir de hoy (PLAN_FASE8, «fallos pequeños»):
// - **Imagen rota:** `SalaPoster` pone el campo de color con el título si no
//   hay portada o si falla. Las obras sin portada ya no se esconden.
// - **× repetidas:** una sola, la de borrar dentro del buscador. Ni chip de
//   búsqueda con otra ni × en el aleatorio: «Sorpréndeme» se apaga pulsándolo.
// - **Error anunciado:** región `alert` montada siempre; el aviso entra en
//   ella, con «Reintentar».
// - **`aria-pressed`** en lo que alterna: los tipos y «Sorpréndeme». En el
//   móvil los tipos van en un `<select>` nativo (Víctor, #299).
// - **Resultados anunciados:** la lista dice «Cargando obras» y, al acabar,
//   «12 obras» (`SalaWorkList`); el aleatorio, por su propia región.
// ============================================================

import "@/styles/sala/tokens.css";
import "@/styles/sala/fonts.css";
import "@/styles/sala/title.css";

import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { MediaItem } from "@/types/media";
import type { DiscoverResult } from "@/lib/api/discover";
import { TYPE_ORDER, type DiscoverType } from "@/lib/discover/type-filters";
import { googleBooksVolumeId } from "@/lib/media/google-books";
import { FilterBar, type FilterGroup } from "@/components/ui/FilterBar";
import { SalaSelect } from "@/components/sala/SalaSelect";
import { ELLIPSIS, buildPageWindow } from "@/components/ui/Pagination";
import { GoogleBooksAttribution } from "@/components/media/GoogleBooksAttribution";
import { SalaButton } from "@/components/sala/SalaButton";
import { SalaBlockState } from "@/components/sala/SalaBlockState";
import { SalaNotice } from "@/components/sala/SalaNotice";
import { SalaWorkList } from "@/components/sala/SalaWorkList";
import { SalaWorkCard } from "@/components/sala/SalaWorkCard";
import { SalaToastProvider, type SalaToastLabels } from "@/components/sala/SalaToast";
import { SalaDiscoverSearch } from "./SalaDiscoverSearch";
import { SalaDiscoverQuickAdd } from "./SalaDiscoverQuickAdd";

export interface SalaDiscoverViewProps {
  type: DiscoverType;
  query: string;
  isSearching: boolean;
  loading: boolean;
  items: MediaItem[];
  fetchErrorKind: DiscoverResult["fetchErrorKind"];
  onRetry: () => void;
  /** «Sorpréndeme»: si hay uno elegido, la rejilla muestra solo ese. */
  randomItem: MediaItem | null;
  onRandom: () => void;
  onClearRandom: () => void;
  filterGroups: FilterGroup[];
  activeFilters: Record<string, string | string[]>;
  hasActiveFilters: boolean;
  onFilterChange: (key: string, value: string | string[]) => void;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onTypeChange: (type: string) => void;
  currentPage: number;
  hasMore: boolean;
  totalPages: number | null;
  onPageChange: (page: number) => void;
  /** Fase 8.2 (bandera QUICK_ADD): «+» en cada tarjeta. */
  quickAdd: boolean;
  /** Textos de la zona de avisos, ya traducidos (los pone el servidor). */
  toastLabels: SalaToastLabels;
}

/** Dos columnas en el móvil, como la biblioteca (B1): con tres, la portada casi no se ve. */
const REJILLA = "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
const SIZES = "(min-width: 1280px) 15vw, (min-width: 1024px) 18vw, (min-width: 768px) 22vw, (min-width: 640px) 30vw, 45vw";
/** Las que se ven sin hacer scroll. */
const PRIORITY_CARDS = 6;
/** Esqueletos mientras llega una página: una fila larga en escritorio, tres en el móvil. */
const SKELETONS = 6;

/** Marca de «elegido»: lo dice la forma, no solo el color (y `aria-pressed`). */
function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" className="h-4 w-4 shrink-0">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

/** Dado de trazo recto. */
function DiceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M3 3h14v14H3z" />
      <path d="M7 7h.01M13 7h.01M10 10h.01M7 13h.01M13 13h.01" strokeWidth="3" />
    </svg>
  );
}

/** Un botón que se enciende o se apaga: `SalaButton` con `aria-pressed` (como B2). */
function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <SalaButton
      variant={pressed ? "primary" : "secondary"}
      aria-pressed={pressed}
      onClick={onClick}
      icon={pressed ? <CheckIcon /> : undefined}
      className="px-4"
    >
      {children}
    </SalaButton>
  );
}

export function SalaDiscoverView({ toastLabels, ...props }: SalaDiscoverViewProps) {
  return (
    <SalaToastProvider labels={toastLabels}>
      <View {...props} />
    </SalaToastProvider>
  );
}

function View(props: Omit<SalaDiscoverViewProps, "toastLabels">) {
  const {
    type,
    query,
    isSearching,
    items,
    randomItem,
    fetchErrorKind,
    onRetry,
    onRandom,
    onClearRandom,
    filterGroups,
    activeFilters,
    onFilterChange,
    onSearch,
    onClearSearch,
    onTypeChange,
  } = props;
  const t = useTranslations("discover");
  const tS = useTranslations("discover.sala");
  const tSearch = useTranslations("search");
  const tF = useTranslations("filters");
  const typeId = useId();

  return (
    <div data-sala-discover="" className="font-sala-text text-sala-ink">
      <h1 className="mb-6 sala-type-heading [overflow-wrap:anywhere]">{t("title")}</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SalaDiscoverSearch
          query={query}
          type={type}
          onSearch={onSearch}
          onClear={onClearSearch}
          className="min-w-0 flex-1 basis-64"
        />
        {/* Alterna: pulsado enseña una obra al azar; otra vez, todas. */}
        <SalaButton
          variant={randomItem ? "primary" : "secondary"}
          icon={<DiceIcon />}
          aria-pressed={randomItem !== null}
          disabled={items.length === 0 && randomItem === null}
          onClick={randomItem ? onClearRandom : onRandom}
        >
          {tSearch("randomize")}
        </SalaButton>
      </div>

      {isSearching ? (
        <p data-sala-discover-query="" className="mb-4 sala-type-label [overflow-wrap:anywhere]">
          {tS("resultsFor", { query })}
        </p>
      ) : null}

      {/* Tipo (Víctor, #299): en el móvil, un `<select>` nativo como los de la
          biblioteca; desde `sm`, los botones con `aria-pressed`. Mismo manejador
          y mismo parámetro de la URL: solo cambia lo que se ve (CSS). */}
      <SalaSelect
        data-sala-discover-type-select=""
        label={tF("type")}
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        fieldClassName="mb-4 w-full sm:hidden"
      >
        {TYPE_ORDER.map((tp) => (
          <option key={tp} value={tp}>
            {tF(tp)}
          </option>
        ))}
      </SalaSelect>
      <div role="group" aria-labelledby={typeId} data-sala-discover-type-toggles="" className="mb-4 hidden sm:block">
        <p id={typeId} className="mb-2 sala-type-label">
          {tF("type")}
        </p>
        <div className="flex flex-wrap gap-2">
          {TYPE_ORDER.map((tp) => (
            <Toggle key={tp} pressed={tp === type} onClick={() => onTypeChange(tp)}>
              {tF(tp)}
            </Toggle>
          ))}
        </div>
      </div>

      {/* Los filtros de hoy, hasta D2. Ocultos al buscar: los buscadores de los proveedores no los aceptan. */}
      {!isSearching ? (
        <div role="group" aria-label={tF("filters")} className="mb-6 flex items-center gap-3">
          <FilterBar className="flex-1" groups={filterGroups} activeFilters={activeFilters} onChange={onFilterChange} />
        </div>
      ) : null}

      {/* Región montada siempre: un lector anuncia el error al entrar el aviso. */}
      <div role="alert" data-sala-discover-error="" className={fetchErrorKind !== null ? "mb-6" : undefined}>
        {fetchErrorKind !== null ? (
          <SalaNotice
            tone="error"
            live="off"
            title={tS("errorTitle")}
            action={
              <SalaButton variant="secondary" onClick={onRetry}>
                {tS("retry")}
              </SalaButton>
            }
          >
            {fetchErrorKind === "rate-limit" ? t("fetchError.rateLimit") : t("fetchError.generic")}
          </SalaNotice>
        ) : null}
      </div>

      <Results {...props} />
      <Pages {...props} />
    </div>
  );
}

function Results({
  loading,
  items,
  randomItem,
  fetchErrorKind,
  query,
  isSearching,
  hasActiveFilters,
  quickAdd,
  onRandom,
  onClearSearch,
}: Omit<SalaDiscoverViewProps, "toastLabels">) {
  const t = useTranslations("discover");
  const tS = useTranslations("discover.sala");
  const tSearch = useTranslations("search");
  const tF = useTranslations("filters");
  const tType = useTranslations("discoverFilters.typeBadge");

  const shown = loading ? [] : randomItem ? [randomItem] : items;
  const fromGoogleBooks = shown.some((item) => googleBooksVolumeId(item) !== null);
  const empty = !loading && items.length === 0;

  return (
    <>
      {/* El aleatorio se anuncia por su región (la lista no carga al elegirlo). */}
      <p role="status" className={randomItem ? "mb-4 sala-type-label" : "sr-only"}>
        {randomItem ? tSearch("showingRandom", { count: items.length }) : ""}
      </p>
      {randomItem ? (
        <div className="mb-6 flex flex-wrap gap-3">
          <SalaButton variant="secondary" icon={<DiceIcon />} onClick={onRandom}>
            {tSearch("randomizeAgain")}
          </SalaButton>
        </div>
      ) : null}

      {/* Montada siempre (también vacía): así anuncia «Cargando obras» y, al acabar, cuántas hay. */}
      <SalaWorkList
        aria-label={tS("gridLabel")}
        loading={loading}
        loadingLabel={tS("loading")}
        loadedLabel={tS("results", { count: shown.length })}
        skeletons={SKELETONS}
        className={loading || shown.length > 0 ? REJILLA : "hidden"}
      >
        {shown.map((item, i) => (
          <SalaWorkCard
            key={item.id}
            href={`/media/${item.type}/${item.externalId}`}
            title={item.title}
            format={item.type}
            formatLabel={tType(item.type)}
            year={item.year}
            poster={item.poster ?? null}
            ratio="2/3"
            sizes={SIZES}
            priority={i < PRIORITY_CARDS}
            headingLevel={2}
            action={quickAdd ? <SalaDiscoverQuickAdd mediaId={item.id} title={item.title} /> : undefined}
          />
        ))}
      </SalaWorkList>
      {fromGoogleBooks ? <GoogleBooksAttribution label={tSearch("googleBooksResults")} className="mt-4" /> : null}

      {/* Sin obras y sin error (el error ya lo dice su aviso). */}
      {empty && fetchErrorKind === null ? (
        isSearching ? (
          <SalaBlockState
            title={tS("emptySearch", { query })}
            description={tS("emptySearchHint")}
            action={
              <SalaButton variant="secondary" onClick={onClearSearch}>
                {tS("clearSearch")}
              </SalaButton>
            }
          />
        ) : hasActiveFilters ? (
          <SalaBlockState
            title={t("noResults")}
            description={tS("emptyFiltersHint")}
            action={
              <SalaButton variant="secondary" onClick={onClearSearch}>
                {tF("reset")}
              </SalaButton>
            }
          />
        ) : (
          <SalaBlockState title={t("noResults")} />
        )
      ) : null}
    </>
  );
}

/** Paginación de «Sala»: la misma ventana que la de hoy, con `SalaButton` de 48 px que se parten en filas. */
function Pages({ loading, hasMore, currentPage, totalPages, onPageChange, randomItem }: Omit<SalaDiscoverViewProps, "toastLabels">) {
  const t = useTranslations("discover");
  if (loading || randomItem || !(hasMore || currentPage > 1)) return null;
  const entries = buildPageWindow(currentPage, totalPages);
  return (
    <nav aria-label={t("paginationLabel")} className="mt-10">
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          <SalaButton variant="secondary" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
            {t("previous")}
          </SalaButton>
        </li>
        {entries.map((entry, i) =>
          entry === ELLIPSIS ? (
            <li key={`e-${i}`} aria-hidden="true" className="px-1 sala-type-label">
              …
            </li>
          ) : (
            <li key={entry}>
              <SalaButton
                variant={entry === currentPage ? "primary" : "secondary"}
                aria-label={t("pageN", { n: entry })}
                aria-current={entry === currentPage ? "page" : undefined}
                onClick={() => onPageChange(entry)}
                className="min-w-sala-target px-3 tabular-nums"
              >
                {entry}
              </SalaButton>
            </li>
          )
        )}
        <li>
          <SalaButton variant="secondary" disabled={!hasMore} onClick={() => onPageChange(currentPage + 1)}>
            {t("next")}
          </SalaButton>
        </li>
      </ul>
    </nav>
  );
}
