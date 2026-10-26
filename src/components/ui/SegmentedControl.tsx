"use client";

import * as React from "react";
import { cn } from "@/lib/utils/index";
import { useRadioGroupKeys } from "@/components/ui/useRadioGroupKeys";

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Segmented control controlado (sin estado interno).
 *
 * A11y — patrón `radiogroup`: el control es una selección ÚNICA y exclusiva
 * (p.ej. el tipo de media activo). Por eso usamos `role="radiogroup"` en el
 * track y `role="radio"` + `aria-checked` en cada segmento, NO `tablist`
 * (tablist implica paneles asociados, que aquí no existen) ni `aria-pressed`
 * (que modela toggles independientes, no exclusión mutua).
 *
 * Genérico: no conoce MediaType ni TYPE_ORDER; el caller le pasa las options
 * ya derivadas. Reusable para cualquier selección segmentada.
 *
 * Teclado (ACC-10): una sola parada de Tab y las flechas cambian de segmento
 * (`useRadioGroupKeys`); antes cada segmento era una parada y las flechas no
 * hacían nada.
 *
 * Mobile-first: scroll horizontal si los segmentos no caben.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: SegmentedControlProps) {
  const { getItemProps } = useRadioGroupKeys(
    options.map((o) => o.value),
    value,
    onChange
  );
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 p-1 rounded-2xl bg-surface-elevated",
        "overflow-x-auto max-w-full scrollbar-hide flex-nowrap",
        className
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            {...getItemProps(option.value, index)}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center min-h-11 px-3 py-1.5 rounded-lg",
              "text-xs font-body font-medium whitespace-nowrap cursor-pointer",
              "transition-all duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
              active
                ? "bg-accent-positive text-on-accent-positive"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
