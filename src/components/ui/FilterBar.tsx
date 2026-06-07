"use client"

import { useState } from "react"
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
}

export interface FilterBarProps {
  groups: FilterGroup[]
  activeFilters: Record<string, string | string[]>
  /** single emite string; multi/searchable emiten string[]. */
  onChange: (key: string, value: string | string[]) => void
  className?: string
}

// Estilo del trigger-pill con chevron, compartido por todos los kinds (v3 = todo
// popover). Reusa el lenguaje visual de chip sin ser toggle.
function popoverTriggerClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-pill text-xs font-body font-medium whitespace-nowrap cursor-pointer",
    "transition-all duration-150 ease-out active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-positive focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
    active
      ? "bg-accent-positive text-on-accent-positive"
      : "bg-surface-elevated text-text-secondary hover:text-text-primary"
  )
}

// Chevron inline (sin dependencia de iconos): rota cuando el popover abre.
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={cn(
        "h-3 w-3 transition-transform duration-150",
        open && "rotate-180"
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * FilterBar v3 (E59 R2): TODO se renderiza como trigger-pill + Popover. No hay
 * render inline. kinds: single (single-select con deselección), multi
 * (checkboxes), searchable (multi + buscador). align:'end' empuja a la derecha.
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

// ── single: trigger-pill → Popover single-select, permite DESELECCIONAR ───────
// El trigger muestra el label de la opción activa, o el nombre del filtro si no
// hay ninguna. value vacío ("" o ausente) = sin filtro. Clic en la opción ya
// activa la deselecciona (vuelve a sin filtro, value "all").
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
  const active = value !== "" && value !== "all"
  const activeOption = group.options.find((o) => o.value === value)
  const triggerLabel = active && activeOption ? activeOption.label : group.label

  function select(optValue: string) {
    // deselección: clic en la opción ya activa → "all" (sin filtro).
    onChange(group.key, optValue === value ? "all" : optValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className={cn(popoverTriggerClass(active), className)}
        >
          {triggerLabel}
          <Chevron open={open} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="min-w-40 max-h-64 overflow-y-auto flex flex-col gap-0.5">
        {group.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            className={cn(
              "text-left px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-surface-elevated",
              option.value === value && "text-accent-positive font-semibold"
            )}
          >
            {option.icon ? `${option.icon} ${option.label}` : option.label}
          </button>
        ))}
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
          className={cn(popoverTriggerClass(count > 0), className)}
        >
          {group.label}
          {count > 0 && (
            <span
              data-testid={`badge-${group.key}`}
              className="ml-1 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-on-accent-positive/20 text-[10px] font-semibold"
            >
              {count}
            </span>
          )}
          <Chevron open={open} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="min-w-44 max-h-64 overflow-y-auto flex flex-col gap-0.5">
        {searchable && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={group.label}
            aria-label={group.label}
            className="mb-1 w-full bg-surface-elevated border border-border rounded-lg px-2 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent-positive"
          />
        )}
        {visible.map((option) => {
          const checked = value.includes(option.value)
          return (
            <label
              key={option.value}
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
      </PopoverContent>
    </Popover>
  )
}
