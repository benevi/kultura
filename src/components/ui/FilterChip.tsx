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
      className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-pill text-xs font-body font-medium whitespace-nowrap",
        "transition-all duration-150 ease-out active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-positive focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? "bg-accent-positive text-on-accent-positive"
          : "bg-surface-elevated text-text-secondary hover:text-text-primary",
        className
      )}
      {...props}
    >
      {label}
    </button>
  );
}
