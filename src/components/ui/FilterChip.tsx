import * as React from "react";
import { cn } from "@/lib/utils/index";

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
}

export function FilterChip({ active = false, label, className, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      // ACC-10: el estado activo no era solo visual para el lector.
      aria-pressed={active}
      className={cn(
        "inline-flex items-center min-h-11 px-3 py-1.5 rounded-pill text-xs font-body font-medium whitespace-nowrap",
        "transition-[color,background-color,transform] duration-fast ease-out motion-safe:active:scale-[0.97]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? // Elegido: el chip «pegado», en la tinta del texto (blanco de
            // noche, marino en papel). El rosa queda para la acción.
            "bg-text-primary text-surface-base"
          : "bg-surface-elevated text-text-secondary hover:text-text-primary",
        className
      )}
      {...props}
    >
      {label}
    </button>
  );
}
