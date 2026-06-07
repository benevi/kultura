"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils/index"
import { FilterChip } from "@/components/ui/FilterChip"
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
  /** Naturaleza del trigger. Default 'single' → backward-compat. */
  kind?: FilterKind
}

export interface FilterBarProps {
  groups: FilterGroup[]
  activeFilters: Record<string, string | string[]>
  /** single/min/menu emiten string; multi/searchable emiten string[]. */
  onChange: (key: string, value: string | string[]) => void
  className?: string
}

// Estilo compartido por triggers de popover (multi/searchable/min/menu). Reusa
// el lenguaje visual de FilterChip/segmento sin ser un FilterChip (que toggle).
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

export function FilterBar({ groups, activeFilters, onChange, className }: FilterBarProps) {
  const t = useTranslations("filters")

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {groups.map((group) => {
        const kind = group.kind ?? "single"
        const raw = activeFilters[group.key]

        return (
          <div key={group.key}>
            <p className="text-xs text-muted uppercase tracking-wide mb-1.5">
              {group.label}
            </p>
            {kind === "single" && (
              <SingleGroup
                group={group}
                value={Array.isArray(raw) ? (raw[0] ?? "all") : (raw ?? "all")}
                allLabel={t("all")}
                onChange={onChange}
              />
            )}
            {(kind === "multi" || kind === "searchable") && (
              <MultiGroup
                group={group}
                searchable={kind === "searchable"}
                value={Array.isArray(raw) ? raw : raw ? [raw] : []}
                onChange={onChange}
              />
            )}
            {kind === "min" && (
              <MinGroup
                group={group}
                value={Array.isArray(raw) ? (raw[0] ?? "all") : (raw ?? "all")}
                allLabel={t("all")}
                onChange={onChange}
              />
            )}
            {kind === "menu" && (
              <MenuGroup
                group={group}
                value={Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "")}
                onChange={onChange}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── single: fila de chips (FilterChip) con "all" inyectado + toggle-off ──────
function SingleGroup({
  group,
  value,
  allLabel,
  onChange,
}: {
  group: FilterGroup
  value: string
  allLabel: string
  onChange: FilterBarProps["onChange"]
}) {
  const allOptions: FilterOption[] = [
    { value: "all", label: allLabel },
    ...group.options,
  ]
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-nowrap">
      {allOptions.map((option) => {
        const isActive = option.value === value
        return (
          <FilterChip
            key={option.value}
            active={isActive}
            label={option.icon ? `${option.icon} ${option.label}` : option.label}
            onClick={() => {
              if (isActive && option.value !== "all") {
                onChange(group.key, "all")
              } else {
                onChange(group.key, option.value)
              }
            }}
          />
        )
      })}
    </div>
  )
}

// ── multi / searchable: trigger-chip → Popover con checkboxes ────────────────
function MultiGroup({
  group,
  searchable,
  value,
  onChange,
}: {
  group: FilterGroup
  searchable: boolean
  value: string[]
  onChange: FilterBarProps["onChange"]
}) {
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
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={popoverTriggerClass(count > 0)}>
          {group.label}
          {count > 0 && (
            <span
              data-testid={`badge-${group.key}`}
              className="ml-1 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-on-accent-positive/20 text-[10px] font-semibold"
            >
              {count}
            </span>
          )}
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

// ── min: trigger → Popover single-select con semántica "X+" ──────────────────
function MinGroup({
  group,
  value,
  allLabel,
  onChange,
}: {
  group: FilterGroup
  value: string
  allLabel: string
  onChange: FilterBarProps["onChange"]
}) {
  const active = value !== "all"
  const activeOption = group.options.find((o) => o.value === value)
  const triggerLabel = active && activeOption ? activeOption.label : group.label
  const allOptions: FilterOption[] = [
    { value: "all", label: allLabel },
    ...group.options,
  ]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={popoverTriggerClass(active)}>
          {triggerLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent className="min-w-40 flex flex-col gap-0.5">
        {allOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(group.key, option.value)}
            className={cn(
              "text-left px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-surface-elevated",
              option.value === value && "text-accent-positive font-semibold"
            )}
          >
            {option.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// ── menu: trigger etiquetado → Popover single-select, SIN "all" ──────────────
function MenuGroup({
  group,
  value,
  onChange,
}: {
  group: FilterGroup
  value: string
  onChange: FilterBarProps["onChange"]
}) {
  const activeOption = group.options.find((o) => o.value === value)
  const triggerLabel = activeOption ? activeOption.label : group.label

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={popoverTriggerClass(false)}>
          {triggerLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent className="min-w-40 flex flex-col gap-0.5">
        {group.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(group.key, option.value)}
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
