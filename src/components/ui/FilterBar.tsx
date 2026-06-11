"use client"

import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/Popover"
import type { FilterKind } from "@/lib/discover/type-filters"

export interface FilterOption {
  value: string
  label: string
  icon?: string
}

export interface FilterGroup {
  key: string
  label: string
  options: FilterOption[]
  /** Naturaleza del trigger. Default 'single'. */
  kind?: FilterKind
  /** 'end' → empuja el trigger a la derecha de la fila (ml-auto). Solo sort. */
  align?: "end"
  /** Icono lucide pequeño dentro del trigger y la cabecera del popover. */
  icon?: LucideIcon
  /**
   * Variante 'sort': el trigger se renderiza como "<sortLabel>: <valor>"
   * (prefijo tenue + valor en negrita) en vez de pill estándar. Single-select.
   */
  variant?: "sort"
  /** Prefijo tenue del trigger sort (p.ej. "Ordenar"). Default = label. */
  sortLabel?: string
}

export interface FilterBarProps {
  groups: FilterGroup[]
  activeFilters: Record<string, string | string[]>
  /** single emite string; multi/searchable emiten string[]. */
  onChange: (key: string, value: string | string[]) => void
  className?: string
}

// Trigger-pill estándar (filtros): borde sutil + fondo transparente; abierto o
// activo → borde resaltado. Reusa tokens DS.
function triggerPillClass(active: boolean, open: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-body font-medium whitespace-nowrap cursor-pointer",
    "border transition-all duration-150 ease-out active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-positive focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
    active
      ? "bg-accent-positive/15 border-accent-positive text-text-primary"
      : open
        ? "bg-surface-elevated border-accent-positive/60 text-text-primary"
        : "bg-transparent border-surface-border text-text-secondary hover:text-text-primary hover:border-text-tertiary"
  )
}

/**
 * FilterBar v3.1 (E59 R3): trigger-pills con icono lucide + chevron, todo en
 * Popover. kinds: single (single-select con deselección), multi (checkboxes),
 * searchable (multi + buscador). align:'end' empuja a la derecha; variant:'sort'
 * lo renderiza como "Ordenar: <valor>". Estilo del mockup, tokens DS.
 */
export function FilterBar({
  groups,
  activeFilters,
  onChange,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {groups.map((group) => {
        const kind = group.kind ?? "single"
        const raw = activeFilters[group.key]
        const alignEnd = group.align === "end" ? "ml-auto" : undefined

        if (group.variant === "sort") {
          return (
            <SortGroup
              key={group.key}
              group={group}
              value={Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "")}
              className={alignEnd}
              onChange={onChange}
            />
          )
        }
        if (kind === "single") {
          return (
            <SingleGroup
              key={group.key}
              group={group}
              value={Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "")}
              className={alignEnd}
              onChange={onChange}
            />
          )
        }
        // multi | searchable
        return (
          <MultiGroup
            key={group.key}
            group={group}
            searchable={kind === "searchable"}
            value={Array.isArray(raw) ? raw : raw ? [raw] : []}
            className={alignEnd}
            onChange={onChange}
          />
        )
      })}
    </div>
  )
}

// ── Cabecera del popover: icono + nombre del filtro ──────────────────────────
function PopoverHeader({ group }: { group: FilterGroup }) {
  const Icon = group.icon
  return (
    <div className="flex items-center gap-1.5 px-1 pb-1.5 mb-1 border-b border-surface-border text-text-secondary">
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span className="text-xs font-semibold">{group.label}</span>
    </div>
  )
}

