import * as React from "react";
import { cn } from "@/lib/utils/index";

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
  /** Emoji decorativo delante de la etiqueta (aria-hidden). */
  emoji?: string;
  /**
   * F0 §Chips: `solid` (inactivo = surface-2) o `outline` (inactivo =
   * transparente + borde 2px stroke, más pequeño — filtros secundarios).
   * En ambos, activo = fondo pink + texto on-pink.
   */
  variant?: "solid" | "outline";
}

export function FilterChip({
  active = false,
  label,
  emoji,
  variant = "solid",
  className,
  ...props
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill font-body font-bold whitespace-nowrap border-2",
        "transition-all duration-150 ease-out active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
        "disabled:pointer-events-none disabled:opacity-40",
        variant === "solid" ? "px-4 py-[7px] text-[13px]" : "px-4 py-1.5 text-xs",
        active
          ? "bg-accent-pink text-on-accent-pink border-accent-pink"
          : variant === "solid"
            ? "bg-surface-elevated text-text-primary border-surface-elevated hover:border-surface-border"
            : "bg-transparent text-text-primary border-surface-border hover:bg-surface-elevated",
        className
      )}
      {...props}
    >
      {emoji && <span aria-hidden="true">{emoji}</span>}
      {label}
    </button>
  );
}
