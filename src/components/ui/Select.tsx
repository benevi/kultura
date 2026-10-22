"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/index";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  className?: string;
}

/**
 * Desplegable nativo. La etiqueta se asocia con `htmlFor` (antes era un
 * `<label>` suelto y el select no tenía nombre accesible), el borde usa
 * `--field-border` (3,65:1 contra la tarjeta, ACC-4) y la letra es de 16 px en
 * móvil para que iOS no haga zoom al enfocar (MOV-5).
 */
export function Select({ value, onChange, options, label, className }: SelectProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm text-muted">{label}</label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "bg-surface border border-field-border rounded-md px-3 py-2 text-base md:text-sm text-text",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring cursor-pointer",
          className
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
