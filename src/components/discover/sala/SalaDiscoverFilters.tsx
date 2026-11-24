"use client";

// ============================================================
// KULTURA — SalaDiscoverFilters (fase 8.5 D2, bandera SALA_DESCUBRIR)
// Los filtros de Descubrir en «Sala», al estilo del panel de la biblioteca
// (B2). Sustituye a `FilterBar` en el camino de «Sala»: los mismos grupos
// (`useFilterGroups`), los mismos valores y los mismos parámetros de la URL
// (`useDiscoverUrl.changeFilter`), así que /api/discover recibe lo de hoy.
//
// - «Filtros · N» abre un panel (`aria-expanded`, cerrado al entrar). N es
//   cuántos filtros hay puestos (sin contar el orden).
// - Los de varias opciones a la vez (género, plataforma, estado, formato…):
//   botones con `aria-pressed` que se parten en varias líneas. Sin popover ni
//   scroll horizontal: con 18 opciones como mucho (géneros de cine), se ven
//   todas y se recorren con Tab; el lector dice «pulsado» o «no pulsado».
// - Los de una sola opción (año, valoración, duración, temporadas…): un
//   `<select>` nativo con «Cualquiera», como «Nota mínima» de la biblioteca.
// - «Ordenar por», fuera del panel: otro `<select>` nativo.
// - «Quitar filtros» aparece si hay alguno y deja el orden.
//
// Todo filtra al momento. La URL cambia con `pushState` (sin volver a montar
// la página): el panel sigue abierto y el foco en el control pulsado.
// ============================================================

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/index";
import type { FilterGroup } from "@/components/ui/FilterBar";
import { SalaButton } from "@/components/sala/SalaButton";
import { SalaSelect } from "@/components/sala/SalaSelect";

export interface SalaDiscoverFiltersProps {
  groups: FilterGroup[];
  activeFilters: Record<string, string | string[]>;
  onChange: (key: string, value: string | string[]) => void;
  /** Quita los filtros y deja el orden. */
  onClear: () => void;
}

/** Marca de «elegido»: lo dice la forma, no solo el color (y `aria-pressed`). */
function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" className="h-4 w-4 shrink-0">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

/** Tres reguladores: el icono de «Filtros» (el de la biblioteca). */
function FiltersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M3 5h14M3 10h14M3 15h14" />
      <path d="M7 3v4M13 8v4M9 13v4" />
    </svg>
  );
}

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

const isMulti = (group: FilterGroup) => group.kind === "multi" || group.kind === "searchable";

/** Valor de un grupo de una opción: `""` o `"all"` es «sin filtro». */
function single(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return v === "" ? "all" : v;
}

function multi(raw: string | string[] | undefined): string[] {
  return Array.isArray(raw) ? raw : raw && raw !== "all" ? [raw] : [];
}

/** Un grupo de varias opciones: botones con `aria-pressed` que se parten en líneas. */
function MultiGroup({ group, value, onChange }: { group: FilterGroup; value: string[]; onChange: SalaDiscoverFiltersProps["onChange"] }) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} data-sala-discover-filter={group.key}>
      <p id={labelId} className="mb-2 sala-type-label">
        {group.label}
      </p>
      <div className="flex flex-wrap gap-2">
        {group.options.map((option) => {
          const pressed = value.includes(option.value);
          return (
            <Toggle
              key={option.value}
              pressed={pressed}
              onClick={() => onChange(group.key, pressed ? value.filter((v) => v !== option.value) : [...value, option.value])}
            >
              {option.label}
            </Toggle>
          );
        })}
      </div>
    </div>
  );
}

export function SalaDiscoverFilters({ groups, activeFilters, onChange, onClear }: SalaDiscoverFiltersProps) {
  const tF = useTranslations("filters");
  const tS = useTranslations("discover.sala");
  const panelId = useId();
  const [open, setOpen] = useState(false);

  const sortGroup = groups.find((g) => g.variant === "sort");
  const panelGroups = groups.filter((g) => g !== sortGroup);
  const multiGroups = panelGroups.filter(isMulti);
  const singleGroups = panelGroups.filter((g) => !isMulti(g));

  // Filtros puestos (uno por grupo, como la biblioteca); el orden no cuenta.
  const active = panelGroups.filter((g) => (isMulti(g) ? multi(activeFilters[g.key]).length > 0 : single(activeFilters[g.key]) !== "all")).length;

  // Sin orden en la URL, el de la primera opción (el del proveedor), como hoy.
  const sortValue = sortGroup ? single(activeFilters[sortGroup.key]) : "all";
  const sortShown = sortGroup?.options.some((o) => o.value === sortValue) ? sortValue : (sortGroup?.options[0]?.value ?? "");

  return (
    <div data-sala-discover-filters="" className="mb-6">
      {/* Barra: abrir los filtros, quitarlos y el orden. */}
      <div className="flex flex-wrap items-end gap-3">
        {panelGroups.length > 0 ? (
          <SalaButton
            variant="secondary"
            icon={<FiltersIcon />}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
          >
            {active > 0 ? tS("filtersActive", { count: active }) : tF("filters")}
          </SalaButton>
        ) : null}
        {active > 0 ? (
          <SalaButton variant="quiet" onClick={onClear}>
            {tF("reset")}
          </SalaButton>
        ) : null}
        {sortGroup ? (
          <SalaSelect
            label={tS("sortLabel")}
            value={sortShown}
            onChange={(e) => onChange(sortGroup.key, e.target.value)}
            fieldClassName="w-full sm:ml-auto sm:w-72"
          >
            {sortGroup.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SalaSelect>
        ) : null}
      </div>

      <div
        id={panelId}
        hidden={!open}
        data-sala-discover-filter-panel=""
        // `grid` pisaría al `hidden` del navegador: la clase solo va abierto.
        className={cn("mt-4 gap-6 bg-sala-panel p-4 motion-safe:animate-sala-rise-in sm:p-6", open ? "grid" : "hidden")}
      >
        {multiGroups.map((group) => (
          <MultiGroup key={group.key} group={group} value={multi(activeFilters[group.key])} onChange={onChange} />
        ))}

        {/* Los de una opción, en una fila de desplegables (se parten en el móvil). */}
        {singleGroups.length > 0 ? (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            {singleGroups.map((group) => (
              <SalaSelect
                key={group.key}
                data-sala-discover-filter={group.key}
                label={group.label}
                value={single(activeFilters[group.key])}
                onChange={(e) => onChange(group.key, e.target.value)}
                fieldClassName="w-full sm:w-56"
              >
                <option value="all">{tS("any")}</option>
                {group.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SalaSelect>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
