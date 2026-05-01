"use client"

import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils/index"

export interface FilterOption {
  value: string
  label: string
  icon?: string
}

export interface FilterGroup {
  key: string
  label: string
  options: FilterOption[]
  multi?: boolean
}

export interface FilterBarProps {
  groups: FilterGroup[]
  activeFilters: Record<string, string | string[]>
  onChange: (key: string, value: string) => void
  className?: string
}

export function FilterBar({ groups, activeFilters, onChange, className }: FilterBarProps) {
  const t = useTranslations("filters")

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {groups.map((group) => {
        const rawValue = activeFilters[group.key]
        const activeValue = Array.isArray(rawValue)
          ? (rawValue[0] ?? "all")
          : (rawValue ?? "all")

        const allOptions: FilterOption[] = [
          { value: "all", label: t("all") },
          ...group.options,
        ]

        return (
          <div key={group.key}>
            <p className="text-xs text-muted uppercase tracking-wide mb-1.5">
              {group.label}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-nowrap">
              {allOptions.map((option) => {
                const isActive = option.value === activeValue

                function handleClick() {
                  if (isActive && option.value !== "all") {
                    onChange(group.key, "all")
                  } else {
                    onChange(group.key, option.value)
                  }
                }

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={handleClick}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border whitespace-nowrap cursor-pointer transition-colors",
                      isActive
                        ? "bg-accent-subtle text-accent border-accent"
                        : "bg-surface2 text-muted border-border hover:border-accent/50"
                    )}
                  >
                    {option.icon && <span className="mr-1">{option.icon}</span>}
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