// ── single: trigger-pill → Popover single-select, permite DESELECCIONAR ───────
// Opciones renderizadas como chips/radios redondeados. value vacío/"all" = sin
// filtro; clic en la opción activa la deselecciona.
function SingleGroup({
  group,
  value,
  className,
  onChange,
}: {
  group: FilterGroup
  value: string
  className?: string
  onChange: FilterBarProps["onChange"]
}) {
  const [open, setOpen] = useState(false)
  const Icon = group.icon
  const active = value !== "" && value !== "all"
  const activeOption = group.options.find((o) => o.value === value)
  const triggerLabel = active && activeOption ? activeOption.label : group.label

  function select(optValue: string) {
    onChange(group.key, optValue === value ? "all" : optValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          data-testid={`filter-trigger-${group.key}`}
          className={cn(triggerPillClass(active, open), className)}
        >
          {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
          {triggerLabel}
          {open ? (
            <ChevronUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="min-w-44 max-h-72 overflow-y-auto rounded-card shadow-xl">
        <PopoverHeader group={group} />
        <div className="flex flex-wrap gap-1.5">
          {group.options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`filter-opt-${group.key}-${option.value}`}
                onClick={() => select(option.value)}
                className={cn(
                  "px-2.5 py-1 rounded-pill text-xs cursor-pointer border transition-colors",
                  selected
                    ? "bg-accent-positive text-on-accent-positive border-accent-positive font-semibold"
                    : "bg-surface-elevated text-text-secondary border-surface-border hover:text-text-primary"
                )}
              >
                {option.icon ? `${option.icon} ${option.label}` : option.label}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── sort: trigger "Ordenar: <valor>" → Popover single-select ──────────────────
function SortGroup({
  group,
  value,
  className,
  onChange,
}: {
  group: FilterGroup
  value: string
  className?: string
  onChange: FilterBarProps["onChange"]
}) {
  const [open, setOpen] = useState(false)
  const Icon = group.icon
  const prefix = group.sortLabel ?? group.label
  const activeOption = group.options.find((o) => o.value === value)
  // sort no se "deselecciona": siempre hay un orden. Si no hay valor, muestra la
  // primera opción como predeterminada visible.
  const displayOption = activeOption ?? group.options[0]
  const active = value !== "" && value !== "all"

  function select(optValue: string) {
    onChange(group.key, optValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          data-testid={`filter-trigger-${group.key}`}
          className={cn(triggerPillClass(active, open), className)}
        >
          {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
          <span className="text-text-secondary">{prefix}:</span>
          <span className="font-semibold text-text-primary">
            {displayOption?.label ?? ""}
          </span>
          {open ? (
            <ChevronUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="min-w-44 max-h-72 overflow-y-auto rounded-card shadow-xl">
        <PopoverHeader group={group} />
        <div className="flex flex-col gap-0.5">
          {group.options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={option.value === value}
              data-testid={`filter-opt-${group.key}-${option.value}`}
              onClick={() => select(option.value)}
              className={cn(
                "text-left px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-surface-elevated",
                option.value === value && "text-accent-positive font-semibold"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── multi / searchable: trigger-pill → Popover con checkboxes ─────────────────
function MultiGroup({
  group,
  searchable,
  value,
  className,
  onChange,
}: {
  group: FilterGroup
  searchable: boolean
  value: string[]
  className?: string
  onChange: FilterBarProps["onChange"]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const Icon = group.icon
  const count = value.length
  const visible = searchable
    ? group.options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase())
      )
    : group.options

  function toggle(optValue: string) {
    const next = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue]
    onChange(group.key, next)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          data-testid={`filter-trigger-${group.key}`}
          className={cn(triggerPillClass(count > 0, open), className)}
        >
          {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
          {group.label}
          {count > 0 && (
            <span
              data-testid={`badge-${group.key}`}
              className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent-positive text-on-accent-positive text-[10px] font-semibold"
            >
              {count}
            </span>
          )}
          {open ? (
            <ChevronUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="min-w-48 max-h-72 overflow-y-auto rounded-card shadow-xl">
        <PopoverHeader group={group} />
        {searchable && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={group.label}
            aria-label={group.label}
            className="mb-1.5 w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-positive"
          />
        )}
        <div className="flex flex-col gap-0.5">
          {visible.map((option) => {
            const checked = value.includes(option.value)
            return (
              <label
                key={option.value}
                data-testid={`filter-opt-${group.key}-${option.value}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-surface-elevated text-xs"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option.value)}
                  className="accent-accent-positive"
                />
                {option.icon && <span>{option.icon}</span>}
                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
